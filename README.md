[![*Space — an inclusive digital coworking space on Discord](./static/og-image.png)](https://github.com/starspacegroup/website)

# *Space

The website for [starspace.group](https://starspace.group) — the front page with its live
Discord member count, and the project directory.

It is built on [NebulaKit](https://nebulakit.starspace.group/), the community's own SvelteKit
and Cloudflare starter, and it keeps the whole platform: accounts, a command palette, a
D1-backed CMS, AI chat, first-party analytics, and the test gates that come with them. That is
deliberate — the site is also the place those capabilities get exercised in public.

It replaces `starspace-group-svelte`, the earlier flowbite build of the same site.

[![SvelteKit](https://img.shields.io/badge/SvelteKit-4%2F5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/docs/kit)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/pages/)
[![Coverage](https://img.shields.io/badge/coverage-95%25%20floor-5b5bd6)](./CONTRIBUTING.md#coverage-requirements)

## What ships

- **The public site:** the hero with a live member count read straight from Discord's public
  invite endpoint, `/projects`, and share cards built from the *Space mark.
- **Content operations:** typed CMS schemas, rich-text embeds, tags, media uploads, public
  content routes, and guarded admin editing.
- **Authentication:** email/password accounts plus GitHub and Discord OAuth, account linking,
  session cookies, owner bootstrap, and per-user admin permissions.
- **AI workspace:** configurable provider keys, streaming chat, conversation history, model
  selection, and optional realtime voice sessions.
- **Private administration:** users, auth credentials, AI keys, contact submissions, CMS,
  privacy-safe PII reveal controls, and first-party analytics.
- **Agent-ready publishing:** `robots.txt`, dynamic sitemap, RFC 9727 API catalog, Agent Skills
  discovery, `/auth.md`, HTML-to-Markdown negotiation, and read-only WebMCP tools.
- **Accessible shell:** command palette, responsive navigation, light/dark themes, complete PWA
  install metadata, automated WCAG AA contrast checks, and a widget board whose every pointer
  gesture has a keyboard equivalent.

*Space does **not** advertise an OAuth authorization server or an MCP server. Its discovery
metadata lists only routes this repository actually implements. Keep it that way.

Planned additions are tracked in [ROADMAP.md](./ROADMAP.md).

## Requirements

- [Bun](https://bun.sh/) 1.3.14 or newer
- A Cloudflare account with Pages, D1, KV, and R2 access for remote deployment
- Node.js 22 or newer when running the Node-based utility scripts

The repository deliberately contains placeholder D1/KV identifiers. Builds fail until real,
project-owned resources are configured; this prevents accidental access to another deployment's
data.

## Editing the site's content

The project directory is checked-in TypeScript, not CMS entries — it changes a few times a year,
and the page has to render on a clone that has never been pointed at a database.

| To change                                               | Edit                                                   |
| ------------------------------------------------------- | ------------------------------------------------------ |
| The projects grid, and the three the home page features | `src/lib/data/projects.ts`                             |
| The Discord invite, everywhere at once                  | `src/lib/discord.ts`                                   |
| Name, tagline, URL, dev port, repo                      | `src/lib/site.config.ts`                               |
| The logo, and every icon and card derived from it       | `brand/starspace-mark.png`, then `bun run build:brand` |

Card artwork goes under `static/projects/` as WebP, around 900px wide. `bun run
capture:projects` refreshes it — every project is somebody else's live site and they redesign
without telling us:

```bash
bun run capture:projects              # all of them
bun run capture:projects athena game  # just these
```

It only replaces the pictures. When a site has been redesigned the copy beside it is usually
stale too, so read the page and fix the entry by hand — a card whose picture and words disagree
is worse than an old picture.
`tests/unit/site-content.test.ts` fails when an entry names a file that is not there, so a
renamed asset never reaches the page as a broken card.

`featuredProjects` is the first three entries of the same list, so a new project at the top of
`projects.ts` leads the home page and the directory together.

### Rebranding a fork

This repository is *Space's own site, so its rebranding pass is already done —
[INITIAL_CUSTOMIZATION_STATUS.md](./INITIAL_CUSTOMIZATION_STATUS.md) records that. The machinery
that did it is still here, inherited from the template, if you fork this for something else:

```bash
bun run customize --dry    # preview every file it would touch, writes nothing
bun run customize          # interactive rename: name, slug, dev port, repo, URL
```

Two things it cannot get right on its own, both learned the hard way here: a new repo name
containing the old slug gets rewritten twice, and a name beginning with `*` lands inside regex
literals. Read [CUSTOMIZE.md](./CUSTOMIZE.md) and check `bun run check` afterwards.

## Local development

```bash
bun install --frozen-lockfile
bun run db:migrate:local
bun run dev
```

Open <http://localhost:4203>. Local migrations use Wrangler's local state and do not require
production Cloudflare identifiers.

Useful commands:

```bash
bun run check              # Svelte/TypeScript diagnostics
bun run test               # unit and integration tests
bun run test:coverage      # enforced 95% floor on all four metrics
bun run validate:contrast  # WCAG AA theme contrast
bun run test:e2e           # local D1 migration + Playwright suite
bun run validate:all       # check + tests + contrast
```

The authoritative contribution and test workflow is in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Cloudflare setup

Authenticate Wrangler, select the intended Cloudflare account, then create *Space-owned
resources:

```bash
bunx wrangler login
bun run setup:cf --dry-run
bun run setup:cf
bunx wrangler r2 bucket create starspace-group-files
bun run db:migrate
```

`bun run setup:cf` creates the D1 database and separate production/preview KV namespaces, writes
their identifiers to `wrangler.toml`, and runs the binding guard. If more than one account is
available, set `CLOUDFLARE_ACCOUNT_ID` explicitly before running it.

Never reuse resource IDs from another project. Never set the KV preview namespace equal to the
production namespace. See [docs/CLOUDFLARE_SETUP.md](./docs/CLOUDFLARE_SETUP.md) for the complete
procedure and failure recovery.

After the resources exist:

```bash
bun run build
bun run deploy
```

Secrets belong in Cloudflare Pages settings or Wrangler secrets, never in Git. Start with
[.env.example](./.env.example) for local configuration. Authentication requires separate,
high-entropy `SESSION_SECRET` and `SETUP_SECRET` values; generate each independently before using
`/setup`.

## Application workflow

1. Run the local or remote D1 migrations.
2. Set `SESSION_SECRET` and `SETUP_SECRET`, then open `/setup` with the bootstrap secret to configure
   owner identity and authentication credentials.
3. Sign in through `/auth/login` or create a password account through `/auth/signup`.
4. Configure AI providers under `/admin/ai-keys` if chat is required.
5. Create content types and entries under `/admin/cms`.
6. Review privacy-safe usage data at `/admin/stats` when the account has `can_view_stats`.

## Architecture

```text
src/
├── lib/
│   ├── cms/          # schemas, registry, embeds, uploads
│   ├── components/   # application and admin UI
│   ├── server/       # request-bound server helpers
│   ├── services/     # CMS, contact, account merge, AI clients
│   └── utils/        # sessions, auth state, analytics, validation
└── routes/
    ├── admin/        # protected operator surfaces
    ├── api/          # auth, CMS, chat, stats, setup, uploads
    └── chat/         # authenticated AI workspace

migrations/           # immutable ordered D1 migrations
scripts/              # binding, migration, setup, palette, tunnel tools
static/               # icons and social assets
tests/                # unit, integration, fixtures, and E2E
```

Important boundaries:

- Existing migration files are immutable once committed to `main`; add a new numbered migration.
- Colors come from CSS variables in `src/app.css`; do not add hardcoded theme colors.
- Tests must never use a real user store or production Cloudflare resource.
- Discovery metadata must not claim routes or protocols the application does not implement.

## Documentation

- [Rebranding a fork](./CUSTOMIZE.md) and its [deep reference](./docs/INITIAL_CUSTOMIZATION.md)
- [Local setup](./docs/LOCAL_SETUP.md)
- [Cloudflare setup](./docs/CLOUDFLARE_SETUP.md)
- [Agent readiness](./docs/AGENT_READINESS.md)
- [CMS embeds](./docs/CMS_EMBEDS.md)
- [Admin analytics](./docs/ADMIN_STATS.md)
- [Theme system](./docs/THEME_SYSTEM.md)
- [Command palette](./docs/COMMAND_PALETTE.md)
- [TDD workflow](./docs/TDD_WORKFLOW.md)

## Contributing

Use Conventional Commits, write behavior tests first, keep all coverage metrics at or above 95%,
and run the full relevant gates before opening a pull request. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).
