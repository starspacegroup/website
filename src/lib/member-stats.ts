import type { MemberPoint } from '$lib/server/member-history';

/**
 * The member figures the hero shows, as people rather than accounts.
 *
 * Discord's invite endpoint — which is what the count fell back on for months —
 * only knows `approximate_member_count`, and that counts every bot in the
 * server alongside every person. SpaceBot knows the difference, because it
 * records `member_count - bot_count` with each snapshot, and this site already
 * serves that series at `/api/members/history` for the graph.
 *
 * So the human count is read from the same series the trend line is drawn from,
 * which also means the number and the line cannot disagree about what they are
 * counting.
 *
 * **It fails to nothing.** No SpaceBot, no snapshot, or a snapshot taken before
 * the bot count was known, and this returns null — the caller then shows
 * Discord's figure, exactly as it did before.
 */
export async function fetchHumanMemberCount(fetcher: typeof fetch = fetch): Promise<number | null> {
	let points: MemberPoint[];
	try {
		const response = await fetcher('/api/members/history');
		if (!response.ok) return null;
		const data = (await response.json()) as { points?: MemberPoint[] };
		points = Array.isArray(data.points) ? data.points : [];
	} catch {
		return null;
	}

	// The series is chronological, so the last point is the most recent snapshot.
	const latest = points.at(-1);
	const human = latest?.human;
	return typeof human === 'number' && Number.isFinite(human) ? human : null;
}

/**
 * The series to draw, in people where that is known for every day.
 *
 * All or nothing on purpose: a line that is human counts for three weeks and
 * total members for the fourth has a step in it that means nothing, and reads
 * as a sudden loss of members. If any day is missing its human count, the whole
 * line stays on the total.
 */
export function humanSeries(points: MemberPoint[]): MemberPoint[] {
	if (points.length === 0) return points;
	if (!points.every((point) => typeof point.human === 'number')) return points;
	return points.map((point) => ({ ...point, members: point.human as number }));
}
