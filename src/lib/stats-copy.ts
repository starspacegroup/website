/**
 * Turning the numbers on `/stats` into things a person can read.
 *
 * `channel-activity.ts` already owns `formatDuration`, `formatWhen` and
 * `whenClause`, and this page uses them rather than growing a second set — the
 * two surfaces should not disagree about what "3.4 hours" or "yesterday" looks
 * like. What lives here is what that module had no reason to have: big counts,
 * standings, and the shape of a sparkline.
 *
 * The same rule holds as everywhere else that renders SpaceBot's figures:
 * **absent is not zero**, and a function with nothing honest to say returns
 * null so the page can print nothing at all.
 */

import type { GuildDay } from '$lib/server/guild-stats';

/* The type comes from the server module that parses it; the functions below
   do not, because a component imports them and SvelteKit will not let client
   code reach into `$lib/server`. Same split as `member-stats.ts` against
   `member-history.ts`. */

/** A count with thousands separated, so five figures stay readable at a glance. */
export function formatCount(value: number | null | undefined): string | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.round(value).toLocaleString('en-US');
}

/** 1st, 2nd, 3rd, 4th — including the teens, which break the simple rule. */
export function ordinal(value: number): string {
	const n = Math.abs(Math.round(value));
	const lastTwo = n % 100;
	const suffix =
		lastTwo >= 11 && lastTwo <= 13
			? 'th'
			: n % 10 === 1
				? 'st'
				: n % 10 === 2
					? 'nd'
					: n % 10 === 3
						? 'rd'
						: 'th';
	return `${Math.round(value).toLocaleString('en-US')}${suffix}`;
}

/**
 * Where somebody stands, with the field size attached.
 *
 * "4th" on its own is meaningless — 4th of 6 and 4th of 600 are different
 * lives. A rank with no population behind it is therefore not printed at all,
 * and neither is a rank of null, which means they did none of that thing.
 */
export function formatStanding(rank: number | null, population: number): string | null {
	if (rank === null || !Number.isFinite(rank) || rank < 1) return null;
	if (!Number.isFinite(population) || population < rank) return null;
	if (population === 1) return 'the only one';
	return `${ordinal(rank)} of ${population.toLocaleString('en-US')}`;
}

/**
 * The share of the field at or behind them, as a whole percent.
 *
 * Deliberately conservative: somebody 1st of 10 is "ahead of 90%", not "in the
 * top 10%", because the second phrasing invites reading a rank as a percentile
 * of the whole server rather than of the people who turned up that month.
 * Returns null below a field of five, where a percentage of four people is
 * theatre.
 */
export function formatAhead(rank: number | null, population: number): string | null {
	if (rank === null || population < 5 || rank > population) return null;
	const behind = population - rank;
	if (behind <= 0) return null;
	return `ahead of ${Math.round((behind / population) * 100)}%`;
}

/** Plural that does not read as a bug when the count is one. */
export function plural(n: number, one: string, many = `${one}s`): string {
	return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/**
 * A run of daily values as points on a unit sparkline.
 *
 * `x` spans 0–1 left to right, `y` spans 0–1 with 1 at the top, so the caller
 * picks the pixel size. The baseline is always zero rather than the smallest
 * value in the window: a chart of message counts that starts at 400 makes a
 * quiet week look like a collapse, and this chart is read by people deciding
 * whether the server is alive.
 *
 * @returns an empty array for fewer than two points — one point is not a line,
 *   and drawing it as a flat one claims a trend nobody measured.
 */
export function sparklinePoints(values: number[]): Array<{ x: number; y: number; value: number }> {
	const usable = values.filter((value) => Number.isFinite(value));
	if (usable.length < 2) return [];

	const peak = Math.max(...usable, 0);
	const span = usable.length - 1;

	return usable.map((value, index) => ({
		x: index / span,
		// A window where nothing happened is a flat line on the floor, not a
		// division by zero.
		y: peak > 0 ? Math.max(value, 0) / peak : 0,
		value
	}));
}

/** An SVG polyline `points` attribute for a sparkline, at a given size. */
export function sparklinePath(values: number[], width: number, height: number): string | null {
	const points = sparklinePoints(values);
	if (points.length === 0) return null;
	return points
		.map((point) => `${(point.x * width).toFixed(2)},${((1 - point.y) * height).toFixed(2)}`)
		.join(' ');
}

/**
 * The window a set of daily rows actually covers, as a phrase.
 *
 * Counted from the rows present, not from what was asked for. A server SpaceBot
 * has watched for eleven days must not have its figures labelled "the last 90
 * days" — the number would be right and the sentence would be a lie.
 */
export function describeWindow(days: GuildDay[]): string | null {
	if (days.length === 0) return null;
	if (days.length === 1) return 'one day';
	return `the last ${days.length} days`;
}

/**
 * Net membership change as a signed phrase, or null when it is flat.
 *
 * Zero returns null on purpose: "+0 members" is a number pretending to be news,
 * and a month where as many people left as joined is better said in words by
 * the page than implied by a sign.
 */
export function formatNetChange(net: number): string | null {
	if (!Number.isFinite(net) || net === 0) return null;
	const rounded = Math.round(net);
	return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** Totals over the whole window, for the headline figures above the graph. */
export type GuildTotals = {
	days: number;
	joins: number;
	leaves: number;
	netChange: number;
	messages: number;
	voiceSeconds: number;
	/** The busiest day's message count, for scaling a bar chart. */
	busiestDayMessages: number;
	/** The most people ever in voice at once, over the window. */
	voicePeak: number;
};

/**
 * Add up a window of days.
 *
 * `posters` and `voicePeople` are deliberately **not** summed: they are distinct
 * people per day, and adding them counts the same regular once per day they
 * showed up. There is no honest way to get a window-wide unique count out of
 * daily rollups, so this does not offer one.
 */
export function totalGuildDays(days: GuildDay[]): GuildTotals {
	const totals: GuildTotals = {
		days: days.length,
		joins: 0,
		leaves: 0,
		netChange: 0,
		messages: 0,
		voiceSeconds: 0,
		busiestDayMessages: 0,
		voicePeak: 0
	};

	for (const day of days) {
		totals.joins += day.joins;
		totals.leaves += day.leaves;
		totals.netChange += day.netChange;
		totals.messages += day.messages;
		totals.voiceSeconds += day.voiceSeconds;
		totals.busiestDayMessages = Math.max(totals.busiestDayMessages, day.messages);
		totals.voicePeak = Math.max(totals.voicePeak, day.voicePeak);
	}

	return totals;
}

/**
 * The last `count` days, oldest first.
 *
 * Trailing rather than leading: a 30-day panel on a server with 90 days of
 * history should show the most recent 30, and one with 12 days should show all
 * twelve rather than nothing.
 */
export function recentDays(days: GuildDay[], count: number): GuildDay[] {
	if (count <= 0) return [];
	return days.slice(-count);
}
