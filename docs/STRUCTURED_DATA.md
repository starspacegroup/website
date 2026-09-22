# Structured data (schema.org JSON-LD)

Every indexable page ships one `<script type="application/ld+json">` block
describing itself, the site, and the community that publishes it.

Until 2026-09-21 the site shipped none. Open Graph and Twitter cards were
complete, which covers a _social_ crawler, but a search engine reads a
different surface — so what `*Space` is had to be inferred from prose, and a
crawler that has to guess prints a guess.

## Where it lives

| Piece                             | File                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ |
| The node builders and the escaper | `src/lib/structured-data.ts`                                                   |
| The only caller                   | `src/lib/components/SharingMeta.svelte`                                        |
| Contract tests                    | `tests/unit/structured-data.test.ts`, `src/lib/components/SharingMeta.test.ts` |

`SharingMeta` already receives every page's title, description, image, dates
and robots policy, so a page gets structured data by continuing to use that
component. Nothing else imports `structured-data.ts`, and nothing else should:
a second emitter is how two blocks start disagreeing about the same page.

## The shape

One `@graph` per page, not a pile of loose blocks. Because the nodes carry
`@id`s, the page node can _reference_ the Organization and the WebSite instead
of restating them:

```yaml
'@context': https://schema.org
'@graph':
  - '@type': Organization # @id: https://starspace.group/#organization
  - '@type': WebSite # @id: …/#website, publisher → the Organization
  - '@type': ImageObject # @id: <page>#primaryimage — only with a share image
  - '@type': WebPage # @id: <page>#webpage, isPartOf → the WebSite
  - '@type': BreadcrumbList # @id: <page>#breadcrumb — every page below home
  - '@type': ItemList # @id: <page>#itemlist — listing pages only
  - '@type': BlogPosting # @id: <page>#article — CMS items only
```

Four rules are load-bearing:

- **`@id`s are built from `site.url`, never from the request origin.** A node's
  `@id` is its identity across pages and crawls. A preview deployment that
  emitted its own hostname would read as a second, near-duplicate
  organisation.
- **A noindex page emits nothing.** Every one of them is an admin or account
  surface. Describing a page a crawler was told to skip is noise, and it names
  internal pages in a payload that robots directives do not cover.
- **Empty values are dropped, not shipped.** `"description": ""` is a claim
  that the page has no description, and an absent key is not.
- **Only the home page is `about` the Organization.** Claiming it on every page
  makes the claim worthless.

`WebSite` deliberately carries **no `potentialAction`/`SearchAction`**: the
command palette is a keyboard overlay with no shareable result URL, and
advertising a search endpoint that cannot be fetched is the same dishonesty
AGENTS.md §7 forbids of the API catalog.

## Adding a page

Pass what only the page knows. Everything else is derived:

```svelte
<SharingMeta
	title="Projects"
	{description}
	pageType="CollectionPage"
	breadcrumb={[{ name: 'Projects', path: '/projects' }]}
	items={projects.map((p) => ({ name: p.name, url: p.url, description: p.description }))}
/>
```

- `pageType` — the `WebPage` subtype. A listing is a `CollectionPage`, `/contact`
  is a `ContactPage`.
- `breadcrumb` — the trail below home, which is prepended for you. A page that
  passes none still gets `Home`, because a page one level down always has
  somewhere to go up to.
- `items` — a listing's entries, in render order. Off-site URLs are kept as
  they are, which is what lets `/projects` point at the projects themselves.
- `type="article"` (the existing Open Graph prop) is what adds the article node.
  `articleType="BlogPosting"` only when the item really is a post — a CMS type
  can be a changelog or a case study, and calling those blog posts is a claim
  the page does not support.

## Why `{@html}`, and why that is safe

Svelte treats a literal `<script>` in markup as a component script, so the
block is written with `{@html jsonLdScript(graph)}`. The graph carries CMS
titles and descriptions, so `escapeJsonLd` replaces `<`, `>`, `&`, U+2028 and
U+2029 with their `\uXXXX` forms. Those escapes are decoded by the JSON parser
and not by the HTML tokeniser, so the payload a crawler reads is identical
while `</script>` in an item title cannot close the element. This is the same
boundary AGENTS.md draws for CMS rich text: `{@html}` never receives
unsanitised CMS content.

Verified on 2026-09-21 against a local dev server: a published item titled
`JSON-LD probe </script>` rendered as `</script>` inside the payload,
parsed back to the original string, and left the page intact.
