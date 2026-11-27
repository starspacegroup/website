import { describe, expect, it } from 'vitest';
import { canonicalUrl } from '../../src/lib/structured-data';
import { site } from '../../src/lib/site.config';
import { GET as sitemapGet } from '../../src/routes/sitemap.xml/+server';

// Small seeded PRNG so the property loops are reproducible.
function rng(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
}
const SEGS = ['projects', 'guide', 'blog', 'hello-world', 'a_b', 'x.y', 'stats', 'contact'];
const QUERIES = ['', '?utm_source=x', '?page=2', '?tag=a&tag=b', '?a=1#top', '#frag', '?'];
const HOSTS = [
	'',
	'https://starspace.group',
	'https://www.starspace.group',
	'http://localhost:4203'
];

function randomPath(next: () => number): string {
	const n = Math.floor(next() * 3);
	const segs = Array.from({ length: n }, () => SEGS[Math.floor(next() * SEGS.length)]);
	return '/' + segs.join('/');
}

describe('canonicalUrl', () => {
	it('is absolute, on the canonical host, with no query or fragment (property)', () => {
		const next = rng(42);
		for (let i = 0; i < 500; i++) {
			const path = randomPath(next);
			const input =
				HOSTS[Math.floor(next() * HOSTS.length)] +
				path +
				QUERIES[Math.floor(next() * QUERIES.length)];
			const out = canonicalUrl(input);
			expect(out.startsWith(`${site.url}/`)).toBe(true);
			expect(out).not.toMatch(/[?#]/);
			// Idempotent, and every variant of one page collapses to one URL.
			expect(canonicalUrl(out)).toBe(out);
			expect(out).toBe(canonicalUrl(path));
		}
	});

	it('handles the known cases', () => {
		expect(canonicalUrl('/')).toBe('https://starspace.group/');
		expect(canonicalUrl('/projects?page=2')).toBe('https://starspace.group/projects');
		expect(canonicalUrl('/blog/post?utm_source=a#x')).toBe('https://starspace.group/blog/post');
		expect(canonicalUrl('/guide/')).toBe('https://starspace.group/guide');
		expect(canonicalUrl('https://www.starspace.group/stats?tag=a')).toBe(
			'https://starspace.group/stats'
		);
	});
});

describe('sitemap.xml canonical hygiene', () => {
	it('lists only clean absolute URLs, no query strings, no private or noindex routes', async () => {
		const res = await sitemapGet({
			url: new URL('https://starspace.group/sitemap.xml'),
			platform: undefined
		} as never);
		const body = await res.text();
		const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
		expect(locs.length).toBeGreaterThan(0);
		for (const loc of locs) {
			expect(loc).not.toContain('?');
			expect(loc).not.toContain('#');
			expect(loc.startsWith('https://starspace.group/')).toBe(true);
			expect(loc).not.toMatch(/\/(admin|api|auth|reset|setup|profile|media|chat)(\/|$)/);
		}
	});
});
