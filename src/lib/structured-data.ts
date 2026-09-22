/**
 * Schema.org JSON-LD for the public pages.
 *
 * Open Graph and Twitter cards tell a *social* crawler what a page is.
 * Search engines read a different surface, and before this module the site
 * shipped none of it — so what "*Space" is had to be inferred from prose.
 * A crawler that has to guess prints a guess.
 *
 * Everything here builds ONE `@graph` per page rather than a pile of loose
 * nodes, so the page's own node can point at the Organization and WebSite by
 * `@id` instead of repeating them inline. That is also why the `@id`s are
 * built from {@link site.url} and never from the request origin: a node's id
 * is its identity across pages and crawls, and a preview deployment that
 * emitted its own hostname would read as a second, near-duplicate
 * organisation.
 *
 * `SharingMeta.svelte` is the only caller — it already receives every page's
 * title, description, image and dates, so pages get structured data by
 * carrying on using that component. See `docs/STRUCTURED_DATA.md`.
 */
import { DISCORD_INVITE } from '$lib/discord';
import { orgUrl, site } from '$lib/site.config';

/** One schema.org node. Values are whatever schema.org allows there. */
export type JsonLdNode = Record<string, unknown>;

/** A `{"@context": …, "@graph": […]}` document, ready to serialise. */
export type JsonLdGraph = {
	'@context': 'https://schema.org';
	'@graph': JsonLdNode[];
};

/** Stable node identities. Referenced across pages, so they are host-pinned. */
export const ORGANIZATION_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const LOGO_ID = `${site.url}/#logo`;

/** BCP 47 tag matching `<html lang>` in `src/app.html`. */
const LANGUAGE = 'en-US';

/** One crumb on the trail. `path` is root-relative; `/` is prepended for you. */
export type Breadcrumb = { name: string; path: string };

/** An entry in a listing page's `ItemList`. */
export type ListEntry = { name: string; url: string; description?: string };

/** What a page tells {@link buildPageGraph} about itself. */
export type PageGraphInput = {
	/** Root-relative path of the page being rendered, e.g. `/blog/hello`. */
	path: string;
	/** Page title, without the site-name suffix. */
	title: string;
	description?: string;
	/** Share image, absolute or root-relative. */
	image?: string;
	imageAlt?: string;
	imageWidth?: number;
	imageHeight?: number;
	/** schema.org `WebPage` subtype. A listing is a `CollectionPage`, and so on. */
	pageType?: 'WebPage' | 'CollectionPage' | 'ContactPage' | 'AboutPage' | 'ItemPage';
	/** Trail from the home page down, home itself excluded. */
	breadcrumb?: Breadcrumb[];
	/** Entries of a listing page, in the order they render. */
	items?: ListEntry[];
	/** Emit an `Article`/`BlogPosting` alongside the page node. */
	article?: {
		/** `BlogPosting` when the item is a post; plain `Article` otherwise. */
		type?: 'Article' | 'BlogPosting';
		datePublished?: string;
		dateModified?: string;
		/** Author's display name. Falls back to the organisation. */
		author?: string;
		/** Tag names. */
		keywords?: string[];
		/** Category or section this item sits in. */
		section?: string;
	};
};

/** Drop keys whose value is empty, so no node carries `"description": ""`. */
function compact(node: JsonLdNode): JsonLdNode {
	const out: JsonLdNode = {};
	for (const [key, value] of Object.entries(node)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

/**
 * Resolve a path or root-relative asset against the canonical host.
 *
 * An already-absolute URL is returned untouched — a CMS item can name a share
 * image on another origin, and rewriting that would point the crawler at a
 * 404 on this one.
 */
export function absoluteUrl(pathOrUrl: string): string {
	if (!pathOrUrl) return '';
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
	// The canonical URL carries no trailing slash, so `${url}${path}` is safe.
	// `/` itself must not become `https://starspace.group` with no path.
	return path === '/' ? `${site.url}/` : `${site.url}${path}`;
}

/** The community itself: the node every other page node points `publisher` at. */
export function organizationNode(): JsonLdNode {
	return {
		'@type': 'Organization',
		'@id': ORGANIZATION_ID,
		name: site.name,
		alternateName: 'StarSpace',
		url: `${site.url}/`,
		description: site.description,
		slogan: site.tagline,
		logo: {
			'@type': 'ImageObject',
			'@id': LOGO_ID,
			url: absoluteUrl('/icon-512.png'),
			contentUrl: absoluteUrl('/icon-512.png'),
			width: 512,
			height: 512,
			caption: site.name
		},
		image: { '@id': LOGO_ID },
		// Where else the same organisation is. The Discord server is the product,
		// so it belongs here rather than as a bare link.
		sameAs: [DISCORD_INVITE, orgUrl]
	};
}

/**
 * The site.
 *
 * Deliberately no `potentialAction`/`SearchAction`: the command palette is a
 * keyboard overlay with no shareable result URL, and advertising a search
 * endpoint that cannot be fetched is the same dishonesty AGENTS.md §7 forbids
 * of the API catalog.
 */
export function websiteNode(): JsonLdNode {
	return {
		'@type': 'WebSite',
		'@id': WEBSITE_ID,
		url: `${site.url}/`,
		name: site.name,
		description: site.description,
		inLanguage: LANGUAGE,
		publisher: { '@id': ORGANIZATION_ID }
	};
}

/** `BreadcrumbList` for a trail, with the home page prepended. */
export function breadcrumbNode(trail: Breadcrumb[], pageUrl: string): JsonLdNode {
	const crumbs: Breadcrumb[] = [{ name: 'Home', path: '/' }, ...trail];
	return {
		'@type': 'BreadcrumbList',
		'@id': `${pageUrl}#breadcrumb`,
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: absoluteUrl(crumb.path)
		}))
	};
}

