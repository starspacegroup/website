import { describe, expect, it, vi } from 'vitest';
import {
	PROFILE_DAYS,
	UNAVAILABLE_PROFILE,
	discordAccountId,
	fetchMemberProfile
} from './member-profile';

/**
 * The signed-in half of `/stats`.
 *
 * Two things are load-bearing and both are asserted here:
 *
 *  - **The id comes from the database, for the current session.** If
 *    `discordAccountId` ever returned something a request could influence, this
 *    page would become a lookup service for anyone who knows a snowflake.
 *  - **Every failure is the same failure.** No key, no `members:read`, an
 *    unreachable bot: all of them render the page without the personal panel,
 *    and none of them is an error.
 */

const ok = (body: unknown) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

const config = { apiUrl: 'https://bot.test', apiKey: 'sb_live_abc' };
const USER = '123456789012345678';

const window = (over: Record<string, unknown> = {}) => ({
	messages: 12,
	channels: 3,
	last_message_at: '2026-09-20 10:00:00',
	voice_seconds: 3600,
	voice_sessions: 4,
	voice_channels: 2,
	last_voice_at: '2026-09-19 22:00:00',
	commands: 7,
	...over
});

const body = (over: Record<string, unknown> = {}) => ({
	guild_id: 'g1',
	user_id: USER,
	member: true,
	joined_at: '2026-01-04 12:00:00',
	bot: false,
	days: 30,
	retention_days: 90,
	unrecorded_channels: 1,
	activity: window(),
	recorded: window({ messages: 40, voice_seconds: 9000 }),
	standing: { message_rank: 4, message_population: 37, voice_rank: 2, voice_population: 11 },
	...over
});

/** A D1 stand-in that answers one row and records what it was asked. */
function fakeDb(row: unknown, options: { throws?: boolean } = {}) {
	const calls: { sql: string; binds: unknown[] }[] = [];
	return {
		calls,
		prepare(sql: string) {
			const statement = {
				bind(...binds: unknown[]) {
					calls.push({ sql, binds });
					return statement;
				},
				async first() {
					if (options.throws) throw new Error('D1 is having a day');
					return row;
				}
			};
			return statement;
		}
	};
}

describe('discordAccountId', () => {
	it('reads the id linked to this user, and only this user', async () => {
		const db = fakeDb({ provider_account_id: USER });
		expect(await discordAccountId(db as never, 'user-1')).toBe(USER);

		const { sql, binds } = db.calls[0];
		expect(sql).toContain('FROM oauth_accounts');
		expect(sql).toContain("provider = 'discord'");
		// The session's user id is the only thing that selects the row.
		expect(binds).toEqual(['user-1']);
	});

	it('is null for a visitor who is not signed in', async () => {
		const db = fakeDb({ provider_account_id: USER });
		expect(await discordAccountId(db as never, undefined)).toBeNull();
		expect(db.calls).toHaveLength(0);
	});

	it('is null without a database', async () => {
		expect(await discordAccountId(undefined, 'user-1')).toBeNull();
	});

	it('is null for a user who never linked Discord', async () => {
		expect(await discordAccountId(fakeDb(null) as never, 'user-1')).toBeNull();
	});

	it('refuses a stored value that is not a snowflake', async () => {
		// It would go into a URL. A row this site did not write is not trusted
		// just because it is in this site's database.
		for (const stored of ['', '  ', 'not-an-id', '../../admin', '1'.repeat(40), 42]) {
			const db = fakeDb({ provider_account_id: stored });
			expect(await discordAccountId(db as never, 'user-1')).toBeNull();
		}
	});

	it('is null rather than an error when the lookup fails', async () => {
		const db = fakeDb(null, { throws: true });
		expect(await discordAccountId(db as never, 'user-1')).toBeNull();
	});
});

