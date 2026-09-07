/**
 * The site's connection to SpaceBot — one API key, stored once, used by both
 * the hero's voice panel and the member-count trend.
 *
 * Where it lives: KV first (`spacebot:connection`, written from
 * `/admin/spacebot`), then `platform.env` as a fallback. That order is the
 * point of the admin page — a deployment can be connected from the browser
 * without a redeploy, and a self-hosted fork can still bake it into env vars
 * and never open the page. It mirrors how `auth-provider-config.ts` resolves
 * OAuth credentials, for the same reason.
 *
 * The key is a secret and never leaves the server. Everything the admin page
 * renders comes from {@link describeConnection}, which carries a masked hint
 * and nothing else.
 */

/** KV key holding the connection written from the admin page. */
export const SPACEBOT_KV_KEY = 'spacebot:connection';

/** The channel the hero watches unless told otherwise. */
export const DEFAULT_CHANNEL = 'Ten Forward';

/** SpaceBot keys are `sb_live_` + hex. Anything else is a paste mistake. */
export const KEY_PATTERN = /^sb_live_[0-9a-f]{16,128}$/;

/** What the site needs to talk to SpaceBot. */
export type SpaceBotConfig = {
	apiUrl?: string;
	apiKey?: string;
	channel: string;
	/** Where the credentials came from, for the admin page to explain itself. */
	source: 'kv' | 'env' | 'none';
	/** When it was connected from the admin page. Null for env or unset. */
	connectedAt: string | null;
};

/** The stored record. Shape of the KV value. */
type StoredConnection = {
	apiUrl?: unknown;
	apiKey?: unknown;
	channel?: unknown;
	connectedAt?: unknown;
};

/**
 * Read the connection: KV, then env, then nothing.
 *
 * A partial KV record does not fall through to env field by field — a
 * half-written record is a mistake to surface, not to paper over with a
 * different deployment's key.
 */
export async function getSpaceBotConfig(
	platform: App.Platform | undefined
): Promise<SpaceBotConfig> {
	const env = (platform?.env ?? {}) as Record<string, string | undefined>;

	if (platform?.env?.KV) {
		try {
			const stored = (await platform.env.KV.get(
				SPACEBOT_KV_KEY,
				'json'
			)) as StoredConnection | null;
			const apiUrl = typeof stored?.apiUrl === 'string' ? stored.apiUrl : undefined;
			const apiKey = typeof stored?.apiKey === 'string' ? stored.apiKey : undefined;
			if (apiUrl && apiKey) {
				return {
					apiUrl,
					apiKey,
					channel:
						typeof stored?.channel === 'string' && stored.channel.trim()
							? stored.channel.trim()
							: DEFAULT_CHANNEL,
					source: 'kv',
					connectedAt: typeof stored?.connectedAt === 'string' ? stored.connectedAt : null
				};
			}
		} catch {
			// A KV read failure falls through to env rather than taking the hero
			// down; the admin page reports the connection as absent.
		}
	}

	if (env.SPACEBOT_API_URL && env.SPACEBOT_API_KEY) {
		return {
			apiUrl: env.SPACEBOT_API_URL,
			apiKey: env.SPACEBOT_API_KEY,
			channel: env.SPACEBOT_VOICE_CHANNEL?.trim() || DEFAULT_CHANNEL,
			source: 'env',
			connectedAt: null
		};
	}

	return {
		apiUrl: undefined,
		apiKey: undefined,
		channel: env.SPACEBOT_VOICE_CHANNEL?.trim() || DEFAULT_CHANNEL,
		source: 'none',
		connectedAt: null
	};
}

/**
 * Trim a pasted origin down to one SpaceBot can be reached at.
 *
 * People paste the page they were looking at, so a path, a query and a trailing
 * slash all get dropped rather than refused. `https` is required except on
 * localhost, because the key travels in a header.
 */
export function normalizeApiUrl(input: string): string | null {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}

	const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null;

	return url.origin;
}

