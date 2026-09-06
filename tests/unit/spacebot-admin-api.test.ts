import { SPACEBOT_KV_KEY } from '$lib/server/spacebot-connection';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '../../src/routes/api/admin/spacebot/+server';

const KEY = `sb_live_${'a1b2c3d4'.repeat(4)}`;
const OWNER = { user: { id: '1', isOwner: true } } as never;
const ADMIN = { user: { id: '2', isOwner: false, isAdmin: true } } as never;

function createKv(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		store,
		get: vi.fn(async (key: string, type?: string) => {
			const raw = store.get(key);
			if (raw === undefined) return null;
			return type === 'json' ? JSON.parse(raw) : raw;
		}),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		delete: vi.fn(async (key: string) => {
			store.delete(key);
		})
	};
}

/** Answer SpaceBot's two probes with the given statuses. */
function spacebot(voice: number, stats = voice, body: unknown = {}) {
	return vi.fn(async (url: string) => {
		const status = String(url).includes('/api/v1/voice') ? voice : stats;
		return { status, ok: status === 200, json: async () => body };
	});
}

function call(
	handler: typeof GET,
	{ kv, locals = OWNER, body }: { kv?: unknown; locals?: unknown; body?: unknown } = {}
) {
	return handler({
		platform: kv ? { env: { KV: kv } } : { env: {} },
		locals,
		request: { json: async () => body }
	} as never);
}

async function statusOf(response: Response) {
	return (await response.json()).status;
}

describe('/api/admin/spacebot', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	describe('authorization', () => {
		it('is owner-only on every method — it handles a credential', async () => {
			const kv = createKv();
			for (const handler of [GET, POST, DELETE]) {
				await expect(call(handler, { kv, locals: ADMIN })).rejects.toMatchObject({ status: 403 });
				await expect(
					call(handler, { kv, locals: { user: undefined } as never })
				).rejects.toMatchObject({ status: 401 });
			}
		});
	});

	describe('GET', () => {
		it('reports an unconfigured site without touching the network', async () => {
			const fetcher = vi.fn();
			vi.stubGlobal('fetch', fetcher);
			const status = await statusOf(await call(GET, { kv: createKv() }));

			expect(status).toMatchObject({ connected: false, source: 'none', keyHint: null });
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('verifies a stored connection and masks the key', async () => {
			vi.stubGlobal('fetch', spacebot(200, 200, { channels: [], points: [] }));
			const kv = createKv({
				[SPACEBOT_KV_KEY]: JSON.stringify({
					apiUrl: 'https://bot.example',
					apiKey: KEY,
					channel: 'Ten Forward',
					connectedAt: '2026-09-05T00:00:00.000Z'
				})
			});

			const status = await statusOf(await call(GET, { kv }));
			expect(status).toMatchObject({ connected: true, source: 'kv', voice: 'ok', stats: 'ok' });
			expect(JSON.stringify(status)).not.toContain(KEY);
		});
	});

	describe('POST', () => {
		it('verifies before it stores, and never stores a rejected key', async () => {
			vi.stubGlobal('fetch', spacebot(401));
			const kv = createKv();
			await expect(
				call(POST, { kv, body: { apiUrl: 'https://bot.example', apiKey: KEY } })
			).rejects.toMatchObject({ status: 401 });
			expect(kv.store.has(SPACEBOT_KV_KEY)).toBe(false);
		});

		it('does not store a key when SpaceBot cannot be reached', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => {
					throw new Error('ECONNREFUSED');
				})
			);
			const kv = createKv();
			await expect(
				call(POST, { kv, body: { apiUrl: 'https://bot.example', apiKey: KEY } })
			).rejects.toMatchObject({ status: 502 });
			expect(kv.store.has(SPACEBOT_KV_KEY)).toBe(false);
		});

		it('DOES store a key that authenticates but is missing one scope', async () => {
			// Half the integration is worth having; the page says which half.
			vi.stubGlobal('fetch', spacebot(200, 403, { channels: [] }));
			const kv = createKv();
			const status = await statusOf(
				await call(POST, { kv, body: { apiUrl: 'https://bot.example', apiKey: KEY } })
			);

			expect(status).toMatchObject({ voice: 'ok', stats: 'forbidden', source: 'kv' });
			expect(JSON.parse(kv.store.get(SPACEBOT_KV_KEY) as string).apiKey).toBe(KEY);
		});

		it('cleans up what was pasted: origin only, no leading hash on the channel', async () => {
			vi.stubGlobal('fetch', spacebot(200, 200, { channels: [], points: [] }));
			const kv = createKv();
			await call(POST, {
				kv,
				body: {
					apiUrl: 'https://bot.example/admin/999/api-keys',
					apiKey: ` ${KEY} `,
					channel: '  #Engineering  '
				}
			});

			expect(JSON.parse(kv.store.get(SPACEBOT_KV_KEY) as string)).toMatchObject({
				apiUrl: 'https://bot.example',
				apiKey: KEY,
				channel: 'Engineering'
			});
		});

		it('defaults the channel when none is given', async () => {
			vi.stubGlobal('fetch', spacebot(200, 200, { channels: [], points: [] }));
			const kv = createKv();
			await call(POST, { kv, body: { apiUrl: 'https://bot.example', apiKey: KEY } });
			expect(JSON.parse(kv.store.get(SPACEBOT_KV_KEY) as string).channel).toBe('Ten Forward');
		});

		it('rejects a bad address or a key that is not one, before any request', async () => {
			const fetcher = vi.fn();
			vi.stubGlobal('fetch', fetcher);
			const kv = createKv();

			for (const body of [
				{ apiUrl: 'bot.example', apiKey: KEY },
				{ apiUrl: 'http://bot.example', apiKey: KEY },
				{ apiUrl: 'https://bot.example', apiKey: 'hunter2' },
				{ apiUrl: 'https://bot.example' },
				{}
			]) {
				await expect(call(POST, { kv, body })).rejects.toMatchObject({ status: 400 });
			}
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('rejects a body that is not JSON, and a site with no KV', async () => {
			await expect(
				POST({
					platform: { env: { KV: createKv() } },
					locals: OWNER,
					request: {
						json: async () => {
							throw new SyntaxError('no');
						}
					}
				} as never)
			).rejects.toMatchObject({ status: 400 });

			await expect(
				call(POST, { body: { apiUrl: 'https://bot.example', apiKey: KEY } })
			).rejects.toMatchObject({ status: 503 });
		});
	});

	describe('DELETE', () => {
		it('forgets the key and the caches built from it', async () => {
			const kv = createKv({
				[SPACEBOT_KV_KEY]: JSON.stringify({ apiUrl: 'https://bot.example', apiKey: KEY }),
				'voice:ten-forward': '{}',
				'members:history': '{}'
			});

			const status = await statusOf(await call(DELETE, { kv }));
			expect([...kv.store.keys()]).toEqual([]);
			expect(status).toMatchObject({ connected: false, source: 'none' });
		});

		it('needs KV to claim it disconnected anything', async () => {
			await expect(call(DELETE, {})).rejects.toMatchObject({ status: 503 });
		});
	});
});
