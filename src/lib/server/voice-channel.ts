/**
 * Who is in the #Ten Forward voice channel right now, read from SpaceBot.
 *
 * SpaceBot's gateway keeps a `live_voice_states` snapshot for the *Space guild
 * and serves it at `GET /api/v1/voice` to an API key carrying the `voice:read`
 * scope. That key is a secret, so this module only ever runs on the server: the
 * browser talks to `/api/voice` on this site, which calls through to here.
 *
 * Two rules shape everything below.
 *
 * **Three or more, or nobody.** Below the threshold this returns `live: false`
 * and NO member data at all — not a trimmed list, not a count. Two people in a
 * voice channel on a Saturday night is a fact about those two people, and a
 * public home page is not the place to publish it. The threshold is enforced
 * here rather than in the component so nothing about them reaches the browser in
 * the first place.
 *
 * **Faces, not names.** Above the threshold this returns avatars and voice flags
 * and nothing else — no display name, no username, no user id. The hero shows
 * that the room is busy and who is in it to anyone who recognises a face; it does
 * not publish a roster of who was online at what hour, which is what a list of
 * names on a public page amounts to. Names are dropped HERE, not hidden in CSS.
 *
 * **It fails to the simulation.** A missing key, an unreachable bot, a timeout,
 * a shape that does not parse: every one of them returns `live: false`, and the
 * page shows the simulated channel. A hero that renders an error is worse than
 * a hero that renders a loop.
 */

/** Nobody appears on the home page until this many people are in the channel. */
export const LIVE_MEMBER_THRESHOLD = 3;

/** How long a snapshot may be reused before SpaceBot is asked again. */
export const VOICE_CACHE_SECONDS = 10;

/** Give up on SpaceBot rather than hold a page render open. */
const REQUEST_TIMEOUT_MS = 2500;

/** One person in the channel, reduced to what the page actually draws. */
export type VoiceMember = {
	/** Discord CDN avatar URL, or `null` for the anonymous placeholder. */
	avatar: string | null;
	/** Sharing a screen right now. */
	streaming: boolean;
	/** Camera on. */
	video: boolean;
	/** Muted, by themselves or by a moderator. */
	muted: boolean;
};

export type VoiceSnapshot =
	| { live: false }
	| { live: true; channel: string; members: VoiceMember[]; updatedAt: string | null };

export type VoiceConfig = {
	/** SpaceBot's origin, e.g. `https://spacebot.starspace.group`. */
	apiUrl?: string;
	/** An `sb_live_…` key with the `voice:read` scope. */
	apiKey?: string;
	/** Channel name to look for. Defaults to `Ten Forward`. */
	channel?: string;
};

/** Read the SpaceBot settings off the Cloudflare env, if they are configured. */
export function readVoiceConfig(platform: App.Platform | undefined): VoiceConfig {
	const env = (platform?.env ?? {}) as Record<string, string | undefined>;
	return {
		apiUrl: env.SPACEBOT_API_URL,
		apiKey: env.SPACEBOT_API_KEY,
		channel: env.SPACEBOT_VOICE_CHANNEL || 'Ten Forward'
	};
}

type RawMember = {
	userId?: unknown;
	avatarUrl?: unknown;
	streaming?: unknown;
	selfVideo?: unknown;
	selfMute?: unknown;
	serverMute?: unknown;
};

/**
 * Take one member out of SpaceBot's snapshot, or `null` if the row is not a
 * person.
 *
 * `userId` is the test because SpaceBot itself skips any row without one, so its
 * absence means a malformed row rather than a member — and it is deliberately
 * read but not returned. A user id is an identifier, and this response carries
 * no identifiers beyond whatever a Discord avatar URL already contains.
 */
function toMember(raw: RawMember): VoiceMember | null {
	if (typeof raw.userId !== 'string' || !raw.userId) return null;

	return {
		avatar: typeof raw.avatarUrl === 'string' && raw.avatarUrl ? raw.avatarUrl : null,
		streaming: Boolean(raw.streaming),
		video: Boolean(raw.selfVideo),
		muted: Boolean(raw.selfMute) || Boolean(raw.serverMute)
	};
}

/**
 * Ask SpaceBot who is in the channel.
 *
 * @param config  from {@link readVoiceConfig}
 * @param fetcher injected so tests do not reach the network
 */
export async function fetchVoiceSnapshot(
	config: VoiceConfig,
	fetcher: typeof fetch = fetch
): Promise<VoiceSnapshot> {
	const { apiUrl, apiKey, channel } = config;
	if (!apiUrl || !apiKey || !channel) return { live: false };

	const url = `${apiUrl.replace(/\/$/, '')}/api/v1/voice?channel=${encodeURIComponent(channel)}`;

	// AbortSignal.timeout is not in every runtime this file compiles for, so fall
	// back to no timeout rather than throwing on a missing global.
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
		return { live: false };
	}

	if (!response.ok) return { live: false };

	let payload: { channels?: unknown; updatedAt?: unknown };
	try {
		payload = (await response.json()) as typeof payload;
	} catch {
		return { live: false };
	}

	const channels = Array.isArray(payload.channels) ? payload.channels : [];
	const found = channels[0] as { channelName?: unknown; members?: unknown } | undefined;
	const rawMembers = Array.isArray(found?.members) ? found.members : [];

	const members = rawMembers
		.map((raw) => toMember(raw as RawMember))
		.filter((member): member is VoiceMember => member !== null);

	if (members.length < LIVE_MEMBER_THRESHOLD) return { live: false };

	return {
		live: true,
		channel: typeof found?.channelName === 'string' ? found.channelName : channel,
		members,
		updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null
	};
}
