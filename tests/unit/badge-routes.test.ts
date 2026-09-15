/**
 * The two endpoints the badge is actually reachable through.
 *
 * Both are embedded on sites this one does not own, so the things worth
 * asserting are the ones a broken deploy would hide: the media types, the
 * cross-origin header, and that a hand-edited query string degrades to the
 * shipped badge instead of rendering something strange.
 */
import { describe, expect, it } from 'vitest';

import { badgeWidth, BADGE_VARIANTS, renderBadgeSvg } from '../../src/lib/badge';
import { GET as badgeSvgGet } from '../../src/routes/badge.svg/+server';
import { GET as badgeJsGet } from '../../src/routes/badge.js/+server';

const ORIGIN = 'https://example.test';

/** Minimal event stub — both handlers read nothing but `url`. */
function event(path: string) {
	return { url: new URL(`${ORIGIN}${path}`) } as never;
}

const svg = async (query = '') => await (await badgeSvgGet(event(`/badge.svg${query}`))).text();

describe('GET /badge.svg', () => {
	it('serves an SVG a README can embed', async () => {
		const response = await badgeSvgGet(event('/badge.svg'));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('cache-control')).toContain('max-age=');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('defaults to "Built at *Space" on the dark ground', async () => {
		expect(await svg()).toBe(renderBadgeSvg('built', 'dark'));
	});

	it('renders the wording and ground the query string asks for', async () => {
		expect(await svg('?variant=building&theme=light')).toBe(renderBadgeSvg('building', 'light'));
		expect(await svg('?variant=member&theme=dark')).toBe(renderBadgeSvg('member', 'dark'));
	});

	it('takes each parameter on its own', async () => {
		expect(await svg('?theme=light')).toBe(renderBadgeSvg('built', 'light'));
		expect(await svg('?variant=member')).toBe(renderBadgeSvg('member', 'dark'));
	});

	it('falls back to the default rather than 400ing on a value it does not know', async () => {
		// The query string gets copied by hand and edited. A broken image in
		// somebody else's README tells them nothing; the shipped badge does.
		const response = await badgeSvgGet(event('/badge.svg?variant=shipping&theme=sepia'));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(renderBadgeSvg('built', 'dark'));
	});

	it('never renders an inherited property as the label', async () => {
		// `variant in BADGE_VARIANTS` walked the prototype chain, so this URL used
		// to put "function toString() { [native code] }" inside the badge.
		for (const probe of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
			const body = await svg(`?variant=${encodeURIComponent(probe)}`);
			expect(body).toBe(renderBadgeSvg('built', 'dark'));
			expect(body).not.toContain('native code');
		}
	});

	it('puts nothing from the request into the document', async () => {
		const body = await svg('?variant=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E&theme=%27');
		expect(body).not.toContain('<script');
		expect(body).not.toContain('alert(1)');
		expect(body).toBe(renderBadgeSvg('built', 'dark'));
	});

	it('states a width that matches the wording it rendered', async () => {
		expect(await svg('?variant=building')).toContain(`width="${badgeWidth('building')}"`);
		expect(await svg('?variant=built')).toContain(`width="${badgeWidth('built')}"`);
	});
});

describe('GET /badge.js', () => {
	it('serves the custom element as a script', async () => {
		const response = await badgeJsGet(event('/badge.js'));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('defines <starspace-badge> with every wording', async () => {
		const body = await (await badgeJsGet(event('/badge.js'))).text();
		expect(body).toContain('customElements.define(');
		expect(body).toContain('starspace-badge');
		for (const wording of Object.values(BADGE_VARIANTS)) {
			expect(body).toContain(wording);
		}
	});

	it('points the mark at the origin that served it, not at production', async () => {
		// A preview deployment must hand out an element that works on the preview.
		const body = await (await badgeJsGet(event('/badge.js'))).text();
		expect(body).toContain(`${ORIGIN}/badge-mark.png`);
	});
});
