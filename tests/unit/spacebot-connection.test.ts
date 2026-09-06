import {
	clearSpaceBotConnection,
	DEFAULT_CHANNEL,
	getSpaceBotConfig,
	KEY_PATTERN,
	maskKey,
	normalizeApiUrl,
	saveSpaceBotConnection,
	SPACEBOT_KV_KEY,
	verifySpaceBot
} from '$lib/server/spacebot-connection';
import { describe, expect, it, vi } from 'vitest';

const KEY = `sb_live_${'a1b2c3d4'.repeat(4)}`;

/** A KV double: `get` returns whatever is in `store`, writes are recorded. */
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

const connection = (over: Record<string, unknown> = {}) =>
	JSON.stringify({
		apiUrl: 'https://bot.example',
		apiKey: KEY,
		channel: 'Ten Forward',
		connectedAt: '2026-09-05T00:00:00.000Z',
		...over
	});

describe('getSpaceBotConfig', () => {
	it('prefers what the admin page stored over the environment', async () => {
		const kv = createKv({ [SPACEBOT_KV_KEY]: connection({ channel: 'Engineering' }) });
		const config = await getSpaceBotConfig({
			env: { KV: kv, SPACEBOT_API_URL: 'https://env.example', SPACEBOT_API_KEY: 'sb_live_env' }
		} as never);

		expect(config).toEqual({
			apiUrl: 'https://bot.example',
			apiKey: KEY,
			channel: 'Engineering',
			source: 'kv',
			connectedAt: '2026-09-05T00:00:00.000Z'
		});
	});

	it('falls back to the environment when nothing is connected', async () => {
		const config = await getSpaceBotConfig({
			env: {
				KV: createKv(),
				SPACEBOT_API_URL: 'https://env.example',
				SPACEBOT_API_KEY: 'sb_live_env',
				SPACEBOT_VOICE_CHANNEL: '  Lounge  '
			}
		} as never);

		expect(config).toMatchObject({
			apiUrl: 'https://env.example',
			apiKey: 'sb_live_env',
			channel: 'Lounge',
			source: 'env',
			connectedAt: null
		});
	});

	it('does not mix a half-written record with the environment', async () => {
		// A record missing its key is a mistake to surface, not one to paper over
		// with a different deployment's credentials.
		const kv = createKv({ [SPACEBOT_KV_KEY]: JSON.stringify({ apiUrl: 'https://bot.example' }) });
		const config = await getSpaceBotConfig({
			env: { KV: kv, SPACEBOT_API_URL: 'https://env.example', SPACEBOT_API_KEY: 'sb_live_env' }
		} as never);
		expect(config.source).toBe('env');
		expect(config.apiUrl).toBe('https://env.example');
	});

	it('reports nothing configured, with the default channel', async () => {
		expect(await getSpaceBotConfig(undefined)).toEqual({
			apiUrl: undefined,
			apiKey: undefined,
			channel: DEFAULT_CHANNEL,
			source: 'none',
			connectedAt: null
		});
		expect(await getSpaceBotConfig({ env: { KV: createKv() } } as never)).toMatchObject({
			source: 'none'
		});
	});

	it('survives a KV read failure by falling through to the environment', async () => {
		const kv = createKv();
		kv.get.mockRejectedValue(new Error('KV down'));
		const config = await getSpaceBotConfig({
			env: { KV: kv, SPACEBOT_API_URL: 'https://env.example', SPACEBOT_API_KEY: 'sb_live_env' }
		} as never);
		expect(config.source).toBe('env');
	});
});

describe('normalizeApiUrl', () => {
	it('keeps the origin and throws away the rest of a pasted URL', () => {
		expect(normalizeApiUrl('  https://bot.example/admin/123/api-keys?x=1  ')).toBe(
			'https://bot.example'
		);
		expect(normalizeApiUrl('https://bot.example/')).toBe('https://bot.example');
	});

	it('requires https, except on localhost — the key rides in a header', () => {
		expect(normalizeApiUrl('http://bot.example')).toBeNull();
		expect(normalizeApiUrl('http://localhost:4269')).toBe('http://localhost:4269');
		expect(normalizeApiUrl('http://127.0.0.1:4269')).toBe('http://127.0.0.1:4269');
	});

	it('rejects what is not a URL at all', () => {
		for (const bad of ['', 'bot.example', 'not a url', 'javascript:alert(1)']) {
			expect(normalizeApiUrl(bad), bad).toBeNull();
		}
	});
});

describe('maskKey', () => {
	it('shows enough to recognise a key and not enough to use one', () => {
		const masked = maskKey(KEY);
		expect(masked.startsWith('sb_live_a1b2')).toBe(true);
		expect(masked.endsWith(KEY.slice(-4))).toBe(true);
		expect(masked).not.toContain(KEY.slice(12, -4));
	});

	it('does not spill a short string it cannot mask', () => {
		expect(maskKey('sb_live_')).toBe('sb_live_…');
	});
});

describe('KEY_PATTERN', () => {
	it('accepts a SpaceBot key and rejects the usual paste mistakes', () => {
		expect(KEY_PATTERN.test(KEY)).toBe(true);
		for (const bad of ['', 'sb_live_', 'sb_test_abcdef0123456789', KEY.toUpperCase(), `${KEY} `]) {
			expect(KEY_PATTERN.test(bad), bad).toBe(false);
		}
	});
});

