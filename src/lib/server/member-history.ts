/**
 * The member count over the last 90 days, read from SpaceBot, for the graph
 * under the hero's number.
 *
 * SpaceBot records a `server_stats` snapshot a few times a day and serves the
 * series at `GET /api/v1/stats/members` to an API key with the `stats:read`
 * scope — the same key the voice panel uses, so long as it carries both scopes.
 * Like the voice module this only runs on the server; the browser polls this
 * site's `/api/members/history`.
 *
 * It fails to nothing. Any failure — no key, unreachable bot, wrong scope, a
 * body that does not parse — returns an empty series, and the hero simply shows
 * the count without a trend line, which is exactly what it showed before the
 * graph existed.
 */

/**
 * How far back the graph looks.
 *
 * SpaceBot returns whatever it has rather than erroring on a window longer than
 * its history, and the trend label counts the points it actually got — so a
 * server with three weeks of snapshots still reads "in the last 21 days".
 */
export const HISTORY_PERIOD = '90d';

/** How long a series may be reused before SpaceBot is asked again. */
export const HISTORY_CACHE_SECONDS = 600;

const REQUEST_TIMEOUT_MS = 2500;

/** One day on the graph. */
export type MemberPoint = {
	/** `YYYY-MM-DD`, in SpaceBot's bucketing. */
	day: string;
	/** Total members at the last snapshot that day. */
	members: number;
	/** Members online at that snapshot, or `null` when Discord did not say. */
	online: number | null;
};

export type MemberHistory = {
	points: MemberPoint[];
};

/** The SpaceBot credentials, resolved by `$lib/server/spacebot-connection`. */
export type MemberHistoryConfig = {
	apiUrl?: string;
	apiKey?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type RawPoint = { period?: unknown; member_count?: unknown; online_count?: unknown };

/**
 * Keep a row only if it is a whole day with a real count. SpaceBot buckets by
 * `%Y-%m-%d` at daily granularity, so anything else is a shape it did not
 * promise, and a graph should not guess at it.
 */
function toPoint(raw: RawPoint | null | undefined): MemberPoint | null {
	if (!raw || typeof raw !== 'object') return null;
	if (typeof raw.period !== 'string' || !DAY.test(raw.period)) return null;
	if (typeof raw.member_count !== 'number' || !Number.isFinite(raw.member_count)) return null;
	return {
		day: raw.period,
		members: raw.member_count,
		online:
			typeof raw.online_count === 'number' && Number.isFinite(raw.online_count)
				? raw.online_count
				: null
	};
}

/**
 * Ask SpaceBot for the last 90 days of member counts, one point per day.
 *
 * @param fetcher injected so tests do not reach the network
 */
export async function fetchMemberHistory(
	config: MemberHistoryConfig,
	fetcher: typeof fetch = fetch
): Promise<MemberHistory> {
	const { apiUrl, apiKey } = config;
	if (!apiUrl || !apiKey) return { points: [] };

	const url = `${apiUrl.replace(/\/$/, '')}/api/v1/stats/members?period=${HISTORY_PERIOD}&granularity=daily`;

	const signal =
		typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
			? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			: undefined;

	let response: Response;
	try {
		response = await fetcher(url, {
			headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
			signal
		});
	} catch {
		return { points: [] };
	}
	if (!response.ok) return { points: [] };

	let payload: { points?: unknown };
	try {
		payload = (await response.json()) as typeof payload;
	} catch {
		return { points: [] };
	}

	const raw = Array.isArray(payload.points) ? payload.points : [];
	const byDay = new Map<string, MemberPoint>();
	for (const row of raw) {
		const point = toPoint(row as RawPoint);
		// Last write wins on a duplicate day; SpaceBot already picks the latest
		// snapshot per bucket, so this only guards against a repeated row.
		if (point) byDay.set(point.day, point);
	}

	// Sorted by the string, which for YYYY-MM-DD is chronological.
	const points = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
	return { points };
}
