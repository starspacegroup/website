/**
 * The *Space Discord server — the one external service the public pages talk to.
 *
 * The invite code used to be repeated in the join button and in the count
 * fetcher, so a new invite meant finding both. It lives here now and everything
 * else asks for it.
 */

/** A Discord snowflake, checked before it is ever put in a URL. */
const SNOWFLAKE = /^\d{5,32}$/;

/** Invite code for the *Space server. A new invite is a one-line change here. */
export const DISCORD_INVITE_CODE = 'xsQC6URzyQ';

/** The join link every "Join on Discord" affordance points at. */
export const DISCORD_INVITE = `https://discord.gg/${DISCORD_INVITE_CODE}`;

/**
 * Public, unauthenticated and CORS-open, so the browser calls it directly and
 * no server hop is needed. Pinned to v10 on purpose: an unversioned `/api/`
 * route floats to the oldest version Discord still supports, which is the one
 * they retire first.
 */
export const DISCORD_INVITE_API = `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true`;

/** What the invite endpoint tells us about the server right now. */
export type GuildCounts = {
	/** Approximate total members. */
	members: number;
	/** Approximate members online, or `null` when Discord omitted it. */
	online: number | null;
};

/**
 * Read the member and presence counts off the public invite endpoint.
 *
 * Both checks below matter. A rate-limited or revoked invite still answers with
 * JSON, just without a count, and reading that straight through leaves
 * `undefined` on the page — which renders as blank space under the heading and
 * reads as a slow load, so the failure goes unnoticed. Throw instead, and let
 * the caller show that it failed.
 *
 * @param fetcher injected so tests don't reach the network
 */
export async function fetchGuildCounts(fetcher: typeof fetch = fetch): Promise<GuildCounts> {
	const response = await fetcher(DISCORD_INVITE_API);
	if (!response.ok) throw new Error(`Discord answered ${response.status}`);

	const data = (await response.json()) as {
		approximate_member_count?: unknown;
		approximate_presence_count?: unknown;
	};

	if (typeof data.approximate_member_count !== 'number')
		throw new Error('no member count in the invite response');

	return {
		members: data.approximate_member_count,
		// Presence is a bonus, not a reason to fail the whole tile.
		online:
			typeof data.approximate_presence_count === 'number' ? data.approximate_presence_count : null
	};
}

/**
 * Where Discord serves one account's own avatar, or null if it has none.
 *
 * `hash` is what `/users/@me` calls `avatar` and what this site stores against
 * the OAuth account. Null is not a failure — an account that never set a
 * picture has no hash, and there is no URL that would show one. The caller
 * decides what to put there instead; `discordDefaultAvatarUrl` is the last
 * resort, but a picture the site already holds is a better one.
 *
 * Animated avatars are prefixed `a_` and are only animated as `.gif`; asking
 * for `.png` gets the still frame, which is a worse picture of them for no
 * reason.
 *
 * Null too for an id or a hash that is not one, because the result goes into an
 * `<img src>` and a row this site did not write is not trusted for being in
 * this site's database.
 */
export function discordAvatarUrl(
	userId: string,
	hash: string | null | undefined,
	size = 128
): string | null {
	if (!SNOWFLAKE.test(userId)) return null;
	if (!hash || !/^[a-zA-Z0-9_]{1,64}$/.test(hash)) return null;

	const extension = hash.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${extension}?size=${size}`;
}

/**
 * The avatar Discord itself shows for an account with no picture of its own.
 *
 * Chosen by the snowflake, so the same person always gets the same one. This is
 * the fallback of last resort: it is generic, and anything that is actually a
 * picture of them should win.
 */
export function discordDefaultAvatarUrl(userId: string): string | null {
	if (!SNOWFLAKE.test(userId)) return null;
	// Discord's own rule for which default an account gets. It is over the whole
	// snowflake; the legacy discriminator form is gone.
	return `https://cdn.discordapp.com/embed/avatars/${(BigInt(userId) >> 22n) % 6n}.png`;
}
