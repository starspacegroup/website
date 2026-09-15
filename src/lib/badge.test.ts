/**
 * The badge module.
 *
 * Two properties are worth more than the rest and most of this file is about
 * them, because both fail silently on somebody else's site rather than here:
 *
 *  - the SVG references nothing external, so it renders inside an `<img>`
 *  - no colour is a theme token, so it renders on a page that never loaded
 *    `src/app.css`
 */
import { describe, expect, it } from 'vitest';

import {
	BADGE_BRAND,
	BADGE_HREF,
	BADGE_THEMES,
	BADGE_VARIANTS,
	BADGE_VARIANT_KEYS,
	badgeElementScript,
	badgeSnippets,
	badgeSvgUrl,
	badgeText,
	badgeWidth,
	escapeXml,
	isBadgeTheme,
	isBadgeVariant,
	renderBadgeSvg,
	textWidth,
	type BadgeVariant
} from './badge';

const ORIGIN = 'https://example.test';

describe('badge variants and themes', () => {
	it('offers a wording for something building, something built, and a person', () => {
		expect(BADGE_VARIANT_KEYS).toEqual(['building', 'built', 'member']);
	});

	it('accepts only the named wordings', () => {
		expect(isBadgeVariant('built')).toBe(true);
		expect(isBadgeVariant('BUILT')).toBe(false);
		expect(isBadgeVariant('toString')).toBe(false);
		expect(isBadgeVariant(null)).toBe(false);
		expect(isBadgeVariant(7)).toBe(false);
	});

	it('accepts only the two grounds', () => {
		expect(isBadgeTheme('dark')).toBe(true);
		expect(isBadgeTheme('light')).toBe(true);
		expect(isBadgeTheme('auto')).toBe(false);
		expect(isBadgeTheme(undefined)).toBe(false);
	});

	it('reads as a sentence', () => {
		expect(badgeText('building')).toBe('Currently being built at *Space');
		expect(badgeText('member')).toBe('Member of *Space');
	});
});

