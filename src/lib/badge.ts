/**
 * The "Built at *Space" badge, in every form someone might need it.
 *
 * This module is the single source for the badge: its wording, its colours, its
 * geometry, the SVG that READMEs embed, and every copy-paste snippet the
 * `/badge` page hands out. Change it here and the page, the image endpoint and
 * all six snippets move together.
 *
 * Two constraints shape everything below, and both are easy to forget:
 *
 * 1. **The badge lands on sites we do not own.** It cannot reference a *Space
 *    theme token, a font, a stylesheet or an image URL and expect it to
 *    resolve. Every colour is a literal and the mark travels as a data URI.
 *    That is the opposite of the rule inside this app, and it is deliberate.
 *
 * 2. **An SVG used as an `<img>` may not fetch anything external.** A README
 *    badge is exactly that. A referenced mark would fail silently — a blank
 *    space with nothing to explain it — which is the same trap documented for
 *    the favicons in `brand/README.md`.
 *
 * Kept dependency-free so the image endpoint, the page and the tests can all
 * import it without dragging `$app` or Node APIs into a Worker.
 */

import { BADGE_MARK_DATA_URI } from './generated/badge-mark';

/** Where the badge points, and what it calls itself. */
export const BADGE_HREF = 'https://starspace.group';
export const BADGE_BRAND = '*Space';

/**
 * The wordings on offer.
 *
 * Three, not one, because the badge has three honest uses: something being
 * built now, something already shipped, and a person who is simply a member.
 * A single wording would have people editing the snippet to lie slightly.
 */
export const BADGE_VARIANTS = {
	building: 'Currently being built at',
	built: 'Built at',
	member: 'Member of'
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;
export type BadgeTheme = 'dark' | 'light';

export const BADGE_VARIANT_KEYS = Object.keys(BADGE_VARIANTS) as readonly BadgeVariant[];

/** True for a value that names one of the wordings above. */
export function isBadgeVariant(value: unknown): value is BadgeVariant {
	return typeof value === 'string' && value in BADGE_VARIANTS;
}

/** True for a value that names one of the two grounds. */
export function isBadgeTheme(value: unknown): value is BadgeTheme {
	return value === 'dark' || value === 'light';
}

/**
 * Literal colours, not theme tokens.
 *
 * `src/app.css` owns this app's palette, but a token is a promise about a
 * stylesheet the host page has never loaded. These are the same values resolved
 * to hex, chosen to clear WCAG AA against their own ground: the label reaches
 * 7.2:1 on the dark pill and 8.1:1 on the light one, the brand text more.
 */
export const BADGE_THEMES: Record<
	BadgeTheme,
	{
		background: string;
		border: string;
		label: string;
		brand: string;
	}
> = {
	dark: {
		background: '#14161a',
		border: '#3a3a3a',
		label: '#c8cdd4',
		brand: '#ffffff'
	},
	light: {
		background: '#ffffff',
		border: '#dee2e6',
		label: '#5a6169',
		brand: '#1a1a1a'
	}
};

/**
 * Geometry for the standalone SVG.
 *
 * The SVG has to state its own size in pixels because a README renders it at
 * intrinsic size with no CSS to help. Widths are derived from an average glyph
 * advance rather than measured — there is no text metrics API in a Worker — so
 * the constants are tuned to leave a little slack rather than fit exactly.
 */
const SVG = {
	height: 28,
	padX: 10,
	gap: 6,
	markSize: 16,
	labelSize: 10.5,
	brandSize: 12,
	/** Average advance per character, as a fraction of font size. */
	labelAdvance: 0.62,
	brandAdvance: 0.6,
	/** Extra tracking applied to the uppercase label. */
	labelTracking: 0.8
};

/** Escape for XML text nodes and attribute values. */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** The full sentence a badge reads out, e.g. "Built at *Space". */
export function badgeText(variant: BadgeVariant): string {
	return `${BADGE_VARIANTS[variant]} ${BADGE_BRAND}`;
}

/** Estimated pixel width of the rendered badge, used to size the SVG. */
export function badgeWidth(variant: BadgeVariant): number {
	const label = BADGE_VARIANTS[variant].toUpperCase();
	const labelW = label.length * (SVG.labelSize * SVG.labelAdvance + SVG.labelTracking);
	const brandW = BADGE_BRAND.length * SVG.brandSize * SVG.brandAdvance;
	return Math.round(SVG.padX * 2 + SVG.markSize + SVG.gap + labelW + SVG.gap + brandW);
}

/**
 * The badge as a standalone SVG — what `/badge.svg` serves and what a README
 * embeds. Self-contained: no external font, no external image, no CSS.
 *
 * Fonts are named as a stack and will resolve to whatever the viewer has;
 * a badge that renders in the reader's own UI font looks intentional, whereas
 * an embedded webfont would bloat every README that uses it.
 */
export function renderBadgeSvg(
	variant: BadgeVariant = 'built',
	theme: BadgeTheme = 'dark'
): string {
	const c = BADGE_THEMES[theme];
	const w = badgeWidth(variant);
	const h = SVG.height;
	const label = BADGE_VARIANTS[variant].toUpperCase();
	const markX = SVG.padX;
	const markY = (h - SVG.markSize) / 2;
	const labelX = markX + SVG.markSize + SVG.gap;
	const labelW = label.length * (SVG.labelSize * SVG.labelAdvance + SVG.labelTracking);
	const brandX = labelX + labelW + SVG.gap;
	const font =
		'-apple-system,BlinkMacSystemFont,&apos;Segoe UI&apos;,Roboto,Helvetica,Arial,sans-serif';
	const alt = escapeXml(badgeText(variant));

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`,
		` role="img" aria-label="${alt}">`,
		`<title>${alt}</title>`,
		`<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(h - 1) / 2}"`,
		` fill="${c.background}" stroke="${c.border}"/>`,
		`<image x="${markX}" y="${markY}" width="${SVG.markSize}" height="${SVG.markSize}"`,
		` href="${BADGE_MARK_DATA_URI}"/>`,
		`<text x="${labelX}" y="${h / 2}" dominant-baseline="central" font-family="${font}"`,
		` font-size="${SVG.labelSize}" letter-spacing="${SVG.labelTracking}" fill="${c.label}">`,
		`${escapeXml(label)}</text>`,
		`<text x="${brandX}" y="${h / 2}" dominant-baseline="central" font-family="${font}"`,
		` font-size="${SVG.brandSize}" font-weight="600" fill="${c.brand}">`,
		`${escapeXml(BADGE_BRAND)}</text>`,
		`</svg>`
	].join('');
}