/** `ItemList` for a listing page, in render order. */
export function itemListNode(items: ListEntry[], pageUrl: string): JsonLdNode {
	return {
		'@type': 'ItemList',
		'@id': `${pageUrl}#itemlist`,
		numberOfItems: items.length,
		itemListElement: items.map((entry, index) =>
			compact({
				'@type': 'ListItem',
				position: index + 1,
				name: entry.name,
				description: entry.description,
				url: absoluteUrl(entry.url)
			})
		)
	};
}

/**
 * Build the whole graph for one page.
 *
 * Always: the Organization, the WebSite, and this page. Then a
 * `BreadcrumbList`, an `ItemList` and an `Article` when the page has them.
 */
export function buildPageGraph(input: PageGraphInput): JsonLdGraph {
	const pageUrl = absoluteUrl(input.path || '/');
	const pageId = `${pageUrl}#webpage`;
	const isHome = (input.path || '/') === '/';
	const image = input.image ? absoluteUrl(input.image) : '';
	const imageId = image ? `${pageUrl}#primaryimage` : '';

	const graph: JsonLdNode[] = [organizationNode(), websiteNode()];

	if (image) {
		graph.push(
			compact({
				'@type': 'ImageObject',
				'@id': imageId,
				url: image,
				contentUrl: image,
				width: input.imageWidth || undefined,
				height: input.imageHeight || undefined,
				caption: input.imageAlt || input.title
			})
		);
	}

	const hasBreadcrumb = Boolean(input.breadcrumb?.length) || !isHome;
	const page = compact({
		'@type': input.pageType || 'WebPage',
		'@id': pageId,
		url: pageUrl,
		name: input.title,
		description: input.description,
		isPartOf: { '@id': WEBSITE_ID },
		inLanguage: LANGUAGE,
		// The home page *is* about the organisation; a sub-page is not, and
		// claiming otherwise on every page makes the claim worthless.
		about: isHome ? { '@id': ORGANIZATION_ID } : undefined,
		primaryImageOfPage: imageId ? { '@id': imageId } : undefined,
		breadcrumb: hasBreadcrumb ? { '@id': `${pageUrl}#breadcrumb` } : undefined,
		mainEntity: input.items?.length ? { '@id': `${pageUrl}#itemlist` } : undefined,
		datePublished: input.article?.datePublished,
		dateModified: input.article?.dateModified || input.article?.datePublished
	});
	graph.push(page);

	if (hasBreadcrumb) {
		graph.push(breadcrumbNode(input.breadcrumb ?? [], pageUrl));
	}

	if (input.items?.length) {
		graph.push(itemListNode(input.items, pageUrl));
	}

	if (input.article) {
		graph.push(
			compact({
				'@type': input.article.type || 'Article',
				'@id': `${pageUrl}#article`,
				isPartOf: { '@id': pageId },
				mainEntityOfPage: { '@id': pageId },
				headline: input.title,
				description: input.description,
				image: imageId ? { '@id': imageId } : undefined,
				datePublished: input.article.datePublished,
				dateModified: input.article.dateModified || input.article.datePublished,
				// An item with no named author is the community's own post.
				author: input.article.author
					? { '@type': 'Person', name: input.article.author }
					: { '@id': ORGANIZATION_ID },
				publisher: { '@id': ORGANIZATION_ID },
				keywords: input.article.keywords?.length ? input.article.keywords.join(', ') : undefined,
				articleSection: input.article.section,
				inLanguage: LANGUAGE
			})
		);
	}

	return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Escape a JSON payload for embedding in an inline `<script>`.
 *
 * The graph carries CMS titles and descriptions, and it reaches the page
 * through `{@html}` — so `</script>` in an item title would otherwise close
 * the element and everything after it would be parsed as markup. JSON's own
 * `\uXXXX` escapes are decoded by the JSON parser, not by the HTML tokeniser,
 * so escaping the three characters that can start a tag or an entity keeps the
 * payload identical while making it inert. U+2028/U+2029 are legal in JSON
 * strings but break JavaScript parsers, and some consumers `eval` the block.
 */
export function escapeJsonLd(json: string): string {
	return json
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

/** The full `<script type="application/ld+json">` element for a graph. */
export function jsonLdScript(graph: JsonLdGraph | null): string {
	if (!graph) return '';
	return `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(graph))}</script>`;
}
