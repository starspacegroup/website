/**
 * What the whole server has been doing — the public half of `/stats`.
 *
 * SpaceBot records a `server_stats` snapshot a few times a day and rolls the
 * event firehose into one `aggregated_stats` row per day. `GET /api/v1/stats`
 * serves both to a key with `stats:read` — the same key the hero's member graph
 * already uses, so this surface needs no new scope and no reconnection.
 *
 * Everything here is an aggregate over the whole server: how many people, how
 * many joined and left, how much was said, how long anyone sat in voice. There
 * is nothing personal in it, which is why the page shows it to a visitor who
 * has not signed in and never will. The per-member half lives in
 * `member-profile.ts`, behind a scope of its own.
 *
 * **It fails to nothing.** No key, unreachable bot, wrong scope, a body that
 * does not parse: every one returns `available: false`, and the page says the
 * figures are unavailable rather than rendering a wall of zeroes. A zero on a
 * stats page is a claim, and this module never makes one it cannot support.
 */

/** How many daily rows to ask for. SpaceBot caps the window at 90. */
export const STATS_DAYS = 90;

/** How long a read may be reused before SpaceBot is asked again. */
export const STATS_CACHE_SECONDS = 600;

/** How long to trust an answer SpaceBot could not give. */
export const STATS_UNAVAILABLE_CACHE_SECONDS = 300;

const REQUEST_TIMEOUT_MS = 4000;

/** The server as it stands, at the most recent snapshot. */
export type GuildSnapshot = {
	/** Total accounts in the server, bots included. */
	members: number;
	/** Members online at that snapshot, or null when Discord did not say. */
	online: number | null;
	/** Bot accounts, or null when the snapshot did not know. */
	bots: number | null;
	/** Members that are not bots, derived, or null when bots are unknown. */
	humans: number | null;
	channels: number | null;
	roles: number | null;
	emoji: number | null;
	boosts: number | null;
	boostLevel: number | null;
	/** When the snapshot was taken. */
	recordedAt: string | null;
};

/** One day of the server's activity, as SpaceBot rolled it up. */
export type GuildDay = {
	/** `YYYY-MM-DD`. */
	day: string;
	joins: number;
	leaves: number;
	/** `joins - leaves`, as recorded rather than recomputed. */
	netChange: number;
	messages: number;
	/** Distinct people who posted that day. */
	posters: number;
	voiceSeconds: number;
	/** Distinct people who were in voice that day. */
	voicePeople: number;
	/** The most people in voice at one time that day. */
	voicePeak: number;
};

export type GuildStats = {
	snapshot: GuildSnapshot | null;
	/** Chronological, oldest first. Empty when SpaceBot had no rolled-up days. */
	days: GuildDay[];
	/** True when SpaceBot answered at all, whatever it had to say. */
	available: boolean;
};

export const EMPTY_STATS: GuildStats = { snapshot: null, days: [], available: false };

export type GuildStatsConfig = {
	apiUrl?: string;
	apiKey?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A count, or 0. Anything unreadable is not a number this site prints. */
const count = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

/** A count that is allowed to be absent — the distinction the page renders. */
const maybeCount = (value: unknown): number | null => {
	if (value === null || value === undefined) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

/** A signed count: net change is the one figure here that may be negative. */
const signed = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const str = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
};

/**
 * Read the current snapshot, or null when there is no usable one.
 *
 * A row without a member count is not a snapshot — it is a row. Rendering it
 * would put a bare zero under "members", which reads as a dead server rather
 * than as missing data.
 */
function toSnapshot(raw: unknown): GuildSnapshot | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const members = maybeCount(row.member_count);
	if (members === null) return null;

	const bots = maybeCount(row.bot_count);
	return {
		members,
		online: maybeCount(row.online_count),
		bots,
		// Derived rather than read: SpaceBot stores the bot count, and people are
		// what a reader actually wants. Negative is impossible but cheap to rule
		// out, and a snapshot that disagreed with itself should not print a
		// negative population.
		humans: bots === null ? null : Math.max(members - bots, 0),
		channels: maybeCount(row.channel_count),
		roles: maybeCount(row.role_count),
		emoji: maybeCount(row.emoji_count),
		boosts: maybeCount(row.boost_count),
		boostLevel: maybeCount(row.boost_level),
		recordedAt: str(row.recorded_at)
	};
}

/**
 * Read one rolled-up day, or null when it is not one.
 *
 * `period_start` is a datetime; only its date half is kept, because these are
 * `period_type = 'daily'` rows and a time on a daily bucket is noise a reader
 * would try to interpret.
 */
function toDay(raw: unknown): GuildDay | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const start = str(row.period_start);
	if (!start || !DAY.test(start)) return null;

	return {
		day: start.slice(0, 10),
		joins: count(row.member_joins),
		leaves: count(row.member_leaves),
		netChange: signed(row.member_net_change),
		messages: count(row.message_count),
		posters: count(row.message_unique_users),
		voiceSeconds: count(row.voice_total_seconds),
		voicePeople: count(row.voice_unique_users),
		voicePeak: count(row.voice_peak_concurrent)
	};
}

/**
 * Ask SpaceBot what the server has been doing.
 *
 * @param fetcher injected so tests do not reach the network
 */
export async function fetchGuildStats(
	config: GuildStatsConfig,
	fetcher: typeof fetch = fetch
): Promise<GuildStats> {
	const { apiUrl, apiKey } = config;
	if (!apiUrl || !apiKey) return EMPTY_STATS;

	const url = `${apiUrl.replace(/\/$/, '')}/api/v1/stats?days=${STATS_DAYS}`;

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
		return EMPTY_STATS;
	}
	if (!response.ok) return EMPTY_STATS;

	let payload: { current?: unknown; daily_stats?: unknown };
	try {
		payload = (await response.json()) as typeof payload;
	} catch {
		return EMPTY_STATS;
	}

	const raw = Array.isArray(payload.daily_stats) ? payload.daily_stats : [];
	const byDay = new Map<string, GuildDay>();
	for (const row of raw) {
		const day = toDay(row);
		// SpaceBot has a uniqueness constraint on (guild, period_type, start), so
		// this only guards against a repeated row rather than picking a winner.
		if (day) byDay.set(day.day, day);
	}

	// Sorted by the string, which for YYYY-MM-DD is chronological. SpaceBot
	// answers newest first; a graph reads left to right.
	const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

	return { snapshot: toSnapshot(payload.current), days, available: true };
}
