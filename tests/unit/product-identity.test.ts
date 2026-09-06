import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/lib/site.config';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('*Space product identity', () => {
	// Inverted from the template's own guard, which asserted the opposite. This
	// repository is starspace.group, not the starter it was built from; a reader
	// who lands here from the site must not be told to click "Use this template".
	it('presents itself as the *Space site, not as the starter it came from', () => {
		const publicSurfaces = [
			read('README.md'),
			read('FEATURES.md'),
			read('src/lib/site.config.ts'),
			read('src/routes/documentation/+page.svelte')
		].join('\n');

		expect(publicSurfaces).toMatch(/starspace\.group/i);
		expect(publicSurfaces).not.toMatch(/starter template/i);
		expect(publicSurfaces).not.toMatch(/use this template/i);
	});

	// Kept, though this site's own pass is done: a fork of this repository needs
	// the same escape hatch that produced it.
	it('ships a working customization workflow', () => {
		for (const path of [
			'CUSTOMIZE.md',
			'INITIAL_CUSTOMIZATION_STATUS.md',
			'customize.config.example.json',
			'docs/INITIAL_CUSTOMIZATION.md',
			'scripts/customize.mjs'
		]) {
			expect(existsSync(resolve(root, path)), `${path} should exist`).toBe(true);
		}

		const manifest = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
		expect(manifest.scripts?.customize).toBe('bun scripts/customize.mjs');

		// The config a non-interactive run reads must never be committed into a
		// downstream product.
		expect(read('.gitignore')).toMatch(/^customize\.config\.json$/m);

		// The entry point that still points at the script must actually name it.
		expect(read('CUSTOMIZE.md')).toMatch(/bun run customize/);

		// And the ledger has to say the pass was run here, or every assistant
		// that reads it will keep offering to do the onboarding again.
		expect(read('INITIAL_CUSTOMIZATION_STATUS.md')).toMatch(/^status: complete$/m);
	});

	it('uses Bun for package-script orchestration', () => {
		const manifest = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
		expect(Object.values(manifest.scripts).join('\n')).not.toMatch(/\bnpm(?:x)?\b/);
	});

	it('ships complete install and sharing metadata', () => {
		const html = read('src/app.html');
		const readme = read('README.md');
		const footer = read('src/lib/components/Footer.svelte');
		const manifest = JSON.parse(read('static/site.webmanifest')) as {
			name?: string;
			short_name?: string;
			description?: string;
			display?: string;
			start_url?: string;
			background_color?: string;
			theme_color?: string;
			icons?: Array<{ src?: string; sizes?: string; type?: string; purpose?: string }>;
		};

		expect(readme).toMatch(
			/\[!\[\*Space[^\]]*\]\(\.\/static\/og-image\.png\)\]\(https:\/\/github\.com\/starspacegroup\/starspace-group-nebulakit\)/i
		);
		// The footer's GitHub icon link stays labelled, and points at the GitHub
		// organisation rather than this repository — see `orgUrl` in
		// src/lib/site.config.ts for why the visitor-facing links are the org.
		expect(footer).toContain('aria-label="{site.name} on GitHub"');
		expect(footer).toContain('href={orgUrl}');
		expect(footer).not.toContain('repoUrl');
		expect(html).toContain('rel="apple-touch-icon"');
		expect(html).toContain('rel="manifest"');
		expect(html).toContain('name="apple-mobile-web-app-title"');
		expect(html).toContain('name="theme-color"');
		expect(manifest.name).toBe('*Space');
		expect(manifest.short_name).toBe('*Space');
		expect(manifest.description).toBe(site.tagline);
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
		expect(manifest.background_color).toBe('#0b1026');
		expect(manifest.theme_color).toBe('#0b1026');
		expect(html).toMatch(
			/rel="icon" href="%sveltekit\.assets%\/favicon\.svg" type="image\/svg\+xml"/
		);
		expect(html).toMatch(/favicon-dark\.svg[\s\S]*prefers-color-scheme: dark/);
		expect(html).toMatch(/favicon-light\.svg[\s\S]*prefers-color-scheme: light/);
		expect(manifest.icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					src: '/icon-192.png',
					sizes: '192x192',
					type: 'image/png',
					purpose: 'any maskable'
				}),
				expect.objectContaining({
					src: '/icon-512.png',
					sizes: '512x512',
					type: 'image/png',
					purpose: 'any maskable'
				})
			])
		);

		for (const path of [
			'static/favicon.svg',
			'static/favicon-dark.svg',
			'static/favicon-light.svg',
			'static/apple-touch-icon.png',
			'static/icon-192.png',
			'static/icon-512.png'
		]) {
			expect(existsSync(resolve(root, path)), `${path} should exist`).toBe(true);
		}

		const expectedPngs = new Map([
			['static/apple-touch-icon.png', [180, 180]],
			['static/icon-192.png', [192, 192]],
			['static/icon-512.png', [512, 512]]
		]);
		const hashes = new Set<string>();
		for (const [path, [width, height]] of expectedPngs) {
			const bytes = readFileSync(resolve(root, path));
			expect(bytes.subarray(1, 4).toString()).toBe('PNG');
			expect(bytes.readUInt32BE(16)).toBe(width);
			expect(bytes.readUInt32BE(20)).toBe(height);
			expect(bytes[25], `${path} should be RGB without alpha`).toBe(2);
			hashes.add(createHash('sha256').update(bytes).digest('hex'));
		}
		expect(hashes.size).toBe(expectedPngs.size);

		const faviconVariants = [
			'static/favicon.svg',
			'static/favicon-dark.svg',
			'static/favicon-light.svg'
		];
		expect(new Set(faviconVariants.map((path) => read(path))).size).toBe(faviconVariants.length);

		const socialCard = readFileSync(resolve(root, 'static/og-image.png'));
		expect(socialCard.readUInt32BE(16)).toBe(1200);
		expect(socialCard.readUInt32BE(20)).toBe(630);
		expect(socialCard[25], 'social card should be RGB without alpha').toBe(2);
	});

	it('ignores generated build, report, cache, and scratch artifacts', () => {
		const gitignore = read('.gitignore');
		for (const pattern of [
			'/build',
			'/.svelte-kit',
			'/package',
			'/dist',
			'.wrangler',
			'.llm-outputs/',
			'coverage/',
			'test-results/',
			'playwright-report/',
			'*.log'
		]) {
			expect(gitignore, `${pattern} should be ignored`).toContain(pattern);
		}
	});

	it('does not retain the superseded root sharing image', () => {
		expect(existsSync(resolve(root, 'image.png'))).toBe(false);
	});
});
