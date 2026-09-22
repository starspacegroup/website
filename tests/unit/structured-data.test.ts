/**
 * JSON-LD contract tests.
 *
 * The site shipped no structured data at all, so a search engine had to infer
 * what *Space is from prose. These are the properties that make the graph
 * worth emitting, and each one has a specific failure it guards:
 *
 *  - a node losing its `@id`, which is what lets the page reference the
 *    Organization instead of restating it (and what stops two pages reading as
 *    two organisations)
 *  - an `@id` built from the request origin, so a preview deployment invents a
 *    near-duplicate organisation
 *  - a relative URL reaching a crawler, which resolves it against the wrong host
 *  - an empty string shipping as a real value (`"description": ""`)
 *  - CMS text closing the `<script>` element it is embedded in
 */
import { describe, expect, it } from 'vitest';

import { DISCORD_INVITE } from '$lib/discord';
import { orgUrl, site } from '$lib/site.config';
import {
	ORGANIZATION_ID,
	WEBSITE_ID,
	absoluteUrl,
	buildPageGraph,
	escapeJsonLd,
	jsonLdScript,
	organizationNode,
	websiteNode,
	type JsonLdNode
} from '$lib/structured-data';

/** Pull one node out of a graph by its `@type`. */
function nodeOfType(graph: JsonLdNode[], type: string): JsonLdNode | undefined {
	return graph.find((node) => node['@type'] === type);
}

