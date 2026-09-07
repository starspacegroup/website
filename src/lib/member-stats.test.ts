import { describe, expect, it, vi } from 'vitest';
import { fetchHumanMemberCount, humanSeries } from './member-stats';
import type { MemberPoint } from '$lib/server/member-history';

const point = (day: string, members: number, human: number | null): MemberPoint => ({
	day,
	members,
	human,
	online: null
});

const answering = (body: unknown, ok = true) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as never;

describe('fetchHumanMemberCount', () => {
	it('reads the most recent snapshot, which is the last point', async () => {
		const fetcher = answering({
			points: [point('2026-09-05', 358, 340), point('2026-09-06', 359, 341)]
		});
		expect(await fetchHumanMemberCount(fetcher)).toBe(341);
	});

	it('gives up rather than guessing when the snapshot never knew the bot count', async () => {
		// The caller then shows Discord's total, which is what it always showed.
		const fetcher = answering({ points: [point('2026-09-06', 359, null)] });
		expect(await fetchHumanMemberCount(fetcher)).toBeNull();
	});

	it('fails to nothing on an empty series, a bad status or a dead network', async () => {
		expect(await fetchHumanMemberCount(answering({ points: [] }))).toBeNull();
		expect(await fetchHumanMemberCount(answering({ points: [] }, false))).toBeNull();
		const dead = vi.fn(async () => {
			throw new Error('offline');
		}) as never;
		expect(await fetchHumanMemberCount(dead)).toBeNull();
	});
});

describe('humanSeries', () => {
	it('draws people when every day knows how many there were', async () => {
		const series = humanSeries([point('2026-09-05', 358, 340), point('2026-09-06', 359, 341)]);
		expect(series.map((p) => p.members)).toEqual([340, 341]);
	});

	it('stays on the total when any day is missing its human count', () => {
		// Half a line in people and half in accounts has a step in it that means
		// nothing, and reads as members suddenly leaving.
		const series = humanSeries([point('2026-09-05', 358, null), point('2026-09-06', 359, 341)]);
		expect(series.map((p) => p.members)).toEqual([358, 359]);
	});

	it('leaves an empty series alone', () => {
		expect(humanSeries([])).toEqual([]);
	});
});
