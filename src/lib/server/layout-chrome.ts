/**
 * What the root layout gives every page besides the signed-in user: the AI flag
 * and the CMS command-palette items. The same for every
 * visitor, and it changes only when an admin edits something.
 *
 * Before 2026-11-23 the root layout paid, on EVERY page view, a self-request to
 * /api/admin/ai-keys/status (through the whole hook chain), a read of every content
 * type plus a statement per registry type (`syncContentTypes`), the palette query and
 * KV reads. A forked production site measured settings lookups 5,192 times a day
 * and hit the D1 free-plan read wall (B4; ported from the Pinfool fork, fba97dc,
 * via NebulaKit backports 3c1e944).
 *
 * Now:
 *  - the AI flag is read directly from KV (`hasEnabledAiProvider`), no self-request;
 *  - `syncContentTypes` runs once per isolate (the registry is code: it only changes
 *    with a deploy, and a deploy starts new isolates), retried if it fails;
 *  - visitors share one copy for LAYOUT_CHROME_SECONDS through `cached()` (memory plus
 *    the Cache API, stale on failure);
 *  - an admin always reads it fresh, so their own edits show at once, and that fresh
 *    copy replaces the shared one (`prime`), so visitors on the same isolate and edge
 *    see the edit on their next load too. Other isolates converge within the TTL.
 *
 * The cache key carries a version: bump it when the shape changes, so a deploy never
 * reads an old-shaped copy out of the edge cache.
 */
import { hasEnabledAiProvider } from './ai-provider-status';
import { cached, primeReadCache } from './read-cache';
import { getCommandPaletteContentItems, syncContentTypes } from '$lib/services/cms';
import type { D1Database } from '@cloudflare/workers-types';

export const LAYOUT_CHROME_KEY = 'layout:chrome:v1';
export const LAYOUT_CHROME_SECONDS = 300;

export interface LayoutChrome {
	hasAIProviders: boolean;
	cmsPaletteItems: Awaited<ReturnType<typeof getCommandPaletteContentItems>>;
}

interface ChromePlatform {
	env?: { DB?: unknown; KV?: unknown };
}

let contentTypesSynced: Promise<void> | null = null;

/** Sync the registry into D1 once per isolate; a failure is retried next time. */
export function ensureContentTypesSynced(db: D1Database): Promise<void> {
	contentTypesSynced ??= syncContentTypes(db).catch((err) => {
		contentTypesSynced = null;
		throw err;
	});
	return contentTypesSynced;
}

/** Tests only. */
export function _resetContentTypesSynced(): void {
	contentTypesSynced = null;
}

/** Build the chrome from the bindings. Never throws: each part has a safe default. */
export async function buildLayoutChrome(
	platform: ChromePlatform | undefined
): Promise<LayoutChrome> {
	const kv = platform?.env?.KV as Parameters<typeof hasEnabledAiProvider>[0];
	const db = platform?.env?.DB as D1Database | undefined;
	const hasAIProviders = await hasEnabledAiProvider(kv);
	let cmsPaletteItems: LayoutChrome['cmsPaletteItems'] = [];
	if (db) {
		try {
			await ensureContentTypesSynced(db);
			cmsPaletteItems = await getCommandPaletteContentItems(db);
		} catch (error) {
			console.error('Failed to load CMS command palette items:', error);
		}
	}
	return { hasAIProviders, cmsPaletteItems };
}

/** Fresh for admins (and it refreshes the shared copy); shared for everyone else. */
export async function loadLayoutChrome(
	platform: ChromePlatform | undefined,
	isAdmin: boolean
): Promise<LayoutChrome> {
	if (isAdmin) {
		const fresh = await buildLayoutChrome(platform);
		await primeReadCache(LAYOUT_CHROME_KEY, fresh, LAYOUT_CHROME_SECONDS);
		return fresh;
	}
	return cached(LAYOUT_CHROME_KEY, () => buildLayoutChrome(platform), LAYOUT_CHROME_SECONDS);
}
