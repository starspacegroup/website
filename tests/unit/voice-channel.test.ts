import {
	fetchVoiceSnapshot,
	LIVE_MEMBER_THRESHOLD,
	VOICE_CACHE_SECONDS
} from '$lib/server/voice-channel';
import { describe, expect, it, vi } from 'vitest';

const CONFIG = {
	apiUrl: 'https://spacebot.example',
	apiKey: 'sb_live_test',
	channel: 'Ten Forward'
};

/**
 * A Discord avatar URL carries a user id and a hash, never a name. The fixture
 * mirrors that, so the "nothing identifying reaches the wire" test below is
 * checking the mapper rather than an artefact of these fixtures.
 */
function avatarFor(name: string) {
	const id = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
	return `https://cdn.example/avatars/${id}/9f8e7d.png`;
}

function member(name: string, extra: Record<string, unknown> = {}) {
	return {
		userId: `u-${name}`,
		userName: name,
		displayName: name,
		avatarUrl: avatarFor(name),
		...extra
	};
}

/** A SpaceBot response with `count` people in Ten Forward. */
function snapshotOf(count: number, extra: Record<string, unknown> = {}) {
	return {
		channels: [
			{
				channelId: '222',
				channelName: 'Ten Forward',
				members: Array.from({ length: count }, (_, i) => member(`person${i}`))
			}
		],
		updatedAt: '2026-09-05T12:00:00Z',
		...extra
	};
}

function fetcherFor(body: unknown, init: { ok?: boolean; status?: number } = {}) {
	return vi.fn(async () => ({
		ok: init.ok ?? true,
		status: init.status ?? 200,
		json: async () => body
	})) as unknown as typeof fetch;
}

