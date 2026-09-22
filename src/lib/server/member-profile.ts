/**
 * One person's own figures from the *Space Discord, for the signed-in half of
 * `/stats`.
 *
 * SpaceBot serves them at `GET /api/v1/members/:userId` behind a `members:read`
 * scope it does not imply from `stats:read` — a key that may graph the member
 * count has no business reading what one named account did, so the owner grants
 * this one on purpose and every key issued before it existed lacks it.
 *
 * **The user id never comes from the request.** It is read out of
 * `oauth_accounts` for the session the hooks already established, by
 * `discordAccountId`. A `?user=` on this page would turn a private panel into a
 * lookup service for anyone who knows a snowflake, and SpaceBot cannot tell the
 * difference — the trust that the asker owns the account is entirely this
 * site's to keep.
 *
 * **It fails to nothing.** No key, no `members:read`, unreachable bot, a body
 * that does not parse: all of them return `available: false`, and the page
 * shows the server-wide figures alone rather than an error. Not being in the
 * Discord server is a different answer — `member: false` — and the page says
 * so, with an invite.
 */

import type { D1Database } from '@cloudflare/workers-types';

/** The window the personal panel covers. */
export const PROFILE_DAYS = 30;

/** How long one person's figures may be reused before asking again. */
export const PROFILE_CACHE_SECONDS = 300;

const REQUEST_TIMEOUT_MS = 4000;

/** Counts over one window. */
export type MemberWindow = {
	messages: number;
	/** Distinct channels posted in. */
	channels: number;
	lastMessageAt: string | null;
	voiceSeconds: number;
	voiceSessions: number;
	voiceChannels: number;
	lastVoiceAt: string | null;
	commands: number;
};

/**
 * Where they stand among everyone who did the same thing in the window.
 *
 * Null rank means they did none of it. `population` is still worth having —
 * it is what "nobody posted this month" and "you are the only one who didn't"
 * are told apart by.
 */
export type MemberStanding = {
	messageRank: number | null;
	messagePopulation: number;
	voiceRank: number | null;
	voicePopulation: number;
};

export type MemberProfile = {
	/** SpaceBot answered. False for every failure, including a missing scope. */
	available: boolean;
	/** In the *Space server right now, per SpaceBot's member cache. */
	member: boolean;
	/** When they joined, or null when SpaceBot never learned it. */
	joinedAt: string | null;
	/** The window `activity` and `standing` cover. */
	days: number;
	/** How far back SpaceBot keeps raw events at all. */
	retentionDays: number;
	/** Channels the server does not log, so none of the counts include them. */
	unrecordedChannels: number;
	activity: MemberWindow;
	/** The same shape over everything still retained. */
	recorded: MemberWindow;
	standing: MemberStanding;
};

export const EMPTY_WINDOW: MemberWindow = {
	messages: 0,
	channels: 0,
	lastMessageAt: null,
	voiceSeconds: 0,
	voiceSessions: 0,
	voiceChannels: 0,
	lastVoiceAt: null,
	commands: 0
};

export const UNAVAILABLE_PROFILE: MemberProfile = {
	available: false,
	member: false,
	joinedAt: null,
	days: PROFILE_DAYS,
	retentionDays: 90,
	unrecordedChannels: 0,
	activity: EMPTY_WINDOW,
	recorded: EMPTY_WINDOW,
	standing: {
		messageRank: null,
		messagePopulation: 0,
		voiceRank: null,
		voicePopulation: 0
	}
};

export type MemberProfileConfig = {
	apiUrl?: string;
	apiKey?: string;
};

/** Discord snowflakes are decimal digits. Anything else is not an id. */
const SNOWFLAKE = /^\d{5,32}$/;

const count = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

const maybeCount = (value: unknown): number | null => {
	if (value === null || value === undefined) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const str = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
};

function toWindow(raw: unknown): MemberWindow {
	if (!raw || typeof raw !== 'object') return EMPTY_WINDOW;
	const row = raw as Record<string, unknown>;
	return {
		messages: count(row.messages),
		channels: count(row.channels),
		lastMessageAt: str(row.last_message_at),
		voiceSeconds: count(row.voice_seconds),
		voiceSessions: count(row.voice_sessions),
		voiceChannels: count(row.voice_channels),
		lastVoiceAt: str(row.last_voice_at),
		commands: count(row.commands)
	};
}

/**
 * The Discord account id for a signed-in user, or null.
 *
 * This is the whole authorization story for the personal panel: the id is
 * whatever the OAuth callback wrote against this user's row, so the only
 * account anyone can ever ask about is the one they proved they own by signing
 * in with it. A user who signed in with GitHub and never linked Discord gets
 * null, and the page invites them to link it.
 */
export async function discordAccountId(
	db: D1Database | undefined,
	userId: string | undefined
): Promise<string | null> {
	if (!db || !userId) return null;

	try {
		const row = await db
			.prepare(
				"SELECT provider_account_id FROM oauth_accounts WHERE user_id = ? AND provider = 'discord'"
			)
			.bind(userId)
			.first<{ provider_account_id: string }>();
		const id = str(row?.provider_account_id);
		// A stored id that is not a snowflake is a row this site did not write.
		// It would go into a URL, so it is checked rather than trusted.
		return id && SNOWFLAKE.test(id) ? id : null;
	} catch {
		// A failed lookup is a page without the personal panel, not a 500.
		return null;
	}
}

/**
 * Ask SpaceBot what this member did.
 *
 * @param discordUserId from `discordAccountId`, never from the request
 * @param fetcher injected so tests do not reach the network
 */
export async function fetchMemberProfile(
	config: MemberProfileConfig,
	discordUserId: string,
	fetcher: typeof fetch = fetch
): Promise<MemberProfile> {
	const { apiUrl, apiKey } = config;
	if (!apiUrl || !apiKey || !SNOWFLAKE.test(discordUserId)) return UNAVAILABLE_PROFILE;

	const url = `${apiUrl.replace(/\/$/, '')}/api/v1/members/${discordUserId}?days=${PROFILE_DAYS}`;

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
		return UNAVAILABLE_PROFILE;
	}
	// A 403 here is the common case, not an exception: it is what a key issued
	// before `members:read` existed answers, and it lands on the same page as
	// every other failure — server figures, no personal panel.
	if (!response.ok) return UNAVAILABLE_PROFILE;

	let payload: Record<string, unknown>;
	try {
		payload = (await response.json()) as Record<string, unknown>;
	} catch {
		return UNAVAILABLE_PROFILE;
	}

	const standing = (payload.standing ?? {}) as Record<string, unknown>;

	return {
		available: true,
		member: payload.member === true,
		joinedAt: str(payload.joined_at),
		days: maybeCount(payload.days) ?? PROFILE_DAYS,
		retentionDays: maybeCount(payload.retention_days) ?? 90,
		unrecordedChannels: count(payload.unrecorded_channels),
		activity: toWindow(payload.activity),
		recorded: toWindow(payload.recorded),
		standing: {
			messageRank: maybeCount(standing.message_rank),
			messagePopulation: count(standing.message_population),
			voiceRank: maybeCount(standing.voice_rank),
			voicePopulation: count(standing.voice_population)
		}
	};
}
