import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above every const in this file, so the spy has to be
// created inside vi.hoisted or the factory closes over a dead binding.
const { fetchVoiceSnapshot } = vi.hoisted(() => ({ fetchVoiceSnapshot: vi.fn() }));

vi.mock('$lib/server/voice-channel', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/voice-channel')>(
		'$lib/server/voice-channel'
	);
	return { ...actual, fetchVoiceSnapshot };
});

import { GET } from '../../src/routes/api/voice/+server';

const LIVE = {
	live: true,
	channel: 'Ten Forward',
	members: [{ name: 'nova', avatar: null, streaming: false, video: false, muted: false }],
	updatedAt: null
};

/** A KV double that records what it was asked to store. */
function createKv(initial: string | null = null) {
	const store = { value: initial, puts: [] as { key: string; value: string; opts: unknown }[] };
	return {
		store,
		get: vi.fn(async () => (store.value === null ? null : JSON.parse(store.value))),
		put: vi.fn(async (key: string, value: string, opts: unknown) => {
			store.puts.push({ key, value, opts });
			store.value = value;
		})
	};
}

function call(platform: unknown) {
	return GET({ platform } as never);
}

describe('GET /api/voice', () => {
	beforeEach(() => {
		fetchVoiceSnapshot.mockReset();
		fetchVoiceSnapshot.mockResolvedValue({ live: false });
	});

	it('answers with the snapshot and a short public cache window', async () => {
		fetchVoiceSnapshot.mockResolvedValue(LIVE);
		const response = await call({ env: {} });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(LIVE);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=10, stale-while-revalidate=30'
		);
	});

	it('works with no KV binding at all', async () => {
		const response = await call({ env: {} });
		expect(await response.json()).toEqual({ live: false });
		expect(fetchVoiceSnapshot).toHaveBeenCalledTimes(1);
	});

	it('serves a fresh cache entry without touching SpaceBot', async () => {
		const kv = createKv(JSON.stringify({ at: Date.now(), snapshot: LIVE }));
		const response = await call({ env: { KV: kv } });

		expect(await response.json()).toEqual(LIVE);
		expect(fetchVoiceSnapshot).not.toHaveBeenCalled();
	});

	it('refetches once the entry is older than the cache window', async () => {
		// KV cannot expire a key in under a minute, so staleness is decided here.
		const kv = createKv(JSON.stringify({ at: Date.now() - 11_000, snapshot: LIVE }));
		fetchVoiceSnapshot.mockResolvedValue({ live: false });

		expect(await (await call({ env: { KV: kv } })).json()).toEqual({ live: false });
		expect(fetchVoiceSnapshot).toHaveBeenCalledTimes(1);
	});

	it('stores the new snapshot with a timestamp and the 60s KV floor', async () => {
		const kv = createKv();
		fetchVoiceSnapshot.mockResolvedValue(LIVE);
		await call({ env: { KV: kv } });

		expect(kv.store.puts).toHaveLength(1);
		const [put] = kv.store.puts;
		expect(put.key).toBe('voice:ten-forward');
		expect(put.opts).toEqual({ expirationTtl: 60 });
		const entry = JSON.parse(put.value);
		expect(entry.snapshot).toEqual(LIVE);
		expect(typeof entry.at).toBe('number');
	});

	it('still answers when KV reads fail', async () => {
		const kv = createKv();
		kv.get.mockRejectedValue(new Error('KV down'));
		fetchVoiceSnapshot.mockResolvedValue(LIVE);

		expect(await (await call({ env: { KV: kv } })).json()).toEqual(LIVE);
	});

	it('still answers when KV writes fail', async () => {
		const kv = createKv();
		kv.put.mockRejectedValue(new Error('KV down'));
		fetchVoiceSnapshot.mockResolvedValue(LIVE);

		expect(await (await call({ env: { KV: kv } })).json()).toEqual(LIVE);
	});

	it('survives a platform that is missing entirely', async () => {
		expect(await (await call(undefined)).json()).toEqual({ live: false });
	});
});
