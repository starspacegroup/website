/**
 * What the *Space Discord server contains, read from SpaceBot: the channels and
 * what they are for, and every command a member can type.
 *
 * SpaceBot's gateway keeps a `guild_channels` snapshot of the server's PUBLIC
 * channels — it never sends one `@everyone` cannot view, and never a room a
 * member made with `/room` — and serves it at `GET /api/v1/channels` to a key
 * with the `channels:read` scope. This site asks with `?activity=30`, which
 * adds how each channel is *used*: a name and a topic somebody set once cannot
 * tell a newcomer which rooms are alive, when people are in them, or what a
 * voice channel is for when it has no topic at all. Counts only — SpaceBot
 * aggregates before answering, so no message text or member name reaches this
 * site to be published by accident. `GET /api/v1/commands` serves the built-in
 * commands and this server's own, with `commands:read`. Both need the same key
 * the hero already uses, carrying the extra scopes.
 *
 * The key is a secret, so this only runs on the server. The page renders from
 * `+page.server.ts`, not from a browser fetch: this is reference content a
 * crawler and an agent should see in the HTML, not a panel that fills in later.
 *
 * **It fails to nothing, and the page says so.** A missing key, an unreachable
 * bot, a wrong scope, a body that does not parse: every one of them returns an
 * empty directory. The page then explains that the listing is unavailable and
 * points at Discord, rather than rendering a broken shell — but it never
 * invents a channel. Nothing here is hardcoded; if SpaceBot cannot say, this
 * site does not say.
 */

/**
 * How long a directory may be reused before SpaceBot is asked again.
 *
 * A day. Channels and commands change on the order of weeks, the answer is the
 * same for every visitor, and a slow page is a worse failure than a stale one.
 * The gateway pushes its own changes into SpaceBot within seconds; this cache
 * is only about how often this site asks.
 */
export const DIRECTORY_CACHE_SECONDS = 86_400;

/** Give up on SpaceBot rather than hold a page render open. */
const REQUEST_TIMEOUT_MS = 4000;

/**
 * How much history the channel usage covers.
 *
 * A month. Long enough that a room used on weekends still looks used, short
 * enough that "quiet" means quiet now rather than quiet since spring — a
 * newcomer reading this page is deciding where to say something today.
 * SpaceBot's raw events stop at 90 days, so this is well inside what it keeps.
 */
const ACTIVITY_DAYS = 30;

/** Channel kinds this site renders. Anything else is dropped, not guessed at. */
export const RENDERABLE_TYPES = [
	'text',
	'voice',
	'announcement',
	'stage',
	'forum',
	'media'
] as const;
export type ChannelType = (typeof RENDERABLE_TYPES)[number];

/**
 * How a channel is actually used, over {@link GuildDirectory.activityDays}.
 *
 * `messages` and `posters` are `null` — not zero — for a channel the server
 * excludes from logging. Nothing was recorded, so "no messages" would be a
 * claim this site cannot make; the page says the room is not counted instead.
 */
export type ChannelActivity = {
	messages: number | null;
	posters: number | null;
	/** When the most recent message landed, or null. */
	lastMessageAt: string | null;
	/** Completed voice time, in seconds. */
	voiceSeconds: number;
	/** Distinct people who joined voice. */
	voicePeople: number;
	/** Times somebody joined. */
	voiceSessions: number;
	/** Mean length of a completed visit, in seconds. */
	typicalStaySeconds: number | null;
	/** Hour of day, UTC, this channel fills up most often. */
	busiestHourUtc: number | null;
	/** Most recent voice join, or null. */
	lastVoiceAt: string | null;
	/** Joining this channel gives the member a room of their own. */
	lobby: boolean;
};

export type DirectoryChannel = {
	id: string;
	name: string;
	type: ChannelType;
	/** The channel's own description in Discord, or `null` when it has none. */
	topic: string | null;
	/** Null when SpaceBot had nothing to say about this channel's use. */
	activity: ChannelActivity | null;
};

export type DirectoryCategory = {
	name: string | null;
	channels: DirectoryChannel[];
};

export type DirectoryCommand = {
	name: string;
	description: string;
	/** SpaceBot's own, rather than one this server defined. */
	builtIn: boolean;
	/** Parameter names, in the order Discord shows them. */
	options: string[];
};

export type GuildDirectory = {
	categories: DirectoryCategory[];
	commands: DirectoryCommand[];
	/** When SpaceBot's gateway last refreshed the channel list. */
	syncedAt: string | null;
	/** The window every {@link ChannelActivity} covers, in days. */
	activityDays: number | null;
	/** The Discord server's own timezone, for reading a busiest hour in. */
	timezone: string | null;
	/** True when SpaceBot answered at all, whatever it had to say. */
	available: boolean;
};

export const EMPTY_DIRECTORY: GuildDirectory = {
	categories: [],
	commands: [],
	syncedAt: null,
	activityDays: null,
	timezone: null,
	available: false
};

export type DirectoryConfig = {
	apiUrl?: string;
	apiKey?: string;
};

const str = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
};

function isRenderableType(value: unknown): value is ChannelType {
	return RENDERABLE_TYPES.includes(value as ChannelType);
}

/** A count, or 0. A number this site cannot read is not a number it prints. */
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

/**
 * Read one channel's usage, or `null` when SpaceBot did not send any.
 *
 * An older SpaceBot that has never heard of `?activity` simply omits the field,
 * and every channel then renders exactly as it did before. That is the whole
 * fallback: this site never fills the gap with an estimate.
 */
