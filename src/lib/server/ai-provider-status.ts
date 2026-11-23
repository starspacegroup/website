import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Whether at least one AI provider key is stored and not switched off. Never throws:
 * without KV, or if a record cannot be read, the answer is no.
 *
 * Called directly by the root layout (src/lib/server/layout-chrome.ts) instead of a
 * self-request to /api/admin/ai-keys/status, which ran the whole hook chain again on
 * every page view (ported from the Pinfool fork, fba97dc).
 */
export async function hasEnabledAiProvider(kv: KVNamespace | undefined): Promise<boolean> {
	try {
		if (!kv) return false;
		const keysList = await kv.get('ai_keys_list');
		if (!keysList) return false;
		for (const keyId of JSON.parse(keysList)) {
			const keyData = await kv.get(`ai_key:${keyId}`);
			// A key counts as enabled unless `enabled` is explicitly false.
			if (keyData && JSON.parse(keyData).enabled !== false) return true;
		}
		return false;
	} catch (err) {
		console.error('Failed to check AI provider status:', err);
		return false;
	}
}
