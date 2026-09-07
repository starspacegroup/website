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
- [x] The hero is the share card's night sky in both themes (`HeroSky.svelte`, the seeded
      starfield in `src/lib/hero-sky.ts`, the `--hero-*` tokens in `src/app.css`). Verified:
      `src/lib/hero-sky.test.ts`; headless screenshots at 1440 and 390 in both themes, with
      JavaScript off, and under prefers-reduced-motion; `bun run check` and
      `bun run validate:contrast` clean.
- [x] The hero fills a wide screen without coming apart on one: a 90rem centred column,
      the mark hanging in the margin so the name, the promise, the copy and the buttons
      all start on one rail, and the live proof (count, trend, `#Ten Forward`) gathered
      into a column of its own on the right. Verified: headless screenshots and measured
      element edges at 2000, 1440, 1280 and 390; the copy's rail is one x, and the count
      and the panel share both edges. Full bleed was tried first and reverted — pinned to
      the edges of a 2000px monitor the two halves sit a third of a screen apart.
- [x] The hero has a sky in each theme: the share card's night in dark, the same sky at
      dawn in light. Full `--hero-*` sets in both `:root` and `[data-theme='dark']`, with
      `--hero-glow` split from `--hero-primary` (a halo is never text, so it keeps the
      bright coral in both). Verified: ratios computed against the cool end of each
      gradient, which is the darker one — light is text 15.4:1, secondary 6.8:1, primary
      4.8:1, success 4.8:1; screenshots at 2000, 1440 and 390 in both themes.
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
- [x] The `/documentation` route is gone, on David's call on 2026-09-07, along with its test,
      `docs/DOCUMENTATION_PAGE.md`, the AGENTS.md rule that required keeping it in sync, and
      its sitemap, palette, footer and `service-doc` entries. Removing the rule renumbered the
      Release Rules list, so agent discovery moved from §8 to §7 across the tree. Verified:
      `bun run check`, full coverage, and `tests/unit/agent-readiness.test.ts`, which now
      asserts the catalog advertises no `service-doc` at all.

- [x] `/guide` — the server guide: every public channel and what it is for, every command
      SpaceBot answers to, and how to make your own room. Read from SpaceBot rather than
      written here, and cached in KV for a day (`src/lib/server/guild-directory.ts`,
      `src/routes/guide/`). Needed two SpaceBot changes, committed there as `94bfef3`: a
      `guild_channels` table with a gateway sync and `GET /api/v1/channels` behind a new
      `channels:read` scope, and a fix to `/api/v1/commands`, which filtered on the real
      guild id and so never returned the built-ins. Verified: unit and component tests
      cover the populated page; the running site can only show the fallback, because no
      SpaceBot key is configured locally.

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

- [ ] Reconnect SpaceBot after deploying. The Connect handshake now asks for `channels:read`
      and `commands:read` as well, and a key issued before this change carries neither, so
      `/guide` will show its "not available" notice until the owner reconnects.
      `/admin/spacebot` reports each scope separately and says which half is missing.

- [ ] Run `bun run test:e2e` and keep it green. Not run in this session; it needs
      `bunx playwright install` and a local D1 migration first.
- [ ] Re-scrape the share card in each platform's debugger after the first deploy. They cache the
      old card for days; a `?v=2` on the URL forces Discord and Slack immediately.
- [ ] Decide whether the project directory should become a CMS content type once real bindings
      exist. It is checked-in data today so the page renders without a database — a real
      constraint, not laziness. Revisit only if non-developers need to edit it.
- [ ] The old site had per-page share cards (`/og/projects.png`); this one points every page at
      the single `og-image.png`. Worth restoring if `/projects` gets shared much.
