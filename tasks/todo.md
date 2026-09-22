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

- [x] The badge: `/badge` picks the wording and the ground and hands out six snippets,
      `/badge.svg` serves the image a README embeds, and `/badge.js` serves the
      `<starspace-badge>` element. `src/lib/badge.ts` had been committed on 2026-09-12 with
      nothing importing it and no endpoint; this is the half that makes it reachable.
      Two defects found while wiring it up and fixed: `isBadgeVariant` used `in`, so
      `/badge.svg?variant=toString` rendered a function body as the label, and the flat
      average-glyph width estimate left "MEMBER OF" touching "*Space" while "BUILT AT" sat
      a gulf away — the runs are now two tspans the renderer places, centred in a pill
      sized from a real advance table. Verified: `bun run check`; `bun run test:coverage`,
      2,567 passing and above the 95 floor on all four; `bun run build`; and the three
      endpoints probed headlessly against `vite preview`, with every variant rendered to
      PNG in both themes and the page screenshotted in both. Deployed and verified live
      on 2026-09-15: `/badge`, `/badge.svg` and `/badge.js` all answer 200 on
      starspace.group, every variant renders, and `?variant=toString` returns the default
      badge.

- [x] schema.org JSON-LD on every indexable page (2026-09-21). The site carried complete
      Open Graph and Twitter metadata and **no structured data at all**, so a search engine
      had to infer what *Space is from prose. `src/lib/structured-data.ts` builds one
      `@graph` per page — Organization, WebSite, WebPage, plus a BreadcrumbList, an ItemList
      and an Article when the page has them — and `SharingMeta.svelte` is the only emitter,
      deriving it from props that component already took. `/contact` had hand-rolled its
      title and description and so carried no share card either; it uses `SharingMeta` now.
      `@id`s are pinned to `site.url` rather than the request origin, a noindex page emits
      nothing, and `escapeJsonLd` keeps CMS text from closing the `<script>` it rides in.
      See `docs/STRUCTURED_DATA.md`. Verified: `bun run check` clean over 1,709 files;
      `bun run test` 2,612 passing; `bun run test:coverage` at 97.98% lines with the new
      module at 100% on all four; and the blocks read off a running dev server for `/`,
      `/projects`, `/contact`, `/privacy`, `/blog` and a seeded `/blog/…` item — every one
      valid JSON, `/chat` (noindex) emitting none, and an item titled
      `JSON-LD probe </script>` rendering as `\u003c/script\u003e` with the page intact.
      Not verified live: this is local evidence only, on an undeployed change.

- [x] `/stats` — the server's figures in public, and a member's own once they sign in with
      Discord (2026-09-22). Anyone can sign in with Discord already; what was missing was
      somewhere for it to be worth doing. The public half reads `GET /api/v1/stats` with the
      `stats:read` the site already holds and caches it in KV for ten minutes, so it works the
      moment SpaceBot is connected. The personal half needed a SpaceBot change, committed there
      as `116bfbd`: `GET /api/v1/members/:userId` behind a new `members:read` scope that
      `stats:read` deliberately does not imply, serving counts only — messages, voice time,
      commands, and where those put somebody among everyone else that month. Membership comes
      from `guild_members_cache`, so somebody who left stops being readable the moment the
      gateway notices. The Discord id comes from `oauth_accounts` for the current session and
      from nowhere else; SpaceBot cannot tell whether the asker owns the account, so that check
      is this site's to keep. See `docs/PUBLIC_STATS.md`. One defect found and fixed in SpaceBot
      while testing: an absent `days` parameter arrived as null and clamped the window to one
      day instead of thirty. Verified: `bun run check` clean over 1,722 files;
      `bun run test:coverage` 2,676 passing, all four metrics above the 95 floor, with the three
      new modules at 100% lines; `bun run validate:contrast` clean; `bun run build:ci`;
      `bunx prettier --check` on every touched file. Not verified live — local evidence only,
      on an undeployed change, and the deployed key does not carry `members:read` yet.