describe('absoluteUrl', () => {
	it('resolves a root-relative path against the canonical host', () => {
		expect(absoluteUrl('/projects')).toBe(`${site.url}/projects`);
	});

	it('keeps the root path a path rather than a bare origin', () => {
		expect(absoluteUrl('/')).toBe(`${site.url}/`);
	});

	it('adds the missing leading slash', () => {
		expect(absoluteUrl('badge')).toBe(`${site.url}/badge`);
	});

	it('leaves an off-site URL alone', () => {
		// A CMS item can name a share image on another origin; rewriting it
		// would point the crawler at a 404 here.
		expect(absoluteUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
	});

	it('returns empty for empty input', () => {
		expect(absoluteUrl('')).toBe('');
	});
});

describe('organizationNode', () => {
	it('identifies the organisation by a host-pinned @id', () => {
		expect(organizationNode()['@id']).toBe(`${site.url}/#organization`);
	});

	it('carries the name, description and tagline from site.config', () => {
		const org = organizationNode();
		expect(org.name).toBe(site.name);
		expect(org.description).toBe(site.description);
		expect(org.slogan).toBe(site.tagline);
	});

	it('links the Discord server and the GitHub organisation as sameAs', () => {
		expect(organizationNode().sameAs).toEqual([DISCORD_INVITE, orgUrl]);
	});

	it('gives the logo an absolute URL and its own @id', () => {
		const logo = organizationNode().logo as JsonLdNode;
		expect(logo['@id']).toBe(`${site.url}/#logo`);
		expect(logo.url).toBe(`${site.url}/icon-512.png`);
		expect(logo.width).toBe(512);
	});
});

describe('websiteNode', () => {
	it('names the organisation as publisher by reference', () => {
		expect(websiteNode().publisher).toEqual({ '@id': ORGANIZATION_ID });
	});

	it('advertises no search action', () => {
		// The command palette has no shareable result URL. Advertising a search
		// endpoint that cannot be fetched is the dishonesty AGENTS.md §7 forbids.
		expect(websiteNode().potentialAction).toBeUndefined();
	});
});

describe('buildPageGraph', () => {
	it('always carries the organisation, the site, and the page', () => {
		const graph = buildPageGraph({ path: '/', title: site.name });
		expect(graph['@context']).toBe('https://schema.org');
		expect(nodeOfType(graph['@graph'], 'Organization')).toBeDefined();
		expect(nodeOfType(graph['@graph'], 'WebSite')).toBeDefined();
		expect(nodeOfType(graph['@graph'], 'WebPage')).toBeDefined();
	});

	it('treats a missing path as the home page', () => {
		// Nothing renders without a pathname in practice, but a graph whose
		// `@id` was `undefined#webpage` would poison every node that points at it.
		const graph = buildPageGraph({ path: '', title: site.name });
		expect(nodeOfType(graph['@graph'], 'WebPage')?.['@id']).toBe(`${site.url}/#webpage`);
		expect(nodeOfType(graph['@graph'], 'WebPage')?.about).toEqual({ '@id': ORGANIZATION_ID });
	});

	it('makes the page part of the site', () => {
		const page = nodeOfType(
			buildPageGraph({ path: '/badge', title: 'Badge' })['@graph'],
			'WebPage'
		);
		expect(page?.isPartOf).toEqual({ '@id': WEBSITE_ID });
		expect(page?.['@id']).toBe(`${site.url}/badge#webpage`);
		expect(page?.url).toBe(`${site.url}/badge`);
	});

	it('says the home page is about the organisation, and no other page does', () => {
		const home = nodeOfType(buildPageGraph({ path: '/', title: site.name })['@graph'], 'WebPage');
		const other = nodeOfType(
			buildPageGraph({ path: '/badge', title: 'Badge' })['@graph'],
			'WebPage'
		);
		expect(home?.about).toEqual({ '@id': ORGANIZATION_ID });
		expect(other?.about).toBeUndefined();
	});

	it('omits empty values instead of shipping blank strings', () => {
		const page = nodeOfType(
			buildPageGraph({ path: '/badge', title: 'Badge' })['@graph'],
			'WebPage'
		);
		expect(page).not.toHaveProperty('description');
		expect(page).not.toHaveProperty('primaryImageOfPage');
	});

	it('honours the WebPage subtype a page declares', () => {
		const graph = buildPageGraph({
			path: '/contact',
			title: 'Contact',
			pageType: 'ContactPage'
		});
		expect(nodeOfType(graph['@graph'], 'ContactPage')).toBeDefined();
	});

	it('gives the share image its own node and points the page at it', () => {
		const graph = buildPageGraph({
			path: '/projects',
			title: 'Projects',
			image: '/og-image.png',
			imageAlt: 'The share card',
			imageWidth: 1200,
			imageHeight: 630
		});
		const image = nodeOfType(graph['@graph'], 'ImageObject');
		expect(image?.url).toBe(`${site.url}/og-image.png`);
		expect(image?.caption).toBe('The share card');
		expect(image?.width).toBe(1200);
		const page =
			nodeOfType(graph['@graph'], 'CollectionPage') ?? nodeOfType(graph['@graph'], 'WebPage');
		expect(page?.primaryImageOfPage).toEqual({ '@id': `${site.url}/projects#primaryimage` });
	});

	it('captions an unlabelled image with the page title', () => {
		const graph = buildPageGraph({ path: '/badge', title: 'Badge', image: '/og-image.png' });
		expect(nodeOfType(graph['@graph'], 'ImageObject')?.caption).toBe('Badge');
	});

	describe('breadcrumbs', () => {
		it('prepends the home page to the trail', () => {
			const graph = buildPageGraph({
				path: '/blog/hello',
				title: 'Hello',
				breadcrumb: [
					{ name: 'Blog', path: '/blog' },
					{ name: 'Hello', path: '/blog/hello' }
				]
			});
			const crumbs = nodeOfType(graph['@graph'], 'BreadcrumbList')?.itemListElement as JsonLdNode[];
			expect(crumbs.map((crumb) => crumb.name)).toEqual(['Home', 'Blog', 'Hello']);
			expect(crumbs.map((crumb) => crumb.position)).toEqual([1, 2, 3]);
			expect(crumbs[1].item).toBe(`${site.url}/blog`);
		});

		it('gives a sub-page a trail even when it passes none', () => {
			// A page one level down always has somewhere to go up to, and a
			// crawler that is told nothing shows the bare URL instead.
			const graph = buildPageGraph({ path: '/privacy', title: 'Privacy Policy' });
			const crumbs = nodeOfType(graph['@graph'], 'BreadcrumbList')?.itemListElement as JsonLdNode[];
			expect(crumbs.map((crumb) => crumb.name)).toEqual(['Home']);
		});

		it('gives the home page no trail', () => {
			const graph = buildPageGraph({ path: '/', title: site.name });
			expect(nodeOfType(graph['@graph'], 'BreadcrumbList')).toBeUndefined();
			expect(nodeOfType(graph['@graph'], 'WebPage')?.breadcrumb).toBeUndefined();
		});
	});

	describe('listings', () => {
		it("lists a collection page's entries in render order, with absolute URLs", () => {
			const graph = buildPageGraph({
				path: '/blog',
				title: 'Blog',
				pageType: 'CollectionPage',
				items: [
					{ name: 'First', url: '/blog/first', description: 'One' },
					{ name: 'Second', url: '/blog/second' }
				]
			});
			const list = nodeOfType(graph['@graph'], 'ItemList');
			expect(list?.numberOfItems).toBe(2);
			const entries = list?.itemListElement as JsonLdNode[];
			expect(entries[0]).toEqual({
				'@type': 'ListItem',
				position: 1,
				name: 'First',
				description: 'One',
				url: `${site.url}/blog/first`
			});
			expect(entries[1]).not.toHaveProperty('description');
			expect(nodeOfType(graph['@graph'], 'CollectionPage')?.mainEntity).toEqual({
				'@id': `${site.url}/blog#itemlist`
			});
		});

		it('keeps an off-site entry URL, so /projects can point at the projects', () => {
			const graph = buildPageGraph({
				path: '/projects',
				title: 'Projects',
				items: [{ name: 'Game', url: 'https://game.starspace.group/' }]
			});
			const entries = nodeOfType(graph['@graph'], 'ItemList')?.itemListElement as JsonLdNode[];
			expect(entries[0].url).toBe('https://game.starspace.group/');
		});

		it('emits no list for a page with no entries', () => {
			const graph = buildPageGraph({ path: '/blog', title: 'Blog', items: [] });
			expect(nodeOfType(graph['@graph'], 'ItemList')).toBeUndefined();
		});
	});

	describe('articles', () => {
		const article = () =>
			buildPageGraph({
				path: '/blog/hello',
				title: 'Hello',
				description: 'A post',
				image: '/og-image.png',
				article: {
					type: 'BlogPosting',
					datePublished: '2026-09-01T00:00:00Z',
					dateModified: '2026-09-10T00:00:00Z',
					keywords: ['svelte', 'cloudflare'],
					section: 'Engineering'
				}
			});

		it('anchors the article to the page and the organisation', () => {
			const node = nodeOfType(article()['@graph'], 'BlogPosting');
			expect(node?.mainEntityOfPage).toEqual({ '@id': `${site.url}/blog/hello#webpage` });
			expect(node?.publisher).toEqual({ '@id': ORGANIZATION_ID });
			expect(node?.headline).toBe('Hello');
			expect(node?.articleSection).toBe('Engineering');
		});

		it('joins tags into keywords', () => {
			expect(nodeOfType(article()['@graph'], 'BlogPosting')?.keywords).toBe('svelte, cloudflare');
		});

		it('dates the page as well as the article', () => {
			const page = nodeOfType(article()['@graph'], 'WebPage');
			expect(page?.datePublished).toBe('2026-09-01T00:00:00Z');
			expect(page?.dateModified).toBe('2026-09-10T00:00:00Z');
		});

		it('falls back to the published date when nothing was modified', () => {
			const graph = buildPageGraph({
				path: '/blog/hello',
				title: 'Hello',
				article: { datePublished: '2026-09-01T00:00:00Z' }
			});
			expect(nodeOfType(graph['@graph'], 'Article')?.dateModified).toBe('2026-09-01T00:00:00Z');
		});

		it('attributes an unsigned item to the community, and a signed one to the person', () => {
			const unsigned = buildPageGraph({
				path: '/blog/hello',
				title: 'Hello',
				article: { datePublished: '2026-09-01T00:00:00Z' }
			});
			expect(nodeOfType(unsigned['@graph'], 'Article')?.author).toEqual({ '@id': ORGANIZATION_ID });

			const signed = buildPageGraph({
				path: '/blog/hello',
				title: 'Hello',
				article: { author: 'David Monaghan' }
			});
			expect(nodeOfType(signed['@graph'], 'Article')?.author).toEqual({
				'@type': 'Person',
				name: 'David Monaghan'
			});
		});

		it('defaults to a plain Article rather than claiming a blog post', () => {
			const graph = buildPageGraph({ path: '/kb/x', title: 'X', article: {} });
			expect(nodeOfType(graph['@graph'], 'Article')).toBeDefined();
			expect(nodeOfType(graph['@graph'], 'BlogPosting')).toBeUndefined();
		});

		it('emits no article node for an ordinary page', () => {
			const graph = buildPageGraph({ path: '/badge', title: 'Badge' });
			expect(nodeOfType(graph['@graph'], 'Article')).toBeUndefined();
		});
	});
});

describe('escapeJsonLd', () => {
	it('neutralises a closing script tag in CMS text', () => {
		const escaped = escapeJsonLd(JSON.stringify({ name: '</script><img onerror=x>' }));
		expect(escaped).not.toContain('</script>');
		expect(escaped).not.toContain('<');
		expect(escaped).not.toContain('>');
	});

	it('escapes ampersands and the line separators that break JS parsers', () => {
		const escaped = escapeJsonLd(JSON.stringify({ name: 'a & b\u2028c\u2029d' }));
		expect(escaped).toContain('\\u0026');
		expect(escaped).toContain('\\u2028');
		expect(escaped).toContain('\\u2029');
	});

	it('still parses back to the original value', () => {
		const original = { name: '</script> & <b>bold</b>' };
		expect(JSON.parse(escapeJsonLd(JSON.stringify(original)))).toEqual(original);
	});
});

describe('jsonLdScript', () => {
	it('wraps the graph in a typed script element', () => {
		const html = jsonLdScript(buildPageGraph({ path: '/', title: site.name }));
		expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
		expect(html.endsWith('</script>')).toBe(true);
	});

	it('emits a payload that parses as the graph it was given', () => {
		const graph = buildPageGraph({ path: '/', title: site.name });
		const html = jsonLdScript(graph);
		const payload = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
		expect(JSON.parse(payload)).toEqual(graph);
	});

	it('renders nothing when there is no graph', () => {
		expect(jsonLdScript(null)).toBe('');
	});
});
