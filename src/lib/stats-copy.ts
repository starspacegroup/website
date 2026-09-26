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

import type { GuildDay, GuildRole } from '$lib/server/guild-stats';
import { getContrastRatio } from '$lib/utils/contrast';

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

/** A role `/stats` puts a number on, and what the page says about it. */
export type FeaturedRole = {
	/** The role's name in Discord. */
	name: string;
	/** What the role means on this server, when there is something to say. */
	description?: string;
};

/**
 * The roles `/stats` puts a number on, in the order it shows them.
 *
 * Matched to SpaceBot's list by name, ignoring case and surrounding spaces,
 * because role ids live in Discord and are not something this repository
 * should hold. The catch is a rename: rename one of these in Discord and its
 * figure disappears from the page until the name here is changed to match.
 * That is the right way round — a missing figure is visible, a figure quietly
 * attached to the wrong role is not.
 */
export const FEATURED_ROLES: readonly FeaturedRole[] = [
	{
		name: 'Passenger',
		description:
			'The role people get once they have joined voice chat. It carries permissions above a basic member’s.'
	},
	{ name: 'Wearing Communicator Badge' }
];

/** A counted role, with anything the page has to say about it. */
export type ShownRole = GuildRole & { description: string | null };

const roleKey = (name: string) => name.trim().toLowerCase();

/**
 * The featured roles SpaceBot reported, in `FEATURED_ROLES` order, each with
 * the name as Discord spells it. A featured role SpaceBot did not report is
 * left out, not shown as zero: it may have been renamed or deleted, and either
 * way this page does not know how many people hold it.
 */
export function featuredRoleCounts(
	roles: GuildRole[] | null | undefined,
	featured: readonly FeaturedRole[] = FEATURED_ROLES
): ShownRole[] {
	if (!roles) return [];
	const byName = new Map<string, GuildRole>();
	for (const role of roles) {
		// Discord allows two roles to share a name. The first is the higher one,
		// which is the one a member sees at the top of the list.
		if (!byName.has(roleKey(role.name))) byName.set(roleKey(role.name), role);
	}
	const shown: ShownRole[] = [];
	for (const { name, description } of featured) {
		const role = byName.get(roleKey(name));
		if (role) shown.push({ ...role, description: description ?? null });
	}
	return shown;
}

/**
 * The tile ground in each theme — `--color-surface` in `src/app.css`, resolved.
 *
 * Restated rather than read because the check below runs before any CSS does.
 * `stats-copy.test.ts` reads `app.css` and fails when these drift from it.
 */
export const TILE_SURFACE = { light: '#f8f9fa', dark: '#1a1a1a' } as const;

/**
 * The role's own colour, if a role name written in it can be read on the tile
 * in that theme (WCAG AA, 4.5:1); otherwise null, and the name keeps the
 * page's text colour.
 *
 * A Discord role colour is chosen for Discord's dark client, so it is often too
 * pale for the light theme — and the odd one is too dark for either. The colour
 * still shows on the tile's stripe and dot, which are not text.
 */
export function roleNameColor(
	color: string | null,
	theme: keyof typeof TILE_SURFACE
): string | null {
	if (!color) return null;
	return getContrastRatio(color, TILE_SURFACE[theme]) >= 4.5 ? color : null;
}
