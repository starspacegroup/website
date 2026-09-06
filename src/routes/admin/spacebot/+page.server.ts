import { getSpaceBotConfig, verifySpaceBot } from '$lib/server/spacebot-connection';
import { requireOwner } from '$lib/server/auth-guards';
import type { PageServerLoad } from './$types';

/**
 * The connection is verified on load, so the page opens on the truth rather
 * than on "connected" and a spinner. The guard runs here as well as in the API
 * because the admin layout admits admins, and this page is owner-only.
 */
export const load: PageServerLoad = async ({ platform, locals }) => {
	requireOwner(locals);
	return { status: await verifySpaceBot(await getSpaceBotConfig(platform)) };
};
