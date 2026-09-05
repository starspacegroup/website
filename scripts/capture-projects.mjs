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
const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark' });

const failed = [];

for (const project of wanted) {
	const page = await context.newPage();
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
		const shot = join(TMP, `${project.id}.png`);
		await page.screenshot({ path: shot });

		const target = join(OUT, `${project.id}-screenshot.webp`);
		execFileSync('magick', [shot, '-resize', '900x', '-quality', '82', '-strip', target]);
		console.log(`✓ ${project.id.padEnd(18)} ${status}  ${project.url}`);
	} catch (error) {
		failed.push([project.id, String(error).split('\n')[0]]);
		console.log(`✗ ${project.id.padEnd(18)} ${String(error).split('\n')[0]}`);
	}
	await page.close();
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });

if (failed.length) {
	// A project whose site is down keeps its previous card rather than losing it.
	console.error(`\n${failed.length} project(s) could not be captured; their old art is untouched:`);
	for (const [id, reason] of failed) console.error(`  ${id}: ${reason}`);
	process.exit(1);
}

console.log(`\nCaptured ${wanted.length} project(s). Check the copy beside each new picture.`);
