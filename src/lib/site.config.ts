/**
 * Single source of truth for app identity, branding, and local-dev config.
 *
 * When you spin up a new app from this template, DO NOT hand-edit the scattered
 * references. Run `bun run customize` (see CUSTOMIZE.md at the repo root), which
 * rewrites this file and syncs the surfaces that cannot import it — wrangler.toml
 * (Cloudflare resource names), tests, and docs.
 *
 * Everything that runs (Vite, Playwright, and every Svelte component) imports its
 * name/port/URL from here, so these values live in exactly one place.
 *
 * This module must stay dependency-free (no `$app`, no Node APIs) so that
 * vite.config.ts and playwright.config.ts can import it directly.
 */
export const site = {
	/** Product name shown in the UI, page titles, and social meta. */
	name: '*Space',
	/** Short name for tight spaces (browser tab, PWA `short_name`). */
	shortName: '*Space',
	/** One-line tagline for the footer and the share-card alt text. The hero carries its own line. */
	tagline: 'An inclusive digital coworking space on Discord.',
	/** Longer description for the meta description and OG/Twitter cards. */
	description:
		'*Space is an inclusive digital coworking space on Discord. Work around rock star makers, creators, artists, and innovators who are creativity and productivity driven.',
	/**
	 * URL-safe slug. Drives the Cloudflare resource names in wrangler.toml
	 * (`<slug>-db`, `<slug>-files`, `<slug>-queue`). Those files can't import this
	 * module, so `bun run customize` keeps them in sync — don't edit them by hand.
	 */
	slug: 'starspace-group',
	/** Local dev + preview port. Owned here; Vite and Playwright both read it. */
	devPort: 4203,
	/** Production URL, no trailing slash. Used for canonical + OG URLs. */
	url: 'https://starspace.group',
	/** GitHub repository in `owner/name` form. */
	repo: 'starspacegroup/website',
	/** Attribution shown in the footer. */
	author: '*Space',
	/** URL for the footer attribution link. */
	authorUrl: 'https://starspace.group'
} as const;

/** Full GitHub URL, derived from {@link site.repo}. */
export const repoUrl = `https://github.com/${site.repo}`;

/**
 * The GitHub organisation this site belongs to, derived from the owner half of
 * {@link site.repo} so `bun run customize` keeps it in step with everything else.
 *
 * This, not {@link repoUrl}, is what a visitor-facing "GitHub" link points at.
 * The community is several repositories; this site's own is one of them, and
 * landing a first-time visitor inside it hides the rest. {@link repoUrl} is for
 * links that are about this repository specifically and would be wrong pointed
 * at the organisation; nothing on the site needs one today.
 */
export const orgUrl = `https://github.com/${site.repo.split('/')[0]}`;