/** `sb_live_1234…abcd` — enough to recognise a key, not enough to use one. */
export function maskKey(key: string): string {
	if (key.length <= 12) return 'sb_live_…';
	return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

export type ScopeCheck = 'ok' | 'unauthorized' | 'forbidden' | 'error' | 'unreachable';

export type SpaceBotStatus = {
	connected: boolean;
	source: SpaceBotConfig['source'];
	apiUrl: string | null;
	channel: string;
	keyHint: string | null;
	connectedAt: string | null;
	/** `voice:read` — the hero's live panel. */
	voice: ScopeCheck | 'unconfigured';
	/** `stats:read` — the member-count trend. */
	stats: ScopeCheck | 'unconfigured';
	/** `channels:read` — the channel list on /guide. */
	channels: ScopeCheck | 'unconfigured';
	/** `commands:read` — the command list on /guide. */
	commands: ScopeCheck | 'unconfigured';
	/** How many people are in the channel right now, when voice answered. */
	inVoice: number | null;
	/** How many days of member history came back, when stats answered. */
	historyDays: number | null;
	/** How many public channels came back, when channels answered. */
	channelCount: number | null;
	/** How many commands came back, when commands answered. */
	commandCount: number | null;
	checkedAt: string | null;
};

/** Map one SpaceBot response to a scope verdict. */
function verdict(status: number): ScopeCheck {
	if (status === 200) return 'ok';
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	return 'error';
}

async function probe(
	url: string,
	apiKey: string,
	fetcher: typeof fetch
): Promise<{ check: ScopeCheck; body: unknown }> {
	let response: Response;
	try {
		response = await fetcher(url, {
			headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
		});
	} catch {
		return { check: 'unreachable', body: null };
	}

	const check = verdict(response.status);
	if (check !== 'ok') return { check, body: null };

	try {
		return { check, body: await response.json() };
	} catch {
		return { check: 'error', body: null };
	}
}

/**
 * Ask SpaceBot whether the connection actually works, one probe per scope.
 *
 * One probe per scope, because they fail separately and the difference matters
 * to whoever is looking at the page: a key with `voice:read` and no `stats:read`
 * gives a live panel and no graph, and a key issued before the server guide
 * existed carries neither `channels:read` nor `commands:read` and leaves that
 * page empty. Each of those looks like a bug unless the page says which piece
 * is missing.
 *
 * @param fetcher injected so tests do not reach the network
 */
export async function verifySpaceBot(
	config: SpaceBotConfig,
	fetcher: typeof fetch = fetch
): Promise<SpaceBotStatus> {
	const base: SpaceBotStatus = {
		connected: false,
		source: config.source,
		apiUrl: config.apiUrl ?? null,
		channel: config.channel,
		keyHint: config.apiKey ? maskKey(config.apiKey) : null,
		connectedAt: config.connectedAt,
		voice: 'unconfigured',
		stats: 'unconfigured',
		channels: 'unconfigured',
		commands: 'unconfigured',
		inVoice: null,
		historyDays: null,
		channelCount: null,
		commandCount: null,
		checkedAt: null
	};

	if (!config.apiUrl || !config.apiKey) return base;

	const origin = config.apiUrl.replace(/\/$/, '');
	const [voice, stats, channels, commands] = await Promise.all([
		probe(
			`${origin}/api/v1/voice?channel=${encodeURIComponent(config.channel)}`,
			config.apiKey,
			fetcher
		),
		probe(`${origin}/api/v1/stats/members?period=24h&granularity=daily`, config.apiKey, fetcher),
		probe(`${origin}/api/v1/channels`, config.apiKey, fetcher),
		probe(`${origin}/api/v1/commands?limit=1`, config.apiKey, fetcher)
	]);

	const voiceBody = voice.body as { channels?: { members?: unknown[] }[] } | null;
	const statsBody = stats.body as { points?: unknown[] } | null;
	const channelsBody = channels.body as { count?: unknown } | null;
	const commandsBody = commands.body as { total?: unknown } | null;

	return {
		...base,
		connected: [voice, stats, channels, commands].some((result) => result.check === 'ok'),
		voice: voice.check,
		stats: stats.check,
		channels: channels.check,
		commands: commands.check,
		inVoice:
			voice.check === 'ok' && Array.isArray(voiceBody?.channels)
				? voiceBody.channels.reduce(
						(sum, channel) => sum + (Array.isArray(channel?.members) ? channel.members.length : 0),
						0
					)
				: null,
		historyDays:
			stats.check === 'ok' && Array.isArray(statsBody?.points) ? statsBody.points.length : null,
		channelCount:
			channels.check === 'ok' && typeof channelsBody?.count === 'number'
				? channelsBody.count
				: null,
		commandCount:
			commands.check === 'ok' && typeof commandsBody?.total === 'number'
				? commandsBody.total
				: null,
		checkedAt: new Date().toISOString()
	};
}

/** Store the connection. Overwrites whatever was there. */
export async function saveSpaceBotConnection(
	platform: App.Platform | undefined,
	connection: { apiUrl: string; apiKey: string; channel: string }
): Promise<void> {
	if (!platform?.env?.KV) throw new Error('KV storage not available');
	await platform.env.KV.put(
		SPACEBOT_KV_KEY,
		JSON.stringify({ ...connection, connectedAt: new Date().toISOString() })
	);
}

/**
 * Forget the connection, and the caches built from it.
 *
 * Dropping the cached snapshots matters: without it the hero would keep showing
 * live faces for up to ten minutes after someone disconnected the integration,
 * which is the one moment they are watching for it to stop.
 */
export async function clearSpaceBotConnection(platform: App.Platform | undefined): Promise<void> {
	if (!platform?.env?.KV) throw new Error('KV storage not available');
	await Promise.all([
		platform.env.KV.delete(SPACEBOT_KV_KEY),
		platform.env.KV.delete('voice:ten-forward').catch(() => undefined),
		platform.env.KV.delete('members:history').catch(() => undefined)
	]);
}