/** Absolute URL of the SVG endpoint for a given variant and theme. */
export function badgeSvgUrl(origin: string, variant: BadgeVariant, theme: BadgeTheme): string {
	return `${origin.replace(/\/$/, '')}/badge.svg?variant=${variant}&theme=${theme}`;
}

/**
 * The copy-paste snippets.
 *
 * `auto` themes follow the reader's own `prefers-color-scheme`. The HTML and
 * web-component forms can do that honestly; Markdown cannot — a README has no
 * media queries — so the Markdown snippet always names a fixed theme, and the
 * page says so rather than leaving the reader to discover it.
 */
export interface SnippetOptions {
	variant: BadgeVariant;
	theme: BadgeTheme;
	/** Origin the snippet should point at, e.g. "https://starspace.group". */
	origin: string;
}

export interface Snippets {
	html: string;
	webComponent: string;
	react: string;
	svelte: string;
	vue: string;
	markdown: string;
}

const CLASS = 'starspace-badge';

/** Inline CSS shared by the framework snippets, as one class block. */
function styleBlock(theme: BadgeTheme): string {
	const c = BADGE_THEMES[theme];
	const other = BADGE_THEMES[theme === 'dark' ? 'light' : 'dark'];
	return `.${CLASS}{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .75rem;
  border:1px solid ${c.border};border-radius:999px;background:${c.background};
  font:500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:${c.label};text-decoration:none}
.${CLASS} img{width:16px;height:16px;flex:none}
.${CLASS} b{font-weight:600;color:${c.brand}}
.${CLASS} span{letter-spacing:.08em;text-transform:uppercase;font-size:10.5px}
@media (prefers-color-scheme:${theme === 'dark' ? 'light' : 'dark'}){
  .${CLASS}{border-color:${other.border};background:${other.background};color:${other.label}}
  .${CLASS} b{color:${other.brand}}
}`;
}

