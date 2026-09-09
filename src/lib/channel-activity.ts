/**
 * Turning SpaceBot's channel counts into a sentence a newcomer can act on.
 *
 * The guide used to list a channel's name and whatever topic somebody set when
 * they made it. That answers "what is this called" and nothing else — a room
 * that has been silent since spring reads exactly like the one everybody is in
 * tonight, and a voice channel with no topic says nothing at all. These
 * functions turn the counts SpaceBot serves alongside the directory into the
 * two things a visitor actually wants: is anyone in here, and when.
 *
 * Three rules hold throughout, and the tests pin all three:
 *
 * - **Absent is not zero.** A channel the server leaves out of its logs has no
 *   counts to report, and this says so rather than calling it quiet. Silence
 *   and no-record look identical in a number and must not look identical in a
 *   sentence.
 * - **Nothing is rounded into a claim.** "About 25 minutes" comes from a mean
 *   SpaceBot computed; where there is no figure, the clause is dropped rather
 *   than filled with a plausible one.
 * - **No numbers, no sentence.** Every function returns `null` when it has
 *   nothing real to say, and the page renders nothing at all — an empty line is
 *   better than a confident "0 messages" from a bot that was never asked.
 */

import type { ChannelActivity, ChannelType, DirectoryChannel } from '$lib/server/guild-directory';

/** Channel kinds where the interesting activity is people talking out loud. */
const VOICE_TYPES: ChannelType[] = ['voice', 'stage'];

export const isVoiceChannel = (type: ChannelType): boolean => VOICE_TYPES.includes(type);

/**
 * Channel kinds whose content lives entirely in threads.
 *
 * Discord logs a message against the thread it was posted in, and a thread is
 * not a channel in the public directory — so a forum's own message count is
 * structurally zero however busy it is. "Nothing posted in the last 30 days"
 * would be a flat lie about the busiest forum on a server, so these channels
 * get no activity line at all. An ordinary text channel with a few threads is
 * merely undercounted, which is a different thing from being misreported.
 */
const THREAD_ONLY_TYPES: ChannelType[] = ['forum', 'media'];

export const isThreadOnly = (type: ChannelType): boolean => THREAD_ONLY_TYPES.includes(type);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A length of time, at the precision a reader can hold in their head.
 *
 * Nobody needs "4.98 hours". Under an hour reads in minutes, the working range
 * keeps one decimal so half an hour does not round away to nothing, and beyond
 * ten hours the fraction stops meaning anything.
 */
export function formatDuration(seconds: number | null): string | null {
	if (seconds === null || !Number.isFinite(seconds) || seconds < 60) return null;
	if (seconds < 3600) return plural(Math.round(seconds / 60), 'minute');
	const hours = seconds / 3600;
	if (hours < 10) {
		const rounded = Math.round(hours * 10) / 10;
		return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
	}
	return plural(Math.round(hours), 'hour');
}

/**
 * An hour of the day, read where the server lives.
 *
 * SpaceBot counts joins in UTC, because that is what the timestamps are. A
 * reader does not think in UTC, so this shifts into the guild's own timezone
 * when it has one set, and says which zone it used when it does not — an
 * unlabelled "8pm" is a worse answer than a labelled one in the wrong zone.
 */
export function formatHour(hourUtc: number | null, timezone: string | null): string | null {
	if (hourUtc === null || !Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) return null;
	const at = new Date(Date.UTC(2026, 0, 1, hourUtc, 0, 0));
	try {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			timeZone: timezone ?? 'UTC',
			timeZoneName: timezone ? undefined : 'short'
		}).format(at);
	} catch {
		// An unusable timezone from the server is not worth failing a page over.
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			timeZone: 'UTC',
			timeZoneName: 'short'
		}).format(at);
	}
}

/**
 * How long ago something happened, in the words a person would use.
 *
 * Counted in whole days rather than elapsed hours: a message at 11pm last night
 * is "yesterday" at 9am, which is what a reader means, and not "10 hours ago".
 */
