import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The guide's daily cache. What matters here is not the directory itself —
 * `guild-directory.test.ts` covers that — but that a visitor never waits on
 * SpaceBot when a fresh answer is already in KV, and that a SpaceBot outage is
 * held only briefly instead of for a day.
 */

const fetchGuildDirectory = vi.fn();
const getSpaceBotConfig = vi.fn(async () => ({ apiUrl: 'https://bot.test', apiKey: 'sb_live_x' }));

vi.mock('$lib/server/spacebot-connection', () => ({
	getSpaceBotConfig: (...args: unknown[]) => getSpaceBotConfig(...(args as []))
}));

vi.mock('$lib/server/guild-directory', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return { ...actual, fetchGuildDirectory: (...args: unknown[]) => fetchGuildDirectory(...args) };
});

const { load } = await import('./+page.server');
type GuildDirectory = import('$lib/server/guild-directory').GuildDirectory;
const { DIRECTORY_CACHE_SECONDS, EMPTY_DIRECTORY } = await import('$lib/server/guild-directory');

const directory = (over = {}) => ({
	categories: [{ name: 'Lobby', channels: [] }],
	commands: [],
	syncedAt: '2026-09-07 12:00:00',
	activityDays: 30,
	timezone: 'America/New_York',
	available: true,
	...over
});

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
		},
		fail: false
	};
}

/** `load` is typed `void | PageData`; every case here takes the returning path. */
const run = (kv: unknown) =>
	load({
		platform: kv ? { env: { KV: kv } } : undefined,
		setHeaders: vi.fn()
	} as never) as Promise<{
		directory: GuildDirectory;
	}>;

beforeEach(() => {
	fetchGuildDirectory.mockReset();
	fetchGuildDirectory.mockResolvedValue(directory());
	getSpaceBotConfig.mockClear();
});

describe('guide load', () => {
	it('asks SpaceBot when nothing is cached, and stores the answer for a day', async () => {
		const kv = kvStore();
		const result = await run(kv);

		expect(result.directory.available).toBe(true);
		expect(fetchGuildDirectory).toHaveBeenCalledTimes(1);
		expect(kv.puts[0].key).toBe('guild:directory');
		expect(kv.puts[0].ttl).toBe(DIRECTORY_CACHE_SECONDS * 2);
	});

	it('serves a fresh cache without touching SpaceBot', async () => {
		const kv = kvStore();
		kv.store.set(
			'guild:directory',
			JSON.stringify({ at: Date.now(), ttl: DIRECTORY_CACHE_SECONDS, directory: directory() })
		);

		await run(kv);
		expect(fetchGuildDirectory).not.toHaveBeenCalled();
	});

	it('asks again once the cache is stale', async () => {
		const kv = kvStore();
		kv.store.set(
			'guild:directory',
			JSON.stringify({
				at: Date.now() - (DIRECTORY_CACHE_SECONDS + 60) * 1000,
				ttl: DIRECTORY_CACHE_SECONDS,
				directory: directory()
			})
		);

		await run(kv);
		expect(fetchGuildDirectory).toHaveBeenCalledTimes(1);
	});

	it('holds an unavailable directory briefly, not for a day', async () => {
		// Otherwise one SpaceBot blip takes the page out until tomorrow.
		fetchGuildDirectory.mockResolvedValue(EMPTY_DIRECTORY);
		const kv = kvStore();
		await run(kv);

		expect(kv.puts[0].ttl).toBe(600);

		const entry = JSON.parse(kv.store.get('guild:directory') as string);
		expect(entry.ttl).toBe(300);
	});

	it('re-asks after a cached failure goes stale, on the short clock', async () => {
		const kv = kvStore();
		kv.store.set(
			'guild:directory',
			JSON.stringify({ at: Date.now() - 400 * 1000, ttl: 300, directory: EMPTY_DIRECTORY })
		);

		await run(kv);
		expect(fetchGuildDirectory).toHaveBeenCalledTimes(1);
	});

	it('works with no KV binding at all', async () => {
		const result = await run(null);
		expect(result.directory.available).toBe(true);
		expect(fetchGuildDirectory).toHaveBeenCalledTimes(1);
	});

	it('renders rather than throwing when the read itself fails', async () => {
		fetchGuildDirectory.mockRejectedValue(new Error('boom'));
		const result = await run(kvStore());
		expect(result.directory).toEqual(EMPTY_DIRECTORY);
	});

	it('survives a KV that throws on read or write', async () => {
		const kv = {
			get: async () => {
				throw new Error('kv down');
			},
			put: async () => {
				throw new Error('kv down');
			}
		};
		const result = await run(kv);
		expect(result.directory.available).toBe(true);
	});

	it('ignores a cache entry that is not shaped like one', async () => {
		const kv = kvStore();
		kv.store.set('guild:directory', JSON.stringify({ nonsense: true }));
		await run(kv);
		expect(fetchGuildDirectory).toHaveBeenCalledTimes(1);
	});

	/**
	 * A document a browser considers fresh is one it will not ask about. The
	 * guide went out with a day's max-age while it was unavailable, and after
	 * SpaceBot was connected it was blank on first load and correct on refresh —
	 * refreshing being the one thing that bypasses a fresh cache entry.
	 */
	it('never lets a browser hold the page without asking', async () => {
		for (const answer of [directory(), EMPTY_DIRECTORY]) {
			fetchGuildDirectory.mockResolvedValue(answer);
			const setHeaders = vi.fn();
			await load({ platform: undefined, setHeaders } as never);
			expect(setHeaders.mock.calls[0][0]['cache-control']).toContain('no-store');
		}
	});

	/**
	 * Every page carries the nav bar, rendered server-side with the signed-in
	 * user. A shared cache that stored this HTML would hand one visitor's nav to
	 * the next — which it did: with `public, s-maxage` the edge served its stored
	 * copy on refresh and the nav forgot who you were. The response must be
	 * `private` on every path, so no shared cache ever holds it.
	 */
	it('is never shared-cacheable, so the nav is never served across users', async () => {
		const cases: Array<GuildDirectory | 'kv-hit'> = [directory(), EMPTY_DIRECTORY, 'kv-hit'];
		for (const answer of cases) {
			const kv = kvStore();
			if (answer === 'kv-hit') {
				kv.store.set(
					'guild:directory',
					JSON.stringify({ at: Date.now(), ttl: 300, directory: directory() })
				);
			} else {
				fetchGuildDirectory.mockResolvedValue(answer);
			}
			const setHeaders = vi.fn();
			await load({ platform: { env: { KV: kv } }, setHeaders } as never);

			const header = setHeaders.mock.calls[0][0]['cache-control'];
			expect(header).toContain('private');
			expect(header).not.toContain('public');
			expect(header).not.toContain('s-maxage');
		}
	});

	it('caches the directory server-side in KV, where the sharing belongs', async () => {
		// Dropping the edge cache costs nothing: the one expensive part, the read
		// from SpaceBot, is still held in KV and shared across every request.
		const kv = kvStore();
		kv.store.set(
			'guild:directory',
			JSON.stringify({ at: Date.now(), ttl: 300, directory: EMPTY_DIRECTORY })
		);
		const setHeaders = vi.fn();
		await load({ platform: { env: { KV: kv } }, setHeaders } as never);
		expect(fetchGuildDirectory).not.toHaveBeenCalled();
	});
});
