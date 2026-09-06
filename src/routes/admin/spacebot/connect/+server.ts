import { redirect } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/auth-guards';
import {
	buildAuthorizeUrl,
	callbackUrl,
	generateState,
	readConnectClient,
	STATE_COOKIE,
	STATE_TTL_SECONDS
} from '$lib/server/spacebot-connect';
import type { RequestHandler } from './$types';

/**
 * Start the Connect handshake: send the owner to SpaceBot's consent screen.
 *
 * Owner-only, like every other route that touches this credential. The `state`
 * goes into an httpOnly cookie before we leave, and the callback refuses
 * anything that does not match it — otherwise a link someone else crafted could
 * complete a connection to their SpaceBot rather than ours.
 */
export const GET: RequestHandler = async ({ cookies, locals, platform, url }) => {
	requireOwner(locals);

	const client = readConnectClient(platform);
	if (!client) {
		throw redirect(303, '/admin/spacebot?connect=unconfigured');
	}

	const state = generateState();

	cookies.set(STATE_COOKIE, state, {
		path: '/admin/spacebot',
		httpOnly: true,
		secure: url.protocol === 'https:',
		// Lax, not Strict: the callback arrives as a top-level navigation from
		// SpaceBot, and Strict would withhold the cookie exactly then.
		sameSite: 'lax',
		maxAge: STATE_TTL_SECONDS
	});

	throw redirect(303, buildAuthorizeUrl(client, callbackUrl(url.origin), state));
};