export function formatWhen(value: string | null, now: Date = new Date()): string | null {
	if (!value) return null;
	// SQLite hands back "2026-09-08 18:04:00" — space-separated and zoneless.
	// Reading that as UTC matches how SpaceBot wrote it.
	const normalized = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
		? `${value.replace(' ', 'T')}Z`
		: value;
	const at = new Date(normalized);
	if (Number.isNaN(at.getTime())) return null;

	const startOf = (date: Date) =>
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const days = Math.round((startOf(now) - startOf(at)) / 86_400_000);

	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days} days ago`;
	if (days < 14) return 'last week';
	return at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** The phrases {@link formatWhen} produces that already read as an adverb. */
const RELATIVE = new Set(['today', 'yesterday', 'last week']);

/**
 * The same phrase, ready to follow a verb: "last one **yesterday**", "last one
 * **on** August 12". A date needs the preposition and a relative phrase does
 * not, and "since" needs neither — which is why this is a separate step rather
 * than baked into {@link formatWhen}.
 */
export function whenClause(when: string): string {
	return RELATIVE.has(when) || when.endsWith('days ago') ? when : `on ${when}`;
}

/**
 * What has been said in a text channel lately.
 *
 * @returns a sentence, or `null` when there is nothing honest to print.
 */
export function describeTextActivity(
	activity: ChannelActivity | null,
	days: number | null,
	now: Date = new Date()
): string | null {
	if (!activity || !days) return null;

	// Excluded from the server's logs: nothing was ever recorded here, so this
	// page has no idea whether it is busy, and says exactly that.
	if (activity.messages === null) return 'Not counted — this channel is kept out of the logs.';

	const window = `the last ${plural(days, 'day')}`;
	if (activity.messages === 0) return `Nothing posted in ${window}.`;

	const posters = activity.posters ?? 0;
	const who = posters > 0 ? ` from ${plural(posters, 'person', 'people')}` : '';
	const when = formatWhen(activity.lastMessageAt, now);
	const last = when ? ` Last one ${whenClause(when)}.` : '';
	return `${plural(activity.messages, 'message')}${who} in ${window}.${last}`;
}

/**
 * What a voice channel is for, as far as anything can honestly say.
 *
 * A lobby has a real answer — joining it builds you a room — and SpaceBot knows
 * which channel that is, so it is stated outright. Every other voice channel is
 * described by how it is used: who has been in it, for how long, and when it
 * fills up. That last part is the one worth having on a coworking server, where
 * the question is never "does this room exist" but "when will anyone be in it".
 */
export function describeVoiceActivity(
	activity: ChannelActivity | null,
	days: number | null,
	timezone: string | null = null,
	now: Date = new Date()
): string | null {
	if (!activity || !days) return null;

	const window = `the last ${plural(days, 'day')}`;

	if (activity.voiceSessions === 0) {
		const when = formatWhen(activity.lastVoiceAt, now);
		return when ? `Quiet since ${when}.` : `Nobody has been in here in ${window}.`;
	}

	const time = formatDuration(activity.voiceSeconds);
	const people = plural(activity.voicePeople, 'person', 'people');
	const head = time
		? `${people} spent ${time} here in ${window}`
		: `${people} dropped in during ${window}`;

	const parts = [`${head}, across ${plural(activity.voiceSessions, 'visit')}.`];

	const typical = formatDuration(activity.typicalStaySeconds);
	if (typical) parts.push(`A visit is usually about ${typical}.`);

	const hour = formatHour(activity.busiestHourUtc, timezone);
	if (hour) parts.push(`Busiest around ${hour}.`);

	return parts.join(' ');
}

/** The one thing a lobby channel is for, or `null` if this is not one. */
export function describeLobby(activity: ChannelActivity | null): string | null {
	if (!activity?.lobby) return null;
	return 'Join this one and you get a room of your own, made on the spot.';
}

/**
 * The one line under a channel, whatever kind it is.
 *
 * The page calls this rather than choosing between the two describers itself,
 * so the rule about forums — see {@link isThreadOnly} — cannot be forgotten at
 * the one call site that matters.
 */
export function describeChannelUse(
	channel: DirectoryChannel,
	days: number | null,
	timezone: string | null = null,
	now: Date = new Date()
): string | null {
	if (isThreadOnly(channel.type)) return null;
	return isVoiceChannel(channel.type)
		? describeVoiceActivity(channel.activity, days, timezone, now)
		: describeTextActivity(channel.activity, days, now);
}
