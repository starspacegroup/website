import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { _resetReadCache } from '../../src/lib/server/read-cache';
import {
	_resetContentTypesSynced,
	buildLayoutChrome,
	LAYOUT_CHROME_KEY,
	LAYOUT_CHROME_SECONDS,
	loadLayoutChrome
} from '../../src/lib/server/layout-chrome';
import { hasEnabledAiProvider } from '../../src/lib/server/ai-provider-status';

/**
 * The root layout's shared data (src/lib/server/layout-chrome.ts). It used to cost
 * a self-request, a content-type sync, the palette query and 2+ KV reads on EVERY
 * page view. Now: no self-request, the sync once per isolate, one shared copy for
 * visitors, fresh (and re-primed) for admins. Ported from the Pinfool fork (fba97dc).
 */

/** A KV that counts reads. */
function kvWith(values: Record<string, string>) {
	const store = new Map(Object.entries(values));
	const get = vi.fn(async (k: string) => store.get(k) ?? null);
	return { kv: { get, put: vi.fn(), delete: vi.fn() }, get, store };
}

/** A D1 that counts the statements it is asked to prepare. */
function counting(db: D1Database) {
	const seen: string[] = [];
	const proxy = new Proxy(db as object, {
		get(target, prop, receiver) {
			if (prop === 'prepare')
				return (sql: string) => {
					seen.push(sql);
					return (target as D1Database).prepare(sql);
				};
			return Reflect.get(target, prop, receiver);
		}
	}) as D1Database;
	return { db: proxy, seen };
}

/** A fake Cache API so `cached()` actually caches, as it does on Workers. */
function fakeEdgeCache() {
	const store = new Map<string, string>();
	return {
		store,
		default: {
			match: vi.fn(async (req: Request) =>
				store.has(req.url) ? new Response(store.get(req.url)) : undefined
			),
			put: vi.fn(async (req: Request, res: Response) => void store.set(req.url, await res.text()))
		}
	};
}

const AI_ON = { ai_keys_list: '["k1"]', 'ai_key:k1': JSON.stringify({ enabled: true }) };

beforeEach(() => {
	vi.restoreAllMocks();
	_resetReadCache();
	_resetContentTypesSynced();
});
afterEach(() => vi.unstubAllGlobals());

describe('hasEnabledAiProvider', () => {
	it('is true for a stored key not switched off, false otherwise, and never throws', async () => {
		expect(await hasEnabledAiProvider(kvWith(AI_ON).kv as never)).toBe(true);
		expect(
			await hasEnabledAiProvider(
				kvWith({ ai_keys_list: '["k1"]', 'ai_key:k1': '{"enabled":false}' }).kv as never
			)
		).toBe(false);
		expect(await hasEnabledAiProvider(kvWith({}).kv as never)).toBe(false);
		expect(await hasEnabledAiProvider(undefined)).toBe(false);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await hasEnabledAiProvider(kvWith({ ai_keys_list: 'not json' }).kv as never)).toBe(
			false
		);
	});
});

