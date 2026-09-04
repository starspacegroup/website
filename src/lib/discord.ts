/**
 * The *Space Discord server — the one external service the public pages talk to.
 *
 * The invite code used to be repeated in the join button and in the count
 * fetcher, so a new invite meant finding both. It lives here now and everything
 * else asks for it.
 */

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
