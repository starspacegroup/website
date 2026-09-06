import { getSpaceBotConfig, verifySpaceBot } from '$lib/server/spacebot-connection';
import { readConnectClient } from '$lib/server/spacebot-connect';
import { requireOwner } from '$lib/server/auth-guards';
import type { PageServerLoad } from './$types';

/**
 * What each `?connect=` outcome means to whoever is looking at the page.
 *
 * The callback never puts a reason in the URL beyond these keys — an error
 * string round-tripped through a redirect is a place to inject text into an
 * admin page, and none of these need one.
 */
const CONNECT_OUTCOMES: Record<string, { message: string; failed: boolean }> = {
	ok: { message: 'Connected. SpaceBot issued a key for the server you picked.', failed: false },
	cancelled: { message: 'Connection cancelled — nothing changed.', failed: false },
	state: {
		message:
			'That connection attempt did not start from this page, so it was refused. Try again from here.',
		failed: true
	},
	failed: {
		message: 'SpaceBot would not complete the exchange. Approve again to get a fresh code.',
		failed: true
	},
	unconfigured: {
		message: 'One-click connect is not set up for this site yet — paste a key instead.',
		failed: true
	},
	storage: { message: 'Storage was unavailable, so nothing was saved.', failed: true }
};

/**
 * The connection is verified on load, so the page opens on the truth rather
 * than on "connected" and a spinner. The guard runs here as well as in the API
 * because the admin layout admits admins, and this page is owner-only.
 */
export const load: PageServerLoad = async ({ platform, locals, url }) => {
	requireOwner(locals);

	const outcomeKey = url.searchParams.get('connect');

	return {
		status: await verifySpaceBot(await getSpaceBotConfig(platform)),
		// A Connect button that cannot work is worse than no button, so the page
		// only offers it when this site is actually registered with a SpaceBot.
		connectAvailable: readConnectClient(platform) !== null,
		outcome: (outcomeKey && CONNECT_OUTCOMES[outcomeKey]) || null
	};
};
