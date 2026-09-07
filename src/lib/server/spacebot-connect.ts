/**
 * The site's half of SpaceBot's Connect handshake.
 *
 * Instead of asking the owner to open SpaceBot, mint a key with the right two
 * scopes and paste it back, the button sends them to SpaceBot's consent screen
 * and we collect the result. What comes back through the browser is a one-time
 * code, not a key: the key itself is fetched over a server-to-server call using
 * a client secret the browser never sees, so it never lands in a URL, a
 * referrer header or an access log.
 *
 * Two things this file is responsible for:
 *
 * - **`state`.** Generated here, stored in an httpOnly cookie, and required to
 *   match on the way back. Without it, anyone could hand the owner a link that
 *   completes a connection to *their* SpaceBot instead of ours.
 * - **Never trusting the redirect.** The code is worthless without the client
 *   secret, and the exchange sends the same `redirect_uri` SpaceBot issued the
 *   code against.
 */

/**
 * Everything this site reads from SpaceBot: the hero's live panel and member
 * graph, and the server guide's channel directory and command list. All four are
 * read-only. A key granted fewer still works — each surface fails to nothing on
 * its own rather than taking the others down.
 */
export const CONNECT_SCOPES = [
	'voice:read',
	'stats:read',
	'channels:read',
	'commands:read'
] as const;

/** Where the CSRF state lives between the redirect out and the callback. */
export const STATE_COOKIE = 'spacebot_connect_state';

/** The state is only useful for the length of one round trip. */
export const STATE_TTL_SECONDS = 600;

export type ConnectClient = {
	clientId: string;
	clientSecret: string;
	spacebotUrl: string;
};

/**
 * Read the registration from the environment.
 *
 * Returns null when the site has not been registered with a SpaceBot instance,
 * which is the signal to keep showing the paste-a-key form and nothing else —
 * a Connect button that cannot work is worse than no button.
 */
export function readConnectClient(platform: App.Platform | undefined): ConnectClient | null {
	const env = (platform?.env ?? {}) as Record<string, string | undefined>;

	const clientId = env.SPACEBOT_CONNECT_CLIENT_ID?.trim();
	const clientSecret = env.SPACEBOT_CONNECT_CLIENT_SECRET?.trim();
	const spacebotUrl = (env.SPACEBOT_CONNECT_URL || env.SPACEBOT_API_URL)?.trim();

	if (!clientId || !clientSecret || !spacebotUrl) return null;

	let origin: string;
	try {
		origin = new URL(spacebotUrl).origin;
	} catch {
		return null;
	}

	return { clientId, clientSecret, spacebotUrl: origin };
}

/** A 256-bit URL-safe value. */
export function generateState(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare two states without leaking how much of one matched through timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
	if (typeof a !== 'string' || typeof b !== 'string') return false;
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** The callback address, which must match SpaceBot's registration exactly. */
export function callbackUrl(origin: string): string {
	return `${origin.replace(/\/$/, '')}/admin/spacebot/callback`;
}

export function buildAuthorizeUrl(
	client: ConnectClient,
	redirectUri: string,
	state: string
): string {
	const url = new URL('/connect', client.spacebotUrl);
	url.searchParams.set('client_id', client.clientId);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('scope', CONNECT_SCOPES.join(' '));
	url.searchParams.set('state', state);
	return url.toString();
}

export type ExchangeResult =
	{ ok: true; apiKey: string; guildId: string; scopes: string[] } | { ok: false; error: string };

/**
 * Trade the one-time code for a key, server to server.
 *
 * @param fetcher injected so tests do not reach the network
 */
export async function exchangeCode(
	client: ConnectClient,
	code: string,
	redirectUri: string,
	fetcher: typeof fetch = fetch
): Promise<ExchangeResult> {
	let response: Response;
	try {
		response = await fetcher(`${client.spacebotUrl}/api/v1/connect/exchange`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({
				client_id: client.clientId,
				client_secret: client.clientSecret,
				code,
				redirect_uri: redirectUri
			})
		});
	} catch {
		return { ok: false, error: 'SpaceBot could not be reached to finish connecting.' };
	}

	let payload: Record<string, unknown>;
	try {
		payload = (await response.json()) as Record<string, unknown>;
	} catch {
		return { ok: false, error: 'SpaceBot returned something unreadable.' };
	}

	if (!response.ok) {
		const message = typeof payload.error === 'string' ? payload.error : 'Exchange refused.';
		return { ok: false, error: message };
	}

	const apiKey = typeof payload.api_key === 'string' ? payload.api_key : '';
	const guildId = typeof payload.guild_id === 'string' ? payload.guild_id : '';
	if (!apiKey || !guildId) {
		return { ok: false, error: 'SpaceBot did not return a usable key.' };
	}

	return {
		ok: true,
		apiKey,
		guildId,
		scopes: Array.isArray(payload.scopes) ? payload.scopes.map(String) : []
	};
}
