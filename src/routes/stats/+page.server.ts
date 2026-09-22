import {
	EMPTY_STATS,
	STATS_CACHE_SECONDS,
	STATS_UNAVAILABLE_CACHE_SECONDS,
	fetchGuildStats,
	type GuildStats
} from '$lib/server/guild-stats';
import {
	UNAVAILABLE_PROFILE,
	discordAccountId,
	fetchMemberProfile,
	type MemberProfile
} from '$lib/server/member-profile';
import { getSpaceBotConfig } from '$lib/server/spacebot-connection';
import type { PageServerLoad } from './$types';

/**
 * `/stats` — what the server has been doing, and what you have been doing in
 * it.
 *
 * Two halves, and they are separated on purpose:
 *
 * - **The server's figures are public.** Member counts, joins and leaves,
 *   messages and voice time per day: aggregates over everyone, nothing
 *   personal in any of them. A visitor who has not signed in sees the whole
 *   page except the panel about them, and there is no sign-in wall in front of
 *   it. They read from a KV entry shared across every visitor.
 * - **The personal panel needs a Discord account this site can see.** The id is
 *   read from `oauth_accounts` for the session the hooks established — never
 *   from the URL, never from anything the browser sent. Signing in is what
 *   proves ownership of the account; there is no other check, so there must be
 *   no other source for the id.
 *
 * Three states the page distinguishes, because they need three different
 * things said:
 *
 * 1. Not signed in, or signed in without Discord → server figures and an
 *    invitation to connect Discord.
 * 2. Signed in with Discord, not in the *Space server → server figures and an
 *    invite. Not an error: most people on the internet are not in it.
 * 3. Signed in with Discord, in the server → their own figures as well.
 *
 * Everything fails to the state above it. No SpaceBot, no `members:read`, a
 * bot that does not answer: the page renders the halves it has and says which
 * one is missing, rather than erroring.
 */

const STATS_CACHE_KEY = 'guild:stats';

type StatsEntry = { at: number; ttl: number; stats: GuildStats };

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	/**
	 * `private, no-store`, for the reason `/guide` carries the same header: the
	 * page is server-rendered with the signed-in nav, so any stored copy is a
	 * per-user copy. A shared cache would hand one visitor's nav to the next,
	 * and this page goes further — a stored copy would carry one person's own
	 * figures. The expensive part is held in KV below instead, which is shared
	 * because what it holds is not personal.
	 */
	setHeaders({ 'cache-control': 'private, no-store' });

	const config = await getSpaceBotConfig(platform);
	const kv = platform?.env?.KV;

	let stats: GuildStats | null = null;
	if (kv) {
		const cached = (await kv.get(STATS_CACHE_KEY, 'json').catch(() => null)) as StatsEntry | null;
		if (cached && Date.now() - cached.at < cached.ttl * 1000) stats = cached.stats;
	}

	if (!stats) {
		stats = await fetchGuildStats(config).catch(() => EMPTY_STATS);
		if (kv) {
			// A failed read is cached too, briefly. It stops every visitor during a
			// SpaceBot outage from queueing behind their own four-second timeout,
			// without pinning the failure in place for ten minutes.
			const ttl = stats.available ? STATS_CACHE_SECONDS : STATS_UNAVAILABLE_CACHE_SECONDS;
			const entry: StatsEntry = { at: Date.now(), ttl, stats };
			await kv
				.put(STATS_CACHE_KEY, JSON.stringify(entry), { expirationTtl: ttl * 2 })
				.catch(() => undefined);
		}
	}

	// The one identifier this page uses, and it comes from the database row for
	// the current session. A `?user=` parameter would make this a lookup service.
	const discordId = await discordAccountId(platform?.env?.DB, locals.user?.id);

	// Not cached in KV: one person's figures are not a shared answer, and SpaceBot
	// already marks its response `private` with a short life of its own.
	const profile: MemberProfile = discordId
		? await fetchMemberProfile(config, discordId).catch(() => UNAVAILABLE_PROFILE)
		: UNAVAILABLE_PROFILE;

	return {
		stats,
		profile,
		signedIn: Boolean(locals.user),
		/** Signed in, but with no Discord account linked to this site. */
		discordLinked: Boolean(discordId)
	};
};
