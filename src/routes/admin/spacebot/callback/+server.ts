import { redirect } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/auth-guards';
import {
	callbackUrl,
	exchangeCode,
	readConnectClient,
	STATE_COOKIE,
	timingSafeEqual
} from '$lib/server/spacebot-connect';
import {
	DEFAULT_CHANNEL,
	getSpaceBotConfig,
	saveSpaceBotConnection
} from '$lib/server/spacebot-connection';
import type { RequestHandler } from './$types';

/**
 * Finish the Connect handshake.
 *
 * What arrives here through the browser is a one-time code, which is useless
 * without the client secret. The key is fetched server-to-server and written
 * straight to KV; it is never rendered, logged, or put in a redirect.
 */
export const GET: RequestHandler = async ({ cookies, locals, platform, url }) => {
	requireOwner(locals);

	const back = (outcome: string) => redirect(303, `/admin/spacebot?connect=${outcome}`);

	// One-shot: clear it whatever happens, so a state cannot be replayed.
	const expectedState = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, { path: '/admin/spacebot' });

	const client = readConnectClient(platform);
	if (!client) throw back('unconfigured');

	const returnedState = url.searchParams.get('state') || '';
	if (!expectedState || !timingSafeEqual(expectedState, returnedState)) {
		throw back('state');
	}

	const code = url.searchParams.get('code') || '';
	if (!code) throw back('cancelled');

	// The same redirect_uri SpaceBot issued the code against; it will refuse a
	// mismatch, which is the point of sending it again.
	const result = await exchangeCode(client, code, callbackUrl(url.origin));
	if (!result.ok) throw back('failed');

	if (!platform?.env?.KV) throw back('storage');

	// Keep whatever channel was already chosen; connecting is about the
	// credential, not about re-picking the room.
	const existing = await getSpaceBotConfig(platform);

	await saveSpaceBotConnection(platform, {
		apiUrl: client.spacebotUrl,
		apiKey: result.apiKey,
		channel: existing.channel || DEFAULT_CHANNEL
	});

	throw back('ok');
};
