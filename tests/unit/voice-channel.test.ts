import {
	fetchVoiceSnapshot,
	LIVE_MEMBER_THRESHOLD,
	readVoiceConfig,
	VOICE_CACHE_SECONDS
} from '$lib/server/voice-channel';
import { describe, expect, it, vi } from 'vitest';

const CONFIG = {
	apiUrl: 'https://spacebot.example',
	apiKey: 'sb_live_test',
	channel: 'Ten Forward'
};

function member(name: string, extra: Record<string, unknown> = {}) {
	return {
		userId: `u-${name}`,
		userName: name,
		displayName: name,
		avatarUrl: `https://cdn.example/${name}.png`,
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

describe('readVoiceConfig', () => {
	it('reads the three settings off the platform env', () => {
		const config = readVoiceConfig({
			env: {
				SPACEBOT_API_URL: 'https://bot.example',
				SPACEBOT_API_KEY: 'sb_live_x',
				SPACEBOT_VOICE_CHANNEL: 'Engineering'
			}
		} as never);
		expect(config).toEqual({
			apiUrl: 'https://bot.example',
			apiKey: 'sb_live_x',
			channel: 'Engineering'
		});
	});

	it('defaults the channel to Ten Forward and tolerates no platform at all', () => {
		expect(readVoiceConfig(undefined).channel).toBe('Ten Forward');
		expect(readVoiceConfig({ env: {} } as never).channel).toBe('Ten Forward');
		expect(readVoiceConfig(undefined).apiKey).toBeUndefined();
	});
});

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

	it('maps the flags the panel draws, and falls back to the username', async () => {
		const fetcher = fetcherFor({
			channels: [
				{
					channelName: 'Ten Forward',
					members: [
						member('nova', { streaming: true }),
						member('quill', { selfVideo: true, selfMute: true }),
						{ userName: 'orbit', displayName: '  ', avatarUrl: '', serverMute: true }
					]
				}
			]
		});
		const result = await fetchVoiceSnapshot(CONFIG, fetcher);
		if (!result.live) throw new Error('expected live');

		expect(result.members[0]).toEqual({
			name: 'nova',
			avatar: 'https://cdn.example/nova.png',
			streaming: true,
			video: false,
			muted: false
		});
		expect(result.members[1]).toMatchObject({ video: true, muted: true });
		// Blank display name falls back to the username; empty avatar becomes null.
		expect(result.members[2]).toEqual({
			name: 'orbit',
			avatar: null,
			streaming: false,
			video: false,
			muted: true
		});
	});

	it('drops a nameless row rather than rendering somebody as Unknown', async () => {
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
		expect(result.members.map((m) => m.name)).toEqual(['a', 'b', 'c']);
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