describe('fetchMemberProfile', () => {
	it('reads a member own figures', async () => {
		const fetcher = ok(body());
		const profile = await fetchMemberProfile(config, USER, fetcher);

		expect(profile.available).toBe(true);
		expect(profile.member).toBe(true);
		expect(profile.joinedAt).toBe('2026-01-04 12:00:00');
		expect(profile.days).toBe(30);
		expect(profile.retentionDays).toBe(90);
		expect(profile.unrecordedChannels).toBe(1);
		expect(profile.activity).toEqual({
			messages: 12,
			channels: 3,
			lastMessageAt: '2026-09-20 10:00:00',
			voiceSeconds: 3600,
			voiceSessions: 4,
			voiceChannels: 2,
			lastVoiceAt: '2026-09-19 22:00:00',
			commands: 7
		});
		expect(profile.recorded.messages).toBe(40);
		expect(profile.standing).toEqual({
			messageRank: 4,
			messagePopulation: 37,
			voiceRank: 2,
			voicePopulation: 11
		});
	});

	it('asks the right endpoint, with the key on the header', async () => {
		const fetcher = ok(body());
		await fetchMemberProfile({ ...config, apiUrl: 'https://bot.test/' }, USER, fetcher);

		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`https://bot.test/api/v1/members/${USER}?days=${PROFILE_DAYS}`);
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sb_live_abc');
	});

	it('never puts anything but a snowflake in the path', async () => {
		const fetcher = ok(body());
		for (const id of ['', 'nope', '../../v1/stats', "1'; DROP", '1'.repeat(40)]) {
			expect(await fetchMemberProfile(config, id, fetcher)).toEqual(UNAVAILABLE_PROFILE);
		}
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('reports a Discord account that is not in the server', async () => {
		const fetcher = ok(body({ member: false, joined_at: null, activity: window({ messages: 0 }) }));
		const profile = await fetchMemberProfile(config, USER, fetcher);

		// Available and not a member is its own state: the page invites them in
		// rather than saying something went wrong.
		expect(profile.available).toBe(true);
		expect(profile.member).toBe(false);
		expect(profile.joinedAt).toBeNull();
	});

	it('treats a key without members:read like every other failure', async () => {
		const forbidden = vi.fn(async () => new Response('{"error":"scope"}', { status: 403 }));
		expect(await fetchMemberProfile(config, USER, forbidden)).toEqual(UNAVAILABLE_PROFILE);
	});

	it('is unavailable without a key, when unreachable, or on a body that does not parse', async () => {
		const fetcher = ok(body());
		expect(await fetchMemberProfile({}, USER, fetcher)).toEqual(UNAVAILABLE_PROFILE);

		const unreachable = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		});
		expect(await fetchMemberProfile(config, USER, unreachable)).toEqual(UNAVAILABLE_PROFILE);

		const garbage = vi.fn(async () => new Response('<html>', { status: 200 }));
		expect(await fetchMemberProfile(config, USER, garbage)).toEqual(UNAVAILABLE_PROFILE);
	});

	it('falls back on its own defaults when SpaceBot omits a field', async () => {
		const fetcher = ok({ member: true });
		const profile = await fetchMemberProfile(config, USER, fetcher);

		expect(profile.available).toBe(true);
		expect(profile.days).toBe(PROFILE_DAYS);
		expect(profile.retentionDays).toBe(90);
		expect(profile.activity.messages).toBe(0);
		expect(profile.standing.messageRank).toBeNull();
	});

	it('reads a rank of zero or below as no rank at all', async () => {
		const fetcher = ok(
			body({
				standing: { message_rank: 0, message_population: 5, voice_rank: -1, voice_population: 2 }
			})
		);
		const profile = await fetchMemberProfile(config, USER, fetcher);
		expect(profile.standing.messageRank).toBeNull();
		expect(profile.standing.voiceRank).toBeNull();
	});

	it('does not take a non-object body as a member', async () => {
		const fetcher = ok({ member: 'yes', activity: 'busy', standing: null });
		const profile = await fetchMemberProfile(config, USER, fetcher);
		expect(profile.member).toBe(false);
		expect(profile.activity.messages).toBe(0);
		expect(profile.standing.messagePopulation).toBe(0);
	});
});
