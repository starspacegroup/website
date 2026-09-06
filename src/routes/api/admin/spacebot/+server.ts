import { requireOwner } from '$lib/server/auth-guards';
import {
	clearSpaceBotConnection,
	DEFAULT_CHANNEL,
	getSpaceBotConfig,
	KEY_PATTERN,
	normalizeApiUrl,
	saveSpaceBotConnection,
	verifySpaceBot
} from '$lib/server/spacebot-connection';
import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * The SpaceBot connection, managed from `/admin/spacebot`.
 *
 * Owner-only, not admin-only: this reads and writes an API key, and the site
 * already draws that line for credentials in `/api/admin/auth-keys`.
 *
 * No response ever carries the key itself — only the masked hint that
 * `verifySpaceBot` puts in its status.
 */

/** GET — the current connection, verified against SpaceBot. */
export const GET: RequestHandler = async ({ platform, locals }) => {
	requireOwner(locals);
	const config = await getSpaceBotConfig(platform);
	return json({ status: await verifySpaceBot(config) });
};

/**
 * POST — connect, or replace the connection.
 *
 * The key is verified BEFORE it is stored. A key that answers 401 is a typo, and
 * saving it would leave the hero silently falling back to its simulation with
 * nothing on screen to say why. A key that authenticates but is missing a scope
 * IS stored — half the integration is worth having, and the page says which half
 * is missing.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	requireOwner(locals);
	if (!platform?.env?.KV) throw error(503, 'KV storage not available');

	let body: { apiUrl?: unknown; apiKey?: unknown; channel?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Expected a JSON body');
	}

	const apiUrl = typeof body.apiUrl === 'string' ? normalizeApiUrl(body.apiUrl) : null;
	if (!apiUrl) throw error(400, 'Enter SpaceBot’s address, e.g. https://spacebot.starspace.group');

	const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
	if (!KEY_PATTERN.test(apiKey)) {
		throw error(400, 'That does not look like a SpaceBot API key (they start with sb_live_)');
	}

	const channel =
		typeof body.channel === 'string' && body.channel.trim()
			? body.channel.trim().replace(/^#/, '')
			: DEFAULT_CHANNEL;

	const status = await verifySpaceBot(
		{ apiUrl, apiKey, channel, source: 'kv', connectedAt: null },
		fetch
	);

	if (status.voice === 'unreachable' && status.stats === 'unreachable') {
		throw error(502, `Could not reach SpaceBot at ${apiUrl}`);
	}
	if (status.voice === 'unauthorized' && status.stats === 'unauthorized') {
		throw error(401, 'SpaceBot rejected that key');
	}

	await saveSpaceBotConnection(platform, { apiUrl, apiKey, channel });

	// Report the stored connection, not the probe: `source` and `connectedAt`
	// are only true once it is written.
	return json({ status: await verifySpaceBot(await getSpaceBotConfig(platform)) });
};

/** DELETE — disconnect, and drop the caches built from the old key. */
export const DELETE: RequestHandler = async ({ platform, locals }) => {
	requireOwner(locals);
	if (!platform?.env?.KV) throw error(503, 'KV storage not available');

	try {
		await clearSpaceBotConnection(platform);
	} catch (err) {
		if (isHttpError(err)) throw err;
		throw error(500, 'Failed to disconnect SpaceBot');
	}

	return json({ status: await verifySpaceBot(await getSpaceBotConfig(platform)) });
};