describe('escapeXml', () => {
	it('escapes all five XML metacharacters', () => {
		expect(escapeXml(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
	});

	it('escapes the ampersand first, so an escape is never double-escaped', () => {
		expect(escapeXml('&lt;')).toBe('&amp;lt;');
	});
});

describe('textWidth', () => {
	it('measures each glyph rather than averaging them', () => {
		// The defect this replaced: one average advance for every capital, which
		// put "*Space" hard against "MEMBER OF" and a gulf after "BUILT AT".
		const wide = textWidth('MM', 10, { M: 833 });
		const narrow = textWidth('II', 10, { I: 278 });
		expect(wide).toBeCloseTo(16.66);
		expect(narrow).toBeCloseTo(5.56);
	});

	it('adds the tracking once per character', () => {
		expect(textWidth('AA', 10, { A: 500 }, 2)).toBeCloseTo(14);
	});

	it('falls back to an average for a glyph the table does not name', () => {
		// Reached only by a wording carrying something outside A–Z and a space.
		expect(textWidth('7', 10, { A: 500 })).toBeCloseTo(6);
	});
});

describe('badgeWidth', () => {
	it('grows with the wording', () => {
		expect(badgeWidth('building')).toBeGreaterThan(badgeWidth('built'));
	});

	it('leaves room for the mark, the label and the brand', () => {
		// The estimate is deliberately slack — there are no text metrics in a
		// Worker. This asserts it is in the right order of magnitude, not exact.
		expect(badgeWidth('built')).toBeGreaterThan(100);
		expect(badgeWidth('building')).toBeLessThan(400);
	});
});

describe('renderBadgeSvg', () => {
	const every = BADGE_VARIANT_KEYS.flatMap((variant) =>
		(['dark', 'light'] as const).map((theme) => ({ variant, theme }))
	);

	it.each(every)('renders $variant on $theme with nothing external', ({ variant, theme }) => {
		const svg = renderBadgeSvg(variant, theme);

		// The one defect that cannot be seen from here: an `<img>`-embedded SVG
		// silently drops every external fetch, so a referenced font, stylesheet or
		// mark renders as a blank space on a stranger's README.
		expect(svg).not.toMatch(/href="https?:/);
		expect(svg).not.toContain('<link');
		expect(svg).not.toContain('@import');
		expect(svg).toContain('href="data:image/');

		// And no theme token, because the host page never loaded src/app.css.
		expect(svg).not.toContain('var(--');
		expect(svg).toContain(BADGE_THEMES[theme].background);
		expect(svg).toContain(BADGE_THEMES[theme].brand);
	});

	it('states its own size, because a README renders it at intrinsic size', () => {
		const svg = renderBadgeSvg('built', 'dark');
		expect(svg).toContain(`width="${badgeWidth('built')}"`);
		expect(svg).toContain('height="28"');
		expect(svg).toContain(`viewBox="0 0 ${badgeWidth('built')} 28"`);
	});

	it('names itself to a screen reader', () => {
		const svg = renderBadgeSvg('member', 'light');
		expect(svg).toContain('role="img"');
		expect(svg).toContain('aria-label="Member of *Space"');
		expect(svg).toContain('<title>Member of *Space</title>');
	});

	it('defaults to the shipped badge', () => {
		expect(renderBadgeSvg()).toBe(renderBadgeSvg('built', 'dark'));
	});

	it('writes the label in capitals', () => {
		expect(renderBadgeSvg('built', 'dark')).toContain('>BUILT AT<');
	});
});

describe('badgeSvgUrl', () => {
	it('names both parameters', () => {
		expect(badgeSvgUrl(ORIGIN, 'member', 'light')).toBe(
			`${ORIGIN}/badge.svg?variant=member&theme=light`
		);
	});

	it('never doubles the slash', () => {
		expect(badgeSvgUrl(`${ORIGIN}/`, 'built', 'dark')).toBe(
			`${ORIGIN}/badge.svg?variant=built&theme=dark`
		);
	});
});

describe('badgeSnippets', () => {
	const snippets = badgeSnippets({ variant: 'building', theme: 'dark', origin: `${ORIGIN}/` });
	const forms = Object.entries(snippets);

	it('offers all six forms', () => {
		expect(Object.keys(snippets).sort()).toEqual([
			'html',
			'markdown',
			'react',
			'svelte',
			'vue',
			'webComponent'
		]);
	});

	it.each(forms)('%s points at the given origin and never at a doubled slash', (_name, code) => {
		expect(code).toContain(ORIGIN);
		expect(code).not.toContain(`${ORIGIN}//`);
	});

	it.each(forms.filter(([name]) => name !== 'webComponent'))(
		'%s links back to *Space',
		(_name, code) => {
			expect(code).toContain(BADGE_HREF);
		}
	);

	it('leaves the web component’s link to the element itself', () => {
		// The one snippet with no anchor in it — the element writes its own, from
		// the script at /badge.js. Asserted here so "it has no link" stays a
		// deliberate fact rather than looking like an oversight.
		expect(snippets.webComponent).not.toContain(BADGE_HREF);
		expect(badgeElementScript(ORIGIN)).toContain(`href="${BADGE_HREF}"`);
	});

	it('carries the wording the caller asked for', () => {
		expect(snippets.html).toContain(BADGE_VARIANTS.building);
		expect(snippets.html).not.toContain(BADGE_VARIANTS.member);
	});

	it('references the PNG mark rather than inlining 5 KB of base64 into a page', () => {
		// The split the module exists to keep: the SVG carries its artwork because
		// it must; a snippet someone pastes into their own JSX must not.
		expect(snippets.react).toContain(`${ORIGIN}/badge-mark.png`);
		expect(snippets.react).not.toContain('data:image/');
	});

	it('gives the pasted CSS a light-scheme override in both directions', () => {
		expect(badgeSnippets({ variant: 'built', theme: 'dark', origin: ORIGIN }).html).toContain(
			'@media (prefers-color-scheme:light)'
		);
		expect(badgeSnippets({ variant: 'built', theme: 'light', origin: ORIGIN }).html).toContain(
			'@media (prefers-color-scheme:dark)'
		);
	});

	it('pins a theme in the Markdown snippet, which has no media queries', () => {
		expect(snippets.markdown).toBe(
			`[![${badgeText('building')}](${badgeSvgUrl(ORIGIN, 'building', 'dark')})](${BADGE_HREF})`
		);
	});

	it('loads the element from this origin in the web-component snippet', () => {
		expect(snippets.webComponent).toContain(`${ORIGIN}/badge.js`);
		expect(snippets.webComponent).toContain('<starspace-badge variant="building">');
	});

	it('scopes its class so it cannot collide with the host page', () => {
		expect(snippets.svelte).toContain('class="starspace-badge"');
		expect(snippets.vue).toContain('scoped');
	});
});

describe('badgeElementScript', () => {
	const script = badgeElementScript(`${ORIGIN}/`);

	it('defines the element once, whatever else the page has loaded', () => {
		expect(script).toContain("customElements.get('starspace-badge')");
		expect(script).toContain('customElements.define(');
	});

	it('renders into a shadow root, so neither side’s CSS reaches the other', () => {
		expect(script).toContain("attachShadow({ mode: 'open' })");
	});

	it('points the mark at the serving origin, with no doubled slash', () => {
		expect(script).toContain(`${ORIGIN}/badge-mark.png`);
		expect(script).not.toContain(`${ORIGIN}//`);
	});

	it('carries every wording, so the attribute is resolved in the page', () => {
		for (const key of BADGE_VARIANT_KEYS) {
			expect(script).toContain(`"${key}"`);
		}
		expect(script).toContain(BADGE_BRAND);
	});

	it('falls back to the shipped wording for an attribute it does not know', () => {
		expect(script).toContain("variant = 'built'");
	});
});

describe('the element and the SVG agree', () => {
	it('uses the same colours in both', () => {
		const script = badgeElementScript(ORIGIN);
		for (const theme of ['dark', 'light'] as const) {
			const svg = renderBadgeSvg('built', theme);
			for (const colour of Object.values(BADGE_THEMES[theme])) {
				expect(script).toContain(colour);
				expect(svg).toContain(colour);
			}
		}
	});

	it('uses the same words in both', () => {
		const script = badgeElementScript(ORIGIN);
		for (const key of BADGE_VARIANT_KEYS as readonly BadgeVariant[]) {
			expect(script).toContain(BADGE_VARIANTS[key]);
			expect(renderBadgeSvg(key, 'dark')).toContain(BADGE_VARIANTS[key].toUpperCase());
		}
	});
});
