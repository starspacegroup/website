import { json } from '@sveltejs/kit';
import { hasEnabledAiProvider } from '$lib/server/ai-provider-status';
import type { RequestHandler } from './$types';

// GET - Check if any enabled AI providers exist (public endpoint)
export const GET: RequestHandler = async ({ platform }) =>
	json({ hasProviders: await hasEnabledAiProvider(platform?.env?.KV) });