function toActivity(raw: unknown): ChannelActivity | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const hour = maybeCount(row.busiestHourUtc);
	return {
		messages: maybeCount(row.messages),
		posters: maybeCount(row.posters),
		lastMessageAt: str(row.lastMessageAt),
		voiceSeconds: count(row.voiceSeconds),
		voicePeople: count(row.voicePeople),
		voiceSessions: count(row.voiceSessions),
		typicalStaySeconds: maybeCount(row.typicalStaySeconds),
		busiestHourUtc: hour !== null && hour >= 0 && hour <= 23 ? hour : null,
		lastVoiceAt: str(row.lastVoiceAt),
		lobby: row.lobby === true
	};
}

/**
 * Keep a channel only if it has a name and a type this site knows how to draw.
 * A nameless or unlabelled entry on a public page is worse than a missing one.
 */
function toChannel(raw: unknown): DirectoryChannel | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const name = str(row.name);
	const id = str(row.id);
	if (!name || !id || !isRenderableType(row.type)) return null;
	return { id, name, type: row.type, topic: str(row.topic), activity: toActivity(row.activity) };
}

/**
 * True when a command is one an ordinary member can actually type.
 *
 * Two things disqualify one, and SpaceBot already records both — neither is
 * guessed at here:
 *
 * - **Disabled.** `enabled` is false. Nobody can run it, so listing it on a
 *   public page only invites people to try. SpaceBot applies a guild's own
 *   override before answering, so this is the value for *this* server, not a
 *   built-in's default.
 * - **Restricted.** `default_member_permissions` is set. That is Discord's own
 *   field, and null is the only value meaning everyone; anything else names a
 *   permission the reader of a public page almost certainly does not hold.
 *   `/promote` and `/spam` are moderator tools, and a directory of things to
 *   type should not be advertising them.
 *
 * Between them these also take out the half-finished commands every server
 * accumulates — a `/test` left disabled behind an admin permission is exactly
 * the shape of thing that should never have reached the page.
 */
function isPublicCommand(row: Record<string, unknown>): boolean {
	// The API sends SQLite's 0/1 for enabled, and JSON true/false after a
	// built-in override is merged. Only an explicit falsy value hides a command:
	// an absent field means SpaceBot did not say, and this page does not invent
	// a restriction any more than it invents a command.
	if (row.enabled === false || row.enabled === 0) return false;

	const permissions = row.default_member_permissions;
	if (permissions === null || permissions === undefined) return true;
	// An empty column is unset, not a restriction. Every other value restricts —
	// including '0', which Discord reads as "nobody by default, until an admin
	// grants it", the most restrictive setting there is rather than the least.
	return String(permissions).trim() === '';
}

/**
 * Keep a command only if it has a name and a description, and only if a member
 * could actually type it — see `isPublicCommand`.
 *
 * A command with no description is one nobody can act on from a list, and this
 * page is the list.
 */
function toCommand(raw: unknown): DirectoryCommand | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	if (!isPublicCommand(row)) return null;
	const name = str(row.name);
	const description = str(row.description);
	if (!name || !description) return null;

	const options = Array.isArray(row.options)
		? row.options
				.map((option) =>
					option && typeof option === 'object'
						? str((option as Record<string, unknown>).name)
						: null
				)
				.filter((option): option is string => option !== null)
		: [];

	return { name, description, builtIn: row.is_built_in === true, options };
}

async function ask(
	config: DirectoryConfig,
	path: string,
	fetcher: typeof fetch
): Promise<Record<string, unknown> | null> {
	const { apiUrl, apiKey } = config;
	if (!apiUrl || !apiKey) return null;

	const signal =
		typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
			? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			: undefined;

	let response: Response;
	try {
		response = await fetcher(`${apiUrl.replace(/\/$/, '')}${path}`, {
			headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
			signal
		});
	} catch {
		return null;
	}
	if (!response.ok) return null;

	try {
		return (await response.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Ask SpaceBot what the server looks like.
 *
 * The two reads are independent: a key carrying `channels:read` but not
 * `commands:read` still renders the channels, and the page simply omits the
 * half it could not get. Half a page beats an error page.
 *
 * @param fetcher injected so tests do not reach the network
 */
export async function fetchGuildDirectory(
	config: DirectoryConfig,
	fetcher: typeof fetch = fetch
): Promise<GuildDirectory> {
	const [channelsBody, commandsBody] = await Promise.all([
		ask(config, `/api/v1/channels?activity=${ACTIVITY_DAYS}`, fetcher),
		ask(config, '/api/v1/commands?limit=100', fetcher)
	]);

	if (!channelsBody && !commandsBody) return EMPTY_DIRECTORY;

	const rawCategories = Array.isArray(channelsBody?.categories) ? channelsBody.categories : [];
	const categories: DirectoryCategory[] = [];
	for (const rawCategory of rawCategories) {
		if (!rawCategory || typeof rawCategory !== 'object') continue;
		const group = rawCategory as Record<string, unknown>;
		const channels = (Array.isArray(group.channels) ? group.channels : [])
			.map(toChannel)
			.filter((channel): channel is DirectoryChannel => channel !== null);
		// A category whose channels were all unrenderable is not a heading worth
		// drawing.
		if (channels.length) categories.push({ name: str(group.category), channels });
	}

	const rawCommands = Array.isArray(commandsBody?.commands) ? commandsBody.commands : [];
	const commands = rawCommands
		.map(toCommand)
		.filter((command): command is DirectoryCommand => command !== null);

	return {
		categories,
		commands,
		syncedAt: str(channelsBody?.synced_at),
		// SpaceBot answers with the window it actually used, which is not always
		// the one that was asked for. The page labels what it was given.
		activityDays: maybeCount(channelsBody?.activity_days),
		timezone: str(channelsBody?.timezone),
		available: true
	};
}
