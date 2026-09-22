<!--
  SharingMeta - Comprehensive sharing and SEO meta tags component.

  Renders Open Graph, Twitter Card, canonical URL, article metadata, robots
  directives, and schema.org JSON-LD inside <svelte:head>. Use on every page
  with page-specific props.

  The JSON-LD is derived from the props this component already takes, so a page
  that sets its title, description, image and dates gets structured data for
  free — see `src/lib/structured-data.ts` and `docs/STRUCTURED_DATA.md`. Only a
  breadcrumb trail and a listing's entries have to be passed in, because
  nothing else on the page can supply them.
-->
<script lang="ts">
	import { page } from '$app/stores';
	import { site } from '$lib/site.config';
	import {
		buildPageGraph,
		jsonLdScript,
		type Breadcrumb,
		type ListEntry
	} from '$lib/structured-data';

	/** Page title (displayed in browser tab and social shares) */
	export let title: string;
	/** Page description for search engines and social shares */
	export let description: string = '';
	/** Absolute or root-relative URL to the page's share image */
	export let image: string = '';
	/** Alt text for the share image */
	export let imageAlt: string = '';
	/** Canonical URL for this page */
	export let url: string = '';
	/** Open Graph content type */
	export let type: 'website' | 'article' | 'profile' = 'website';
	/** Site name shown in OG tags and title suffix */
	export let siteName: string = site.name;
	/** Locale for OG tags */
	export let locale: string = 'en_US';
	/** Twitter card type */
	export let twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player' =
		'summary_large_image';
	/** Twitter @handle for the site */
	export let twitterSite: string = '';
	/** Twitter @handle for the content creator */
	export let twitterCreator: string = '';
	/** ISO 8601 date for article:published_time (only used when type is 'article') */
	export let publishedTime: string = '';
	/** ISO 8601 date for article:modified_time (only used when type is 'article') */
	export let modifiedTime: string = '';
	/** Author name for article:author (only used when type is 'article') */
	export let author: string = '';
	/** If true, adds noindex/nofollow robots meta */
	export let noindex: boolean = false;
	/** Width of the share image in pixels */
	export let imageWidth: number = 0;
	/** Height of the share image in pixels */
	export let imageHeight: number = 0;
	/** schema.org `WebPage` subtype for the JSON-LD page node */
	export let pageType: 'WebPage' | 'CollectionPage' | 'ContactPage' | 'AboutPage' | 'ItemPage' =
		'WebPage';
	/** Breadcrumb trail from the home page down, home itself excluded */
	export let breadcrumb: Breadcrumb[] = [];
	/** Entries of a listing page, in render order, for the JSON-LD `ItemList` */
	export let items: ListEntry[] = [];
	/** Tag names for `Article.keywords` (only used when type is 'article') */
	export let keywords: string[] = [];
	/** Category or section for `Article.articleSection` (type 'article' only) */
	export let section: string = '';
	/**
	 * schema.org type for the article node. `BlogPosting` only when the item
	 * really is a post — a CMS type can be a changelog or a case study, and
	 * calling those blog posts is a claim the page does not support.
	 */
	export let articleType: 'Article' | 'BlogPosting' = 'Article';

	// The home page passes the site's own name as its title, and appending the
	// suffix there produced "*Space - *Space" in the tab. A page named after the
	// site is already fully qualified.
	$: fullTitle = siteName && title !== siteName ? `${title} - ${siteName}` : title;
	// Resolve root-relative image paths to absolute URLs for OG/Twitter compliance
	$: absoluteImage = image && image.startsWith('/') ? `${$page.url.origin}${image}` : image;

	// A noindex page emits no JSON-LD. Every one of them is an admin or account
	// surface, so describing it to a crawler that has been told not to look is
	// noise at best, and at worst it names internal pages in a payload the
	// robots directive does not cover.
	$: structuredData = noindex
		? null
		: buildPageGraph({
				path: $page.url.pathname,
				title,
				description,
				image,
				imageAlt,
				imageWidth,
				imageHeight,
				pageType,
				breadcrumb,
				items,
				article:
					type === 'article'
						? {
								type: articleType,
								datePublished: publishedTime,
								dateModified: modifiedTime,
								author,
								keywords,
								section
							}
						: undefined
			});
</script>

<svelte:head>
	<!-- Primary -->
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}

	<!-- Robots -->
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	<!-- Canonical -->
	{#if url}
		<link rel="canonical" href={url} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:title" content={title} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:type" content={type} />
	{#if absoluteImage}
		<meta property="og:image" content={absoluteImage} />
		<meta property="og:image:alt" content={imageAlt || title} />
		{#if imageWidth}
			<meta property="og:image:width" content={String(imageWidth)} />
		{/if}
		{#if imageHeight}
			<meta property="og:image:height" content={String(imageHeight)} />
		{/if}
	{/if}
	{#if url}
		<meta property="og:url" content={url} />
	{/if}
	<meta property="og:site_name" content={siteName || site.name} />
	<meta property="og:locale" content={locale} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={title} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	{#if absoluteImage}
		<meta name="twitter:image" content={absoluteImage} />
		{#if imageAlt || title}
			<meta name="twitter:image:alt" content={imageAlt || title} />
		{/if}
	{/if}
	{#if twitterSite}
		<meta name="twitter:site" content={twitterSite} />
	{/if}
	{#if twitterCreator}
		<meta name="twitter:creator" content={twitterCreator} />
	{/if}

	<!-- Structured data. Written with {@html} because Svelte treats a literal
	     <script> in markup as a component script; `jsonLdScript` escapes the
	     payload so CMS text cannot close the element. -->
	{#if structuredData}
		{@html jsonLdScript(structuredData)}
	{/if}

	<!-- Article metadata (only for type="article") -->
	{#if type === 'article'}
		{#if publishedTime}
			<meta property="article:published_time" content={publishedTime} />
		{/if}
		{#if modifiedTime}
			<meta property="article:modified_time" content={modifiedTime} />
		{/if}
		{#if author}
			<meta property="article:author" content={author} />
		{/if}
	{/if}
</svelte:head>
