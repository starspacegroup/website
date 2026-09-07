import {
	DIRECTORY_CACHE_SECONDS,
	EMPTY_DIRECTORY,
	fetchGuildDirectory,
	type GuildDirectory
} from '$lib/server/guild-directory';
import { getSpaceBotConfig } from '$lib/server/spacebot-connection';
import type { PageServerLoad } from './$types';

/**
 * The server guide: what the channels are for, and what you can type.
 *
 * Server-rendered rather than fetched from the browser. This is reference
 * content — a crawler, an agent reading the Markdown negotiation, and a person
 * with JavaScript off should all get the whole page in the HTML, and there is
 * no live element on it to justify a second round trip.
 *
 * Cached in KV for a day. Channels and commands change on the order of weeks,
 * the answer is identical for every visitor, and the gateway pushes its own
 * changes into SpaceBot within seconds — this only governs how often the site
 * asks. The timestamp lives inside the entry because KV's `expirationTtl` is a
 * floor, not a promise.
 */
const CACHE_KEY = 'guild:directory';

/** `ttl` travels with the entry: a failed read is cached far more briefly
 *  than a good one, and the freshness check has to know which it is holding. */
type CacheEntry = { at: number; ttl: number; directory: GuildDirectory };

/** How long to trust a directory SpaceBot could not give us. */
const UNAVAILABLE_CACHE_SECONDS = 300;

export const load: PageServerLoad = async ({ platform, setHeaders }) => {
	/**
	 * `private, no-store`: no cache, browser or shared, may keep this response.
	 * Every load renders fresh from the origin.
	 *
	 * The page carries the nav bar, rendered server-side with the signed-in
	 * user, so a stored copy is a per-user copy — and storing it caused two
	 * distinct bugs. A shared `s-maxage` let the edge hand one visitor's nav to
	 * the next. And `stale-while-revalidate` let a browser keep serving its own
	 * stored copy for a day: after signing in, a refresh of the guide showed the
	 * signed-out nav, because the browser answered from that day-old copy instead
	 * of asking. `no-store` ends both — nothing is ever stored, so nothing stale
	 * or cross-user can be served, and a browser drops any copy it already holds
	 * the next time it fetches.
	 *
	 * Nothing is lost. The one expensive part — the read from SpaceBot — is held
	 * in KV below, shared across every request; the render itself is cheap.
	 */
	const cacheFor = () => {
		setHeaders({ 'cache-control': 'private, no-store' });
	};

	const kv = platform?.env?.KV;

	if (kv) {
		const cached = (await kv.get(CACHE_KEY, 'json').catch(() => null)) as CacheEntry | null;
		if (cached && Date.now() - cached.at < cached.ttl * 1000) {
			cacheFor();
			return { directory: cached.directory };
		}
	}

	const directory = await fetchGuildDirectory(await getSpaceBotConfig(platform)).catch(
		() => EMPTY_DIRECTORY
	);

	cacheFor();

	// An unavailable directory is cached too, for a fraction of the time. It
	// stops every visitor during a SpaceBot outage from queueing behind their own
	// four-second timeout, without pinning the failure in place for a day.
	if (kv) {
		const ttl = directory.available ? DIRECTORY_CACHE_SECONDS : UNAVAILABLE_CACHE_SECONDS;
		const entry: CacheEntry = { at: Date.now(), ttl, directory };
		await kv
			.put(CACHE_KEY, JSON.stringify(entry), { expirationTtl: ttl * 2 })
			.catch(() => undefined);
	}

	return { directory };
};