## Next — before this can be deployed

- [x] Create this site's own Cloudflare resources and write the real ids into `wrangler.toml`.
      Done in `411c83a`. Verified: `bun run build` succeeds, and `bun run deploy` reaches the
      `starspace-website` Pages project, which the apex domain serves.
- [x] Generate `SESSION_SECRET` and `SETUP_SECRET` independently and set them as Pages secrets.
      Both are on the `starspace-website` production environment. Still open: run `/setup` once
      against the deployed app to establish owner identity, and confirm it refuses a second run.

- [x] Discord sign-in on the deployed site (2026-09-22). Its own Discord application, `*Space`
      under the `*Space` team, client id `1551909332621197353` — deliberately not the bot's
      application, whose secret could not be read back without resetting it and breaking
      whatever holds it now. Redirects registered for `https://starspace.group` and
      `http://localhost:5173`, both at `/api/auth/discord/callback`. `DISCORD_CLIENT_ID` and
      `DISCORD_CLIENT_SECRET` are Pages secrets and are in the gitignored `.dev.vars` for local
      work. Verified live: `GET /api/auth/discord` now 302s to `discord.com/api/oauth2/authorize`
      with that client id and callback, where it previously bounced to
      `/setup?error=oauth_not_configured`. The production D1 already carries `users`, `sessions`,
      `oauth_accounts` and `oauth_transactions`. **Not verified: the round trip** — consenting on
      Discord and landing back signed in needs a real Discord account and a browser.
- [x] Decide the publication target and add it as a remote on purpose. David set `origin` to
      `starspacegroup/website` on 2026-09-06; NebulaKit stays as the `template` remote.
- [x] Point `starspace.group` at the new deployment. Already done, and earlier than this list
      recorded: the apex is a custom domain on the `starspace-website` Pages project, and
      `starspace-group-svelte` now has only its `.pages.dev`. Still open: the old repository's
      README does not yet say where the site moved.

## Parked

- [ ] `/sister-spaces` — the allied-makerspace directory (Arete.study). Built, then removed on
      David's call on 2026-09-04 while it is not wanted on the site. It is not abandoned: the
      route, `src/lib/data/sister-spaces.ts`, the card art and every link to them come back with
      a revert of the commit that removed them. Restore it from git rather than rewriting it —
      the address, map link and photo are already correct there.

## Next — worth doing, not blocking

- [ ] Reconnect SpaceBot after deploying. The Connect handshake now asks for `channels:read`,
      `commands:read` and `members:read` as well, and a key issued before those changes carries
      none of them — so `/guide` will show its "not available" notice, and `/stats` will show the
      server's figures with no personal panel, until the owner reconnects. `/admin/spacebot`
      reports each scope on its own row and says what each missing one costs.

      Now the only thing between a signed-in member and the personal panel. SpaceBot's own
          deploy was the other half and is done: `116bfbd` sat unpushed, so the live bot 404'd
          `/api/v1/members/:userId` and the panel fell to "not available" for a reason that looked
          like a missing scope and was not one. Rebased onto five dependabot merges as `103336b`,
          pushed, and Cloudflare built it. Verified: `spacebot.starspace.group/_app/version.json`
          reads `103336b`, and the endpoint now answers
          `403 {"error":"Insufficient scope. Required: members:read"}` — the right refusal, from a
          key issued 2026-09-07.

- [ ] Run `bun run test:e2e` and keep it green. Not run in this session; it needs
      `bunx playwright install` and a local D1 migration first.
- [ ] Re-scrape the share card in each platform's debugger after the first deploy. They cache the
      old card for days; a `?v=2` on the URL forces Discord and Slack immediately.
- [ ] Decide whether the project directory should become a CMS content type once real bindings
      exist. It is checked-in data today so the page renders without a database — a real
      constraint, not laziness. Revisit only if non-developers need to edit it.
- [ ] The old site had per-page share cards (`/og/projects.png`); this one points every page at
      the single `og-image.png`. Worth restoring if `/projects` gets shared much.