describe('buildLayoutChrome', () => {
	it('reads the AI flag and palette items with no self-request', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		const { kv } = kvWith(AI_ON);
		const chrome = await buildLayoutChrome({ env: { DB: createSqliteD1(), KV: kv } });
		expect(chrome.hasAIProviders).toBe(true);
		expect(Array.isArray(chrome.cmsPaletteItems)).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('has safe defaults with no bindings, and when the palette query fails', async () => {
		expect(await buildLayoutChrome(undefined)).toEqual({
			hasAIProviders: false,
			cmsPaletteItems: []
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = {
			prepare: () => {
				throw new Error('D1 down');
			}
		};
		const chrome = await buildLayoutChrome({ env: { DB: broken } });
		expect(chrome.cmsPaletteItems).toEqual([]);
	});

	it('syncs the content-type registry once per isolate, and retries after a failure', async () => {
		const { db, seen } = counting(createSqliteD1());
		await buildLayoutChrome({ env: { DB: db } });
		const syncs = () =>
			seen.filter((s) => /FROM content_types\b/i.test(s) && !/JOIN/i.test(s)).length;
		const first = syncs();
		expect(first).toBeGreaterThan(0);
		await buildLayoutChrome({ env: { DB: db } });
		await buildLayoutChrome({ env: { DB: db } });
		expect(syncs()).toBe(first);

		_resetContentTypesSynced();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let fail = true;
		const flaky = new Proxy(db as object, {
			get(target, prop, receiver) {
				if (prop === 'prepare' && fail) {
					return () => {
						throw new Error('D1 down');
					};
				}
				return Reflect.get(target, prop, receiver);
			}
		}) as D1Database;
		await buildLayoutChrome({ env: { DB: flaky } });
		fail = false;
		const before = syncs();
		await buildLayoutChrome({ env: { DB: flaky } });
		expect(syncs()).toBeGreaterThan(before);
	});
});

describe('loadLayoutChrome caching', () => {
	it('uses one versioned shared key with a five-minute life', () => {
		expect(LAYOUT_CHROME_KEY).toMatch(/^layout:chrome:v\d+$/);
		expect(LAYOUT_CHROME_SECONDS).toBe(300);
	});

	it('visitors share one copy: the second view reads no KV and no D1', async () => {
		vi.stubGlobal('caches', fakeEdgeCache());
		const { kv, get } = kvWith(AI_ON);
		const { db, seen } = counting(createSqliteD1());
		const platform = { env: { DB: db, KV: kv } };
		const first = await loadLayoutChrome(platform, false);
		const reads = get.mock.calls.length;
		const statements = seen.length;
		const second = await loadLayoutChrome(platform, false);
		expect(second).toEqual(first);
		expect(get.mock.calls.length).toBe(reads);
		expect(seen.length).toBe(statements);
	});

	it('an admin reads fresh, and that copy replaces the shared one for visitors', async () => {
		vi.stubGlobal('caches', fakeEdgeCache());
		const { kv, store } = kvWith({});
		const platform = { env: { DB: createSqliteD1(), KV: kv } };
		expect((await loadLayoutChrome(platform, false)).hasAIProviders).toBe(false);
		// The owner adds an AI key.
		store.set('ai_keys_list', '["k1"]');
		store.set('ai_key:k1', '{"enabled":true}');
		// Visitors still get the shared copy until it expires...
		expect((await loadLayoutChrome(platform, false)).hasAIProviders).toBe(false);
		// ...the admin sees the change at once, and refreshes the shared copy.
		expect((await loadLayoutChrome(platform, true)).hasAIProviders).toBe(true);
		expect((await loadLayoutChrome(platform, false)).hasAIProviders).toBe(true);
	});

	it('property: whatever the order of admin and visitor loads, a visitor after an admin sees what the admin saw', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.tuple(fc.boolean(), fc.boolean()), { maxLength: 12 }),
				async (steps) => {
					_resetReadCache();
					vi.stubGlobal('caches', fakeEdgeCache());
					const { kv, store } = kvWith({});
					const platform = { env: { KV: kv } };
					let lastAdmin: boolean | null = null;
					for (const [admin, toggle] of steps) {
						if (toggle) {
							if (store.has('ai_keys_list')) store.delete('ai_keys_list');
							else {
								store.set('ai_keys_list', '["k1"]');
								store.set('ai_key:k1', '{}');
							}
						}
						const seen = (await loadLayoutChrome(platform, admin)).hasAIProviders;
						if (admin) {
							expect(seen).toBe(store.has('ai_keys_list'));
							lastAdmin = seen;
						} else if (lastAdmin !== null && !toggle) {
							expect(seen).toBe(lastAdmin);
						}
					}
				}
			),
			{ numRuns: 60 }
		);
	});
});

describe('root +layout.server load', () => {
	it('returns the user and the chrome, depends on app:palette, and makes no self-request', async () => {
		const fetchSpy = vi.fn();
		const depends = vi.fn();
		const { load } = await import('../../src/routes/+layout.server');
		const user = { id: 'user-123', isAdmin: false };
		const result = (await load({
			locals: { user },
			platform: { env: { KV: kvWith(AI_ON).kv } },
			fetch: fetchSpy,
			depends
		} as never)) as Record<string, unknown>;
		expect(result.user).toEqual(user);
		expect(result.hasAIProviders).toBe(true);
		expect(result.cmsPaletteItems).toEqual([]);
		expect(depends).toHaveBeenCalledWith('app:palette');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns a null user when signed out, and reads fresh for an admin or owner', async () => {
		const { load } = await import('../../src/routes/+layout.server');
		const signedOut = (await load({ locals: {}, platform: undefined } as never)) as Record<
			string,
			unknown
		>;
		expect(signedOut.user).toBeNull();
		for (const user of [
			{ id: 'a', isAdmin: true },
			{ id: 'o', isOwner: true }
		]) {
			const r = (await load({ locals: { user }, platform: undefined } as never)) as Record<
				string,
				unknown
			>;
			expect(r.user).toEqual(user);
		}
	});
});