describe('fetchVoiceSnapshot', () => {
	it('goes live once the channel holds the threshold', async () => {
		const fetcher = fetcherFor(snapshotOf(LIVE_MEMBER_THRESHOLD));
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);

		expect(result.live).toBe(true);
		if (!result.live) throw new Error('unreachable');
		expect(result.members).toHaveLength(LIVE_MEMBER_THRESHOLD);
		expect(result.channel).toBe('Ten Forward');
		expect(result.updatedAt).toBe('2026-09-05T12:00:00Z');
	});

	it('publishes NOTHING about the people in a channel below the threshold', async () => {
		// The point of the feature, and the reason the threshold is server-side:
		// two people in a voice channel is a fact about those two people.
		const fetcher = fetcherFor(snapshotOf(LIVE_MEMBER_THRESHOLD - 1));
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);

		expect(result).toEqual({ live: false });
		expect(JSON.stringify(result)).not.toContain('person0');
	});

	it('asks SpaceBot for the configured channel, with the key in the header', async () => {
		const fetcher = fetcherFor(snapshotOf(3));
		await fetchVoiceSnapshot({ ...CONFIG, channel: '#Ten Forward' }, fetcher);

		const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('https://spacebot.example/api/v1/voice?channel=%23Ten%20Forward');
		expect((init as RequestInit).headers).toMatchObject({
			Authorization: 'Bearer sb_live_test'
		});
	});

	it('does not double the slash when the configured URL has a trailing one', async () => {
		const fetcher = fetcherFor(snapshotOf(3));
		await fetchVoiceSnapshot({ ...CONFIG, apiUrl: 'https://spacebot.example/' }, fetcher);
		const [url] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('https://spacebot.example/api/v1/voice?channel=Ten%20Forward');
	});

	it('returns faces and voice flags, and no identity of any kind', async () => {
		const fetcher = fetcherFor({
			channels: [
				{
					channelName: 'Ten Forward',
					members: [
						member('nova', { streaming: true }),
						member('quill', { selfVideo: true, selfMute: true }),
						member('orbit', { avatarUrl: '', serverMute: true })
					]
				}
			]
		});
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);
		if (!result.live) throw new Error('expected live');

		expect(result.members[0]).toEqual({
			avatar: avatarFor('nova'),
			streaming: true,
			video: false,
			muted: false
		});
		expect(result.members[1]).toMatchObject({ video: true, muted: true });
		// An empty avatar becomes null, and a server mute counts as muted.
		expect(result.members[2]).toEqual({
			avatar: null,
			streaming: false,
			video: false,
			muted: true
		});
	});

	it('never lets a name, username or user id reach the response', async () => {
		// The privacy rule, asserted over the whole serialised payload rather than
		// field by field: adding a name back to the mapper has to fail here.
		const fetcher = fetcherFor(snapshotOf(4));
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);
		const wire = JSON.stringify(result);

		expect(wire).not.toContain('person0');
		expect(wire).not.toContain('u-person0');
		expect(wire).not.toContain('displayName');
		expect(wire).not.toContain('userName');
		expect(wire).not.toContain('userId');
		if (!result.live) throw new Error('expected live');
		for (const person of result.members) {
			expect(Object.keys(person).sort()).toEqual(['avatar', 'muted', 'streaming', 'video']);
		}
	});

	it('drops a row that is not a member — SpaceBot never sends one without a user id', async () => {
		const fetcher = fetcherFor({
			channels: [
				{
					channelName: 'Ten Forward',
					members: [member('a'), member('b'), member('c'), { avatarUrl: 'x' }]
				}
			]
		});
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);
		if (!result.live) throw new Error('expected live');
		expect(result.members).toHaveLength(3);
	});

	it('drops below the threshold when the unusable rows are what made up the count', async () => {
		const fetcher = fetcherFor({
			channels: [{ channelName: 'Ten Forward', members: [member('a'), member('b'), {}] }]
		});
		expect(await fetchVoiceSnapshot(CONFIG, fetcher)).toEqual({ live: false });
	});

	it('uses the configured name when SpaceBot omits the channel name', async () => {
		const fetcher = fetcherFor({
			channels: [{ members: [member('a'), member('b'), member('c')] }]
		});
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);
		if (!result.live) throw new Error('expected live');
		expect(result.channel).toBe('Ten Forward');
		expect(result.updatedAt).toBeNull();
	});

	describe('every failure lands on the simulation', () => {
		it('when the bot is not configured', async () => {
			const fetcher = fetcherFor(snapshotOf(5));
			expect(await fetchVoiceSnapshot({ ...CONFIG, apiKey: undefined }, fetcher)).toEqual({
				live: false
			});
			expect(await fetchVoiceSnapshot({ ...CONFIG, apiUrl: undefined }, fetcher)).toEqual({
				live: false
			});
			expect(await fetchVoiceSnapshot({ ...CONFIG, channel: '' }, fetcher)).toEqual({
				live: false
			});
			// Nothing was asked of the network in any of those cases.
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('when the request throws — offline, DNS, timeout', async () => {
			const fetcher = vi.fn(async () => {
				throw new Error('network down');
			}) as unknown as typeof fetch;
			expect(await fetchVoiceSnapshot(CONFIG, fetcher)).toEqual({ live: false });
		});

		it('when SpaceBot answers with an error status', async () => {
			const fetcher = fetcherFor({ error: 'Insufficient scope' }, { ok: false, status: 403 });
			expect(await fetchVoiceSnapshot(CONFIG, fetcher)).toEqual({ live: false });
		});

		it('when the body is not JSON', async () => {
			const fetcher = vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => {
					throw new SyntaxError('Unexpected token <');
				}
			})) as unknown as typeof fetch;
			expect(await fetchVoiceSnapshot(CONFIG, fetcher)).toEqual({ live: false });
		});

		it('when the shape is not what was promised', async () => {
			for (const body of [{}, { channels: 'nope' }, { channels: [] }, { channels: [{}] }]) {
				expect(await fetchVoiceSnapshot(CONFIG, fetcherFor(body))).toEqual({ live: false });
			}
		});
	});
});

describe('constants', () => {
	it('keeps the threshold and the cache window at their documented values', () => {
		// Both are quoted in docs and in the API catalog entry; changing one
		// without the other is how the honesty rule quietly breaks.
		expect(LIVE_MEMBER_THRESHOLD).toBe(3);
		expect(VOICE_CACHE_SECONDS).toBe(10);
	});
});
