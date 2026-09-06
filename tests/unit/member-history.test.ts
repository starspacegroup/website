import {
	fetchMemberHistory,
	HISTORY_CACHE_SECONDS,
	HISTORY_PERIOD
} from '$lib/server/member-history';
import { describe, expect, it, vi } from 'vitest';

const CONFIG = { apiUrl: 'https://spacebot.example', apiKey: 'sb_live_test' };

function point(day: string, members: number, online: number | null = null) {
	return { period: day, member_count: members, online_count: online, human_count: null };
}

function fetcherFor(body: unknown, init: { ok?: boolean; status?: number } = {}) {
	return vi.fn(async () => ({
		ok: init.ok ?? true,
		status: init.status ?? 200,
		json: async () => body
	})) as unknown as typeof fetch;
}

describe('fetchMemberHistory', () => {
	it('asks for a month of daily points, with the key in the header', async () => {
		const fetcher = fetcherFor({ points: [] });
		await fetchMemberHistory({ ...CONFIG, apiUrl: 'https://spacebot.example/' }, fetcher);

		const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe(
			`https://spacebot.example/api/v1/stats/members?period=${HISTORY_PERIOD}&granularity=daily`
		);
		expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sb_live_test' });
	});

	it('maps SpaceBot rows to days, in order, keeping online when it is there', async () => {
		const fetcher = fetcherFor({
			points: [
				point('2026-09-03', 1200, 80),
				point('2026-09-02', 1190),
				point('2026-09-04', 1204, 91)
			]
		});
		expect(await fetchMemberHistory(CONFIG, fetcher)).toEqual({
			points: [
				{ day: '2026-09-02', members: 1190, online: null },
				{ day: '2026-09-03', members: 1200, online: 80 },
				{ day: '2026-09-04', members: 1204, online: 91 }
			]
		});
	});

	it('drops rows that are not a whole day with a real count', async () => {
		const fetcher = fetcherFor({
			points: [
				point('2026-09-01', 1000),
				{ period: '2026-09-02 13:00', member_count: 1001 }, // hourly bucket
				{ period: '2026-W36', member_count: 1002 }, // weekly bucket
				{ period: '2026-09-03', member_count: 'lots' },
				{ period: '2026-09-04', member_count: Number.NaN },
				{ period: '2026-09-05' },
				null,
				point('2026-09-06', 1006, Number.POSITIVE_INFINITY)
			]
		});
		expect(await fetchMemberHistory(CONFIG, fetcher)).toEqual({
			points: [
				{ day: '2026-09-01', members: 1000, online: null },
				{ day: '2026-09-06', members: 1006, online: null }
			]
		});
	});

	it('keeps the last row when a day is repeated', async () => {
		const fetcher = fetcherFor({ points: [point('2026-09-01', 1), point('2026-09-01', 2)] });
		expect((await fetchMemberHistory(CONFIG, fetcher)).points).toEqual([
			{ day: '2026-09-01', members: 2, online: null }
		]);
	});

	describe('every failure is an empty series', () => {
		it('when the bot is not configured — and nothing is fetched', async () => {
			const fetcher = fetcherFor({ points: [point('2026-09-01', 1)] });
			expect(await fetchMemberHistory({ apiKey: 'k' }, fetcher)).toEqual({ points: [] });
			expect(await fetchMemberHistory({ apiUrl: 'https://x' }, fetcher)).toEqual({ points: [] });
			expect(fetcher).not.toHaveBeenCalled();
		});

		it('when the request throws', async () => {
			const fetcher = vi.fn(async () => {
				throw new Error('offline');
			}) as unknown as typeof fetch;
			expect(await fetchMemberHistory(CONFIG, fetcher)).toEqual({ points: [] });
		});

		it('when SpaceBot answers with an error status', async () => {
			expect(
				await fetchMemberHistory(CONFIG, fetcherFor({ error: 'nope' }, { ok: false, status: 403 }))
			).toEqual({ points: [] });
		});

		it('when the body is not JSON or not the promised shape', async () => {
			const broken = vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => {
					throw new SyntaxError('<');
				}
			})) as unknown as typeof fetch;
			expect(await fetchMemberHistory(CONFIG, broken)).toEqual({ points: [] });
			for (const body of [{}, { points: 'no' }, { points: null }, []]) {
				expect(await fetchMemberHistory(CONFIG, fetcherFor(body))).toEqual({ points: [] });
			}
		});
	});
});

describe('constants', () => {
	it('keeps the window and cache at their documented values', () => {
		expect(HISTORY_PERIOD).toBe('30d');
		expect(HISTORY_CACHE_SECONDS).toBe(600);
	});
});
