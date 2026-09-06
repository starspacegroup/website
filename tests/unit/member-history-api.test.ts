import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMemberHistory } = vi.hoisted(() => ({ fetchMemberHistory: vi.fn() }));

vi.mock('$lib/server/member-history', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/member-history')>(
		'$lib/server/member-history'
	);
	return { ...actual, fetchMemberHistory };
});

import { GET } from '../../src/routes/api/members/history/+server';

const HISTORY = {
	points: [
		{ day: '2026-09-01', members: 1000, online: null },
		{ day: '2026-09-02', members: 1003, online: 40 }
	]
};

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

const call = (platform: unknown) => GET({ platform } as never);

describe('GET /api/members/history', () => {
	beforeEach(() => {
		fetchMemberHistory.mockReset();
		fetchMemberHistory.mockResolvedValue({ points: [] });
	});

	it('answers with the series and a long public cache window', async () => {
		fetchMemberHistory.mockResolvedValue(HISTORY);
		const response = await call({ env: {} });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(HISTORY);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=600, stale-while-revalidate=3600'
		);
	});

	it('serves a fresh KV entry without asking SpaceBot', async () => {
		const kv = createKv(JSON.stringify({ at: Date.now(), history: HISTORY }));
		expect(await (await call({ env: { KV: kv } })).json()).toEqual(HISTORY);
		expect(fetchMemberHistory).not.toHaveBeenCalled();
	});

	it('refetches once the entry is older than ten minutes', async () => {
		const kv = createKv(JSON.stringify({ at: Date.now() - 601_000, history: HISTORY }));
		expect(await (await call({ env: { KV: kv } })).json()).toEqual({ points: [] });
		expect(fetchMemberHistory).toHaveBeenCalledTimes(1);
	});

	it('stores the series with a timestamp and a TTL past the freshness window', async () => {
		const kv = createKv();
		fetchMemberHistory.mockResolvedValue(HISTORY);
		await call({ env: { KV: kv } });
		const [put] = kv.store.puts;
		expect(put.key).toBe('members:history');
		expect(put.opts).toEqual({ expirationTtl: 1200 });
		expect(JSON.parse(put.value).history).toEqual(HISTORY);
	});

	it('still answers when KV reads or writes fail, or there is no platform', async () => {
		const failing = createKv();
		failing.get.mockRejectedValue(new Error('KV down'));
		failing.put.mockRejectedValue(new Error('KV down'));
		fetchMemberHistory.mockResolvedValue(HISTORY);
		expect(await (await call({ env: { KV: failing } })).json()).toEqual(HISTORY);
		expect(await (await call(undefined)).json()).toEqual(HISTORY);
	});
});
