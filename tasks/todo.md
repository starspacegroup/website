# starspace.group completion ledger

A task is complete only when the implementation **and** its stated verification both pass. Local
evidence, remote state, and Cloudflare deployment evidence are tracked separately, because they
fail separately.

## Done — the site itself

- [x] Rebrand the template clone: name, short name, slug `starspace-group`, dev port 4203,
      canonical URL, repo. Verified: `INITIAL_CUSTOMIZATION_STATUS.md` reads `status: complete`,
      and `tests/unit/product-identity.test.ts` fails on "starter template" copy.
- [x] Repair the two things `bun run customize` could not: the doubled slug in every GitHub link,
      and `*` landing inside regex literals. Verified: `bun run check`, 0 errors.
- [x] Home page — hero, live Discord member count, join CTA, six-card explainer, featured project
      shelf, closing CTA.
- [x] `/projects` over checked-in data in `src/lib/data/`. Verified:
      `tests/unit/site-content.test.ts`, including that every named image is on disk.
- [x] `src/lib/discord.ts` owns the invite code and the count fetch, and throws rather than
      rendering a blank number when Discord rate-limits or the invite is revoked. Verified:
      `src/lib/discord.test.ts`, 7 cases.
- [x] Brand palette in `src/app.css`. Verified: `bun run validate:contrast`, both themes AA.
- [x] Icon set and share card from the *Space mark, all PNGs flattened to RGB. Verified:
      `tests/unit/product-identity.test.ts`.
- [x] Nav, footer, command palette and `SITEMAP_ROUTES` all carry `/projects`. Verified:
      `tests/unit/agent-readiness.test.ts`, which fails when a public route is unregistered.
- [x] `/documentation` describes this site, and documents where the content lives. Verified:
      `tests/unit/documentation-page.test.ts`.

## Next — before this can be deployed

- [ ] Create this site's own Cloudflare resources and write the real ids into `wrangler.toml`:
      `bun run setup:cf`, then `bunx wrangler r2 bucket create starspace-group-files`, then
      `bun run db:migrate`. **Never paste ids from a sibling project** — see
      `docs/CLOUDFLARE_SETUP.md`. Acceptance: `bun run build` succeeds (it fails today by design)
      and `bun run check:bindings` is clean.
- [ ] Generate `SESSION_SECRET` and `SETUP_SECRET` independently, set them as Pages secrets, and
      run `/setup` once to establish owner identity. Acceptance: sign-in works against the
      deployed app; `/setup` refuses to run a second time.
- [ ] Decide the publication target and add it as a remote on purpose. There is deliberately no
      `origin` today; upstream NebulaKit is the `template` remote. Acceptance: a maintainer, not
      an agent, sets it.
- [ ] Point `starspace.group` at the new deployment and retire `starspace-group-svelte`.
      Acceptance: the live domain serves this build; the old repository's README says where the
      site moved.

## Parked

- [ ] `/sister-spaces` — the allied-makerspace directory (Arete.study). Built, then removed on
      David's call on 2026-09-04 while it is not wanted on the site. It is not abandoned: the
      route, `src/lib/data/sister-spaces.ts`, the card art and every link to them come back with
      a revert of the commit that removed them. Restore it from git rather than rewriting it —
      the address, map link and photo are already correct there.

## Next — worth doing, not blocking

- [ ] Run `bun run test:e2e` and keep it green. Not run in this session; it needs
      `bunx playwright install` and a local D1 migration first.
- [ ] Re-scrape the share card in each platform's debugger after the first deploy. They cache the
      old card for days; a `?v=2` on the URL forces Discord and Slack immediately.
- [ ] Decide whether the project directory should become a CMS content type once real bindings
      exist. It is checked-in data today so the page renders without a database — a real
      constraint, not laziness. Revisit only if non-developers need to edit it.
- [ ] The old site had per-page share cards (`/og/projects.png`); this one points every page at
      the single `og-image.png`. Worth restoring if `/projects` gets shared much.
