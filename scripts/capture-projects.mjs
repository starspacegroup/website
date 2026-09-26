#!/usr/bin/env bun
/**
 * capture-projects.mjs — refresh the card art in `static/projects/`.
 *
 * Every project on `/projects` is somebody else's live site, and they redesign
 * without telling us. This visits each one in a headless browser, screenshots
 * it, and writes the WebP the card actually loads.
 *
 *   bun run capture:projects              # every project in the list
 *   bun run capture:projects athena game  # only these ids
 *
 * It reads the ids and URLs from `src/lib/data/projects.ts`, so it can never
 * drift from the list it is illustrating.
 *
 * Each site is captured twice, once asking for a dark colour scheme and once
 * for a light one, because the card shows whichever matches the theme this site
 * is in. The light shot is only kept when it actually differs: plenty of these
 * sites are dark whatever the visitor prefers, and a second copy of the same
 * picture would cost a download and prove nothing. When a light shot is kept,
 * the entry in `projects.ts` needs `screenshotLight` — the script says which.
 *
 * What it does NOT do is rewrite the descriptions. When a site has been
 * redesigned, the new screenshot usually means the copy beside it is stale too
 * — read the page and fix the entry by hand. A card whose picture and words
 * disagree is worse than an old picture.
 *
 * Needs ImageMagick 7 (`magick`) and Playwright's Chromium
 * (`bunx playwright install chromium`). Output is committed; run it when a
 * project changes, not on every build.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

import { projects } from '../src/lib/data/projects.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TMP = join(ROOT, '.llm-outputs', 'project-shots');
const OUT = join(ROOT, 'static', 'projects');

/** Card art is served at 900px into a 16:9 box; 1440x810 is that shape at 2x-ish. */
const VIEWPORT = { width: 1440, height: 810 };
/** Long enough for hero animations and lazy imagery to settle. */
const SETTLE_MS = 3500;
/**
 * Below this normalised RMSE the two schemes are the same picture — the site has
 * no light mode, and what differs is an animation caught at another frame.
 */
const SAME_PICTURE = 0.04;

const only = new Set(process.argv.slice(2));
const wanted = projects.filter((p) => (only.size ? only.has(p.id) : true));

if (only.size) {
	const unknown = [...only].filter((id) => !projects.some((p) => p.id === id));
	if (unknown.length) {
		console.error(`Unknown project id(s): ${unknown.join(', ')}`);
		console.error(`Known: ${projects.map((p) => p.id).join(', ')}`);
		process.exit(1);
	}
}

mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
/* One context per scheme, so nothing a site stores in the first visit — a
   theme choice in localStorage, say — leaks into the second. */
const contexts = {
	dark: await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark' }),
	light: await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' })
};

const failed = [];
const withLight = [];

/** Load a project in one scheme and screenshot it to a PNG. Returns the status. */
async function shoot(project, scheme, path) {
	const page = await contexts[scheme].newPage();
	try {
		const response = await page.goto(project.url, { waitUntil: 'networkidle', timeout: 45000 });
		const status = response?.status() ?? 0;
		if (status >= 400) throw new Error(`HTTP ${status}`);

		// A consent banner belongs to this browser session, not to their product.
		// Left in, it puts our screenshot tooling in their card.
		for (const label of [/reject all/i, /^reject$/i, /accept all/i, /^accept$/i]) {
			const button = page.getByRole('button', { name: label });
			if (await button.count()) {
				await button
					.first()
					.click({ timeout: 3000 })
					.catch(() => {});
				break;
			}
		}

		await page.waitForTimeout(SETTLE_MS);
		await page.screenshot({ path });
		return status;
	} finally {
		await page.close();
	}
}

/** Normalised RMSE between two same-sized PNGs: 0 is identical, 1 is opposite. */
function difference(a, b) {
	try {
		execFileSync('magick', ['compare', '-metric', 'RMSE', a, b, 'null:'], { stdio: 'pipe' });
		return 0;
	} catch (error) {
		// `compare` exits 1 when the images differ, and prints the metric on stderr
		// as "absolute (normalised)".
		const match = String(error.stderr).match(/\(([\d.e-]+)\)/);
		if (!match) throw error;
		return Number(match[1]);
	}
}

const webp = (png, target) =>
	execFileSync('magick', [png, '-resize', '900x', '-quality', '82', '-strip', target]);

for (const project of wanted) {
	try {
		const darkPng = join(TMP, `${project.id}-dark.png`);
		const lightPng = join(TMP, `${project.id}-light.png`);
		const status = await shoot(project, 'dark', darkPng);
		await shoot(project, 'light', lightPng);

		webp(darkPng, join(OUT, `${project.id}-screenshot.webp`));

		const lightTarget = join(OUT, `${project.id}-screenshot-light.webp`);
		const delta = difference(darkPng, lightPng);
		let note = 'dark only';
		if (delta >= SAME_PICTURE) {
			webp(lightPng, lightTarget);
			withLight.push(project.id);
			note = 'light + dark';
		} else {
			// No light mode (any more). A stale light shot would show an old design.
			rmSync(lightTarget, { force: true });
		}
		console.log(`✓ ${project.id.padEnd(18)} ${status}  ${note.padEnd(12)} ${project.url}`);
	} catch (error) {
		failed.push([project.id, String(error).split('\n')[0]]);
		console.log(`✗ ${project.id.padEnd(18)} ${String(error).split('\n')[0]}`);
	}
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });

/* Said before any failure exit, so a single site that is down does not hide the
   edits the others need. Only projects that were captured are judged. */
const failedIds = new Set(failed.map(([id]) => id));
const outOfStep = wanted.filter(
	(p) => !failedIds.has(p.id) && withLight.includes(p.id) !== Boolean(p.screenshotLight)
);
if (outOfStep.length) {
	console.log('\nprojects.ts is out of step with the light shots:');
	for (const p of outOfStep) {
		console.log(
			withLight.includes(p.id)
				? `  ${p.id}: add screenshotLight: '/projects/${p.id}-screenshot-light.webp'`
				: `  ${p.id}: remove screenshotLight — the site has no light mode now`
		);
	}
}

if (failed.length) {
	// A project whose site is down keeps its previous card rather than losing it.
	console.error(`\n${failed.length} project(s) could not be captured; their old art is untouched:`);
	for (const [id, reason] of failed) console.error(`  ${id}: ${reason}`);
	process.exit(1);
}

console.log(`\nCaptured ${wanted.length} project(s). Check the copy beside each new picture.`);