export function badgeSnippets({ variant, theme, origin }: SnippetOptions): Snippets {
	const base = origin.replace(/\/$/, '');
	const label = BADGE_VARIANTS[variant];
	const markUrl = `${base}/badge-mark.png`;
	const alt = badgeText(variant);
	const style = styleBlock(theme);

	const html = `<!-- ${alt} -->
<style>
${style}
</style>
<a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
  <img src="${markUrl}" alt="" width="16" height="16" />
  <span>${label}</span>
  <b>${BADGE_BRAND}</b>
</a>`;

	const webComponent = `<!-- One line. Follows the reader's colour scheme on its own. -->
<script src="${base}/badge.js" async></script>
<starspace-badge variant="${variant}"></starspace-badge>`;

	const react = `export function StarSpaceBadge() {
  return (
    <a
      className="${CLASS}"
      href="${BADGE_HREF}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src="${markUrl}" alt="" width={16} height={16} />
      <span>${label}</span>
      <b>${BADGE_BRAND}</b>
    </a>
  );
}

/* Pair with this CSS (a module, Tailwind layer, or a plain stylesheet):
${style}
*/`;

	const svelte = `<a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
  <img src="${markUrl}" alt="" width="16" height="16" />
  <span>${label}</span>
  <b>${BADGE_BRAND}</b>
</a>

<style>
${style}
</style>`;

	const vue = `<template>
  <a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
    <img :src="mark" alt="" width="16" height="16" />
    <span>${label}</span>
    <b>${BADGE_BRAND}</b>
  </a>
</template>

<script setup>
const mark = '${markUrl}';
</script>

<style scoped>
${style}
</style>`;

	const markdown = `[![${alt}](${badgeSvgUrl(base, variant, theme)})](${BADGE_HREF})`;

	return { html, webComponent, react, svelte, vue, markdown };
}

/**
 * The custom element served at `/badge.js`.
 *
 * Shadow DOM so the host page's CSS cannot reach in and the badge's CSS cannot
 * leak out — on someone else's site both directions matter. It is a string
 * rather than a real module because it is served as a built asset, not bundled.
 */
export function badgeElementScript(origin: string): string {
	const base = origin.replace(/\/$/, '');
	const variants = JSON.stringify(BADGE_VARIANTS);
	const themes = JSON.stringify(BADGE_THEMES);
	return `/* <starspace-badge> — ${BADGE_HREF} */
(function () {
  if (customElements.get('starspace-badge')) return;
  var VARIANTS = ${variants};
  var THEMES = ${themes};
  var MARK = '${base}/badge-mark.png';
  customElements.define(
    'starspace-badge',
    class extends HTMLElement {
      connectedCallback() {
        var variant = this.getAttribute('variant');
        if (!VARIANTS[variant]) variant = 'built';
        var forced = this.getAttribute('theme');
        var root = this.attachShadow({ mode: 'open' });
        var d = THEMES.dark;
        var l = THEMES.light;
        // Default: dark ground with a light-scheme override. A forced theme
        // pins the ground and drops the media query entirely.
        var base_ = forced === 'light' ? l : d;
        var alt = forced === 'light' ? d : l;
        root.innerHTML =
          '<style>' +
          ':host{display:inline-block}' +
          'a{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .75rem;' +
          'border:1px solid ' + base_.border + ';border-radius:999px;background:' + base_.background + ';' +
          'font:500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
          'color:' + base_.label + ';text-decoration:none}' +
          'img{width:16px;height:16px;flex:none}' +
          'b{font-weight:600;color:' + base_.brand + '}' +
          'span{letter-spacing:.08em;text-transform:uppercase;font-size:10.5px}' +
          (forced
            ? ''
            : '@media (prefers-color-scheme:light){' +
              'a{border-color:' + alt.border + ';background:' + alt.background + ';color:' + alt.label + '}' +
              'b{color:' + alt.brand + '}}') +
          '</style>' +
          '<a href="${BADGE_HREF}" target="_blank" rel="noopener">' +
          '<img src="' + MARK + '" alt="" width="16" height="16">' +
          '<span>' + VARIANTS[variant] + '</span><b>${BADGE_BRAND}</b></a>';
      }
    }
  );
})();
`;
}
