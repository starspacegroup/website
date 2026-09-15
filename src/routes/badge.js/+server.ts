/**
 * GET /badge.js — the `<starspace-badge>` custom element, as a built asset.
 *
 * This is the one-line option: a host page adds the script and the element, and
 * the badge follows the reader's own colour scheme without the host copying any
 * CSS. The element is defined in `$lib/badge` as a string rather than a module
 * so it ships exactly as written, with no bundler step between here and the
 * page that loads it.
 *
 * The origin comes from the request, not from `site.config`, so a preview
 * deployment serves an element that points its mark at that same preview rather
 * than at production.
 */
import { badgeElementScript } from '$lib/badge';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	return new Response(badgeElementScript(url.origin), {
		headers: {
			'Content-Type': 'text/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
			'Access-Control-Allow-Origin': '*',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
