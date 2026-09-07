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
	 * Shared caches may hold this for as long as what it holds is worth reusing —
	 * the same distinction KV makes below, a day for a directory and five minutes
	 * for the page that says there isn't one. Browsers revalidate every time.
	 *
	 * `max-age=0` rather than the shared figure is the whole point. This is a
	 * document, and a document a browser considers fresh is one it will not ask
	 * about: the reader keeps the copy they happen to hold, and every correction
	 * behind it — a reconnected SpaceBot, a purged key, a redeploy — stays
	 * invisible until it expires. That is not theoretical. An unavailable page
	 * went out with a day's max-age, and afterwards the guide was blank on first
	 * load and correct on refresh, because refreshing is the one thing that
	 * bypasses a fresh cache entry.
	 *
	 * Revalidating costs a conditional request that is usually a 304, and
	 * `s-maxage` means the edge still absorbs the traffic.
	 */
	const cacheFor = (directory: GuildDirectory) => {
		const shared = directory.available ? DIRECTORY_CACHE_SECONDS : UNAVAILABLE_CACHE_SECONDS;
		setHeaders({
			'cache-control': `public, max-age=0, s-maxage=${shared}, stale-while-revalidate=86400`
		});
	};

	const kv = platform?.env?.KV;

	if (kv) {
		const cached = (await kv.get(CACHE_KEY, 'json').catch(() => null)) as CacheEntry | null;
		if (cached && Date.now() - cached.at < cached.ttl * 1000) {
			cacheFor(cached.directory);
			return { directory: cached.directory };
		}
	}

	const directory = await fetchGuildDirectory(await getSpaceBotConfig(platform)).catch(
		() => EMPTY_DIRECTORY
	);

	cacheFor(directory);

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