describe('verifySpaceBot', () => {
	const config = {
		apiUrl: 'https://bot.example',
		apiKey: KEY,
		channel: 'Ten Forward',
		source: 'kv' as const,
		connectedAt: null
	};

	/** Answer each probe by the path it asks for. */
	function router(routes: Record<'voice' | 'stats', { status: number; body?: unknown }>) {
		return vi.fn(async (url: string) => {
			const which = url.includes('/api/v1/voice') ? 'voice' : 'stats';
			const route = routes[which];
			return {
				status: route.status,
				ok: route.status === 200,
				json: async () => route.body ?? {}
			};
		}) as unknown as typeof fetch;
	}

	it('reports both scopes working, with what each returned', async () => {
		const status = await verifySpaceBot(
			config,
			router({
				voice: { status: 200, body: { channels: [{ members: [1, 2, 3] }, { members: [4] }] } },
				stats: { status: 200, body: { points: [1, 2, 3, 4, 5] } }
			})
		);

		expect(status).toMatchObject({
			connected: true,
			voice: 'ok',
			stats: 'ok',
			inVoice: 4,
			historyDays: 5,
			apiUrl: 'https://bot.example',
			channel: 'Ten Forward'
		});
		expect(status.keyHint).toBe(maskKey(KEY));
		expect(status.checkedAt).not.toBeNull();
	});

	it('tells a missing scope apart from a bad key — the two need different fixes', async () => {
		const half = await verifySpaceBot(
			config,
			router({ voice: { status: 200, body: { channels: [] } }, stats: { status: 403 } })
		);
		expect(half).toMatchObject({ connected: true, voice: 'ok', stats: 'forbidden', inVoice: 0 });
		expect(half.historyDays).toBeNull();

		const rejected = await verifySpaceBot(
			config,
			router({ voice: { status: 401 }, stats: { status: 401 } })
		);
		expect(rejected).toMatchObject({ connected: false, voice: 'unauthorized' });
	});

	it('reports an unreachable bot and an error status distinctly', async () => {
		const dead = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		}) as unknown as typeof fetch;
		expect(await verifySpaceBot(config, dead)).toMatchObject({
			connected: false,
			voice: 'unreachable',
			stats: 'unreachable'
		});

		expect(
			await verifySpaceBot(config, router({ voice: { status: 500 }, stats: { status: 500 } }))
		).toMatchObject({ voice: 'error', stats: 'error' });
	});

	it('treats a 200 that is not JSON as an error, not as working', async () => {
		const broken = vi.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => {
				throw new SyntaxError('<');
			}
		})) as unknown as typeof fetch;
		expect(await verifySpaceBot(config, broken)).toMatchObject({ voice: 'error', stats: 'error' });
	});

	it('says unconfigured, and asks nothing of the network, with no credentials', async () => {
		const fetcher = vi.fn() as unknown as typeof fetch;
		const status = await verifySpaceBot(
			{ channel: DEFAULT_CHANNEL, source: 'none', connectedAt: null },
			fetcher
		);
		expect(status).toMatchObject({
			connected: false,
			voice: 'unconfigured',
			stats: 'unconfigured',
			keyHint: null,
			checkedAt: null
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('asks about the configured channel, url-encoded', async () => {
		const fetcher = router({ voice: { status: 200 }, stats: { status: 200 } });
		await verifySpaceBot({ ...config, channel: 'Ten Forward' }, fetcher);
		const urls = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => u);
		expect(urls).toContain('https://bot.example/api/v1/voice?channel=Ten%20Forward');
		expect(urls).toContain('https://bot.example/api/v1/stats/members?period=24h&granularity=daily');
	});
});

describe('saveSpaceBotConnection / clearSpaceBotConnection', () => {
	it('stores the connection with the moment it was made', async () => {
		const kv = createKv();
		await saveSpaceBotConnection({ env: { KV: kv } } as never, {
			apiUrl: 'https://bot.example',
			apiKey: KEY,
			channel: 'Ten Forward'
		});

		const stored = JSON.parse(kv.store.get(SPACEBOT_KV_KEY) as string);
		expect(stored).toMatchObject({ apiUrl: 'https://bot.example', apiKey: KEY });
		expect(Date.parse(stored.connectedAt)).not.toBeNaN();
	});

	it('drops the cached snapshots along with the key', async () => {
		// Otherwise the hero keeps showing live faces for ten minutes after
		// somebody disconnects — the one moment they are watching it stop.
		const kv = createKv({
			[SPACEBOT_KV_KEY]: connection(),
			'voice:ten-forward': '{}',
			'members:history': '{}'
		});
		await clearSpaceBotConnection({ env: { KV: kv } } as never);
		expect([...kv.store.keys()]).toEqual([]);
	});

	it('refuses to pretend it worked without KV', async () => {
		await expect(
			saveSpaceBotConnection(undefined, { apiUrl: 'x', apiKey: KEY, channel: 'c' })
		).rejects.toThrow(/KV/);
		await expect(clearSpaceBotConnection(undefined)).rejects.toThrow(/KV/);
	});
});
