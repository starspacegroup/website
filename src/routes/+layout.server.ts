import { loadLayoutChrome } from '$lib/server/layout-chrome';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform, depends }) => {
	// Re-run when an admin changes something the palette shows (invalidate('app:palette')).
	depends?.('app:palette');
	// B4: the chrome (AI flag, palette items) is the same for every visitor, so it is
	// shared for a few minutes; an admin reads it fresh (src/lib/server/layout-chrome.ts).
	// No self-request to /api/admin/ai-keys/status, no content-type sync per view.
	const admin = !!(locals.user?.isAdmin || locals.user?.isOwner);
	const chrome = await loadLayoutChrome(platform, admin);
	return { user: locals.user || null, ...chrome };
};
