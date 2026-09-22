import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the `/stats` loader is responsible for, which is not the figures
 * themselves — `guild-stats.test.ts` and `member-profile.test.ts` cover those.
 *
 * It is responsible for four things, and all four are asserted here:
 *
 *  - the server's figures are shared in KV and the personal ones never are;
 *  - the Discord id comes from the session's database row, never the request;
 *  - a signed-out visitor still gets the whole public page;
 *  - nothing about this page may be stored by a cache, shared or otherwise.
 */

const fetchGuildStats = vi.fn();
const fetchMemberProfile = vi.fn();
const discordAccountId = vi.fn();
const getSpaceBotConfig = vi.fn(async () => ({ apiUrl: 'https://bot.test', apiKey: 'sb_live_x' }));

vi.mock('$lib/server/spacebot-connection', () => ({
	getSpaceBotConfig: (...args: unknown[]) => getSpaceBotConfig(...(args as []))
}));

vi.mock('$lib/server/guild-stats', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return { ...actual, fetchGuildStats: (...args: unknown[]) => fetchGuildStats(...args) };
});

vi.mock('$lib/server/member-profile', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		fetchMemberProfile: (...args: unknown[]) => fetchMemberProfile(...args),
		discordAccountId: (...args: unknown[]) => discordAccountId(...args)
	};
});

const { load } = await import('./+page.server');
const { STATS_CACHE_SECONDS, STATS_UNAVAILABLE_CACHE_SECONDS } =
	await import('$lib/server/guild-stats');
const { UNAVAILABLE_PROFILE } = await import('$lib/server/member-profile');

const stats = (over = {}) => ({
	snapshot: { members: 120, online: 18, bots: 4, humans: 116 },
	days: [],
	available: true,
	...over
});

const profile = (over = {}) => ({ ...UNAVAILABLE_PROFILE, available: true, member: true, ...over });

function kvStore() {
	const store = new Map<string, string>();
	return {
		store,
		puts: [] as { key: string; ttl: number | undefined }[],
		async get(key: string, type: string) {
			const raw = store.get(key);
			if (!raw) return null;
			return type === 'json' ? JSON.parse(raw) : raw;
		},
		async put(this: any, key: string, value: string, options?: { expirationTtl?: number }) {
			store.set(key, value);
			this.puts.push({ key, ttl: options?.expirationTtl });
		}
	};
}

const DB = { it: 'is a database' };

const setHeaders = vi.fn();

const run = (options: { kv?: unknown; user?: unknown } = {}) =>
	load({
		platform: { env: { KV: options.kv, DB } },
		locals: { user: options.user },
		setHeaders
	} as never) as Promise<{
		stats: ReturnType<typeof stats>;
		profile: typeof UNAVAILABLE_PROFILE;
		signedIn: boolean;
		discordLinked: boolean;
	}>;

beforeEach(() => {
	fetchGuildStats.mockReset().mockResolvedValue(stats());
	fetchMemberProfile.mockReset().mockResolvedValue(profile());
	discordAccountId.mockReset().mockResolvedValue(null);
	getSpaceBotConfig.mockClear();
	setHeaders.mockClear();
});

describe('stats load', () => {
	it('gives a signed-out visitor the whole public page', async () => {
		const data = await run();

		expect(data.stats.available).toBe(true);
		expect(data.signedIn).toBe(false);
		expect(data.discordLinked).toBe(false);
		// No session, no id to ask about, so SpaceBot is never asked.
		expect(fetchMemberProfile).not.toHaveBeenCalled();
		expect(data.profile.member).toBe(false);
	});

	it('never lets any cache store the page', async () => {
		await run();
		// The page carries the signed-in nav and, for a member, their own
		// figures. A stored copy is a copy of one person.
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});

	it('asks SpaceBot once and shares the server figures in KV', async () => {
		const kv = kvStore();
		await run({ kv });

		expect(fetchGuildStats).toHaveBeenCalledTimes(1);
		expect(kv.puts).toEqual([{ key: 'guild:stats', ttl: STATS_CACHE_SECONDS * 2 }]);

		await run({ kv });
		expect(fetchGuildStats).toHaveBeenCalledTimes(1);
	});

	it('holds a failed read only briefly', async () => {
		const kv = kvStore();
		fetchGuildStats.mockResolvedValue(stats({ available: false, snapshot: null }));
		await run({ kv });

		// Long enough that an outage does not queue every visitor behind their
		// own timeout; short enough that recovery shows up within minutes.
		expect(kv.puts[0].ttl).toBe(STATS_UNAVAILABLE_CACHE_SECONDS * 2);
	});

	it('asks SpaceBot again when the cached entry has gone stale', async () => {
		const kv = kvStore();
		kv.store.set(
			'guild:stats',
			JSON.stringify({ at: Date.now() - 999_999, ttl: STATS_CACHE_SECONDS, stats: stats() })
		);

		await run({ kv });
		expect(fetchGuildStats).toHaveBeenCalledTimes(1);
	});

	it('renders when KV itself is broken, in either direction', async () => {
		// A cache that cannot be read or written is a slower page, not a failed
		// one. Both halves are separate `catch`es because they fail separately.
		const broken = {
			async get() {
				throw new Error('KV is having a day');
			},
			async put() {
				throw new Error('KV is having a day');
			}
		};

		const data = await run({ kv: broken });
		expect(data.stats.available).toBe(true);
		expect(fetchGuildStats).toHaveBeenCalledTimes(1);
	});

	it('works with no KV at all, asking every time', async () => {
		await run();
		await run();
		expect(fetchGuildStats).toHaveBeenCalledTimes(2);
	});

	it('renders the public half when the server figures fail outright', async () => {
		fetchGuildStats.mockRejectedValue(new Error('SpaceBot fell over'));
		const data = await run();
		expect(data.stats.available).toBe(false);
	});

	it('takes the Discord id from the session row, not from anything sent', async () => {
		discordAccountId.mockResolvedValue('123456789012345678');
		await run({ user: { id: 'user-1' } });

		// The database and the session's user id, and nothing else.
		expect(discordAccountId).toHaveBeenCalledWith(DB, 'user-1');
		expect(fetchMemberProfile).toHaveBeenCalledWith(
			{ apiUrl: 'https://bot.test', apiKey: 'sb_live_x' },
			'123456789012345678'
		);
	});

	it('never caches one person figures', async () => {
		const kv = kvStore();
		discordAccountId.mockResolvedValue('123456789012345678');
		await run({ kv, user: { id: 'user-1' } });

		expect(kv.puts.map((put) => put.key)).toEqual(['guild:stats']);
		expect([...kv.store.keys()]).toEqual(['guild:stats']);
	});

	it('reports a signed-in user who never linked Discord', async () => {
		discordAccountId.mockResolvedValue(null);
		const data = await run({ user: { id: 'user-1' } });

		expect(data.signedIn).toBe(true);
		expect(data.discordLinked).toBe(false);
		expect(fetchMemberProfile).not.toHaveBeenCalled();
	});

	it('keeps the page when the personal read fails', async () => {
		discordAccountId.mockResolvedValue('123456789012345678');
		fetchMemberProfile.mockRejectedValue(new Error('403'));
		const data = await run({ user: { id: 'user-1' } });

		expect(data.stats.available).toBe(true);
		expect(data.discordLinked).toBe(true);
		expect(data.profile.available).toBe(false);
	});
});
