import {
	fetchMemberHistory,
	HISTORY_CACHE_SECONDS,
	type MemberHistory
} from '$lib/server/member-history';
import { getSpaceBotConfig } from '$lib/server/spacebot-connection';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/members/history — the last 90 days of member counts, one point per
 * day, for the trend line under the hero's number.
 *
 * Public and unauthenticated, like the count above it. There is nothing
 * personal in it: aggregate membership totals, the same figure the invite
 * endpoint already tells anyone who asks. The SpaceBot key stays on the server.
 *
 * Cached in KV for ten minutes. SpaceBot snapshots a few times a day, so a
 * fresher read would only cost the bot a query and change nothing on screen.
 * The timestamp travels inside the entry because KV's `expirationTtl` is only
 * a floor, not a promise of freshness.
 */
const CACHE_KEY = 'members:history';

type CacheEntry = { at: number; history: MemberHistory };

export const GET: RequestHandler = async ({ platform }) => {
	const kv = platform?.env?.KV;

	if (kv) {
		const cached = (await kv.get(CACHE_KEY, 'json').catch(() => null)) as CacheEntry | null;
		if (cached && Date.now() - cached.at < HISTORY_CACHE_SECONDS * 1000) {
			return respond(cached.history);
		}
	}

	const history = await fetchMemberHistory(await getSpaceBotConfig(platform));

	if (kv) {
		const entry: CacheEntry = { at: Date.now(), history };
		await kv
			.put(CACHE_KEY, JSON.stringify(entry), { expirationTtl: HISTORY_CACHE_SECONDS * 2 })
			.catch(() => undefined);
	}

	return respond(history);
};

function respond(history: MemberHistory) {
	return json(history, {
		headers: {
			'cache-control': `public, max-age=${HISTORY_CACHE_SECONDS}, stale-while-revalidate=3600`
		}
	});
}
