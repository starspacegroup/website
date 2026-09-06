import {
	fetchVoiceSnapshot,
	readVoiceConfig,
	VOICE_CACHE_SECONDS,
	type VoiceSnapshot
} from '$lib/server/voice-channel';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/voice — who is in #Ten Forward right now, for the home hero.
 *
 * Public and unauthenticated, because the hero is. What keeps it safe is that
 * the SpaceBot key never leaves the server and the three-person threshold is
 * applied before the response is built (see `$lib/server/voice-channel`): below
 * it, this answers `{"live":false}` and nothing else.
 *
 * The KV cache is here to protect SpaceBot, not this site. Every open tab polls
 * this route, so without it a busy afternoon would hit the bot's D1 once per
 * visitor per interval.
 *
 * The entry carries its own timestamp because KV's `expirationTtl` has a 60
 * second floor — asking for ten would be rejected. So the row lives for a
 * minute and this decides, on read, whether it is still fresh enough to serve.
 */
const CACHE_KEY = 'voice:ten-forward';

type CacheEntry = { at: number; snapshot: VoiceSnapshot };

export const GET: RequestHandler = async ({ platform }) => {
	const kv = platform?.env?.KV;

	if (kv) {
		const cached = (await kv.get(CACHE_KEY, 'json').catch(() => null)) as CacheEntry | null;
		if (cached && Date.now() - cached.at < VOICE_CACHE_SECONDS * 1000) {
			return respond(cached.snapshot);
		}
	}

	const snapshot = await fetchVoiceSnapshot(readVoiceConfig(platform));

	if (kv) {
		const entry: CacheEntry = { at: Date.now(), snapshot };
		// Never let a cache write failure take the hero down with it.
		await kv.put(CACHE_KEY, JSON.stringify(entry), { expirationTtl: 60 }).catch(() => undefined);
	}

	return respond(snapshot);
};

function respond(snapshot: VoiceSnapshot) {
	return json(snapshot, {
		headers: {
			// `stale-while-revalidate` matters more than the max-age here: it keeps
			// the panel drawn while the next snapshot is on its way, instead of
			// blinking to the simulation and back.
			'cache-control': `public, max-age=${VOICE_CACHE_SECONDS}, stale-while-revalidate=30`
		}
	});
}
