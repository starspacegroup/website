# Goals

## Ship starspace.group on this codebase

status: in progress

- Replace `starspace-group-svelte` — the flowbite build of the same site — with this one, on the
  NebulaKit platform, so the community site and the community's own starter stop being two
  unrelated pieces of work.
- Done so far, and verified locally rather than claimed: the rebranding pass
  (`INITIAL_CUSTOMIZATION_STATUS.md` is `status: complete`); the home page and `/projects` built
  for this site; the *Space icon set and share card; the brand palette clearing WCAG AA in both
  themes. `bun run check` is clean across 1,651 files, `bun run test` is
  2,316 passing, and `bun run validate:contrast` passes both themes.
- **Not yet done, and blocking a deploy:** `wrangler.toml` still carries the template's
  placeholder D1 and KV identifiers. `bun run build` fails by design until real, project-owned
  resources exist — see `tasks/todo.md`. That is a deliberate guard, not a bug: six sibling
  products once shared one D1 and one KV, including OAuth secrets.
- Not claimed: no production build, no deployment, and no live-binding verification has been run,
  because the bindings do not exist yet. E2E has not been run in this session either.
- Publication is a maintainer decision. The repository has a `template` remote pointing at
  NebulaKit and deliberately **no `origin`**, so nothing here can be pushed anywhere by accident.
  A push target for this site has to be created and set on purpose.

## Archive

`tasks/archive/` holds the ledger this repository inherited from NebulaKit — the starter's own
2026-08 quality and security pass. It is kept for provenance and is **not** this site's ledger;
the PR numbers and permissions it discusses belong to the template's repository, which after the
rename share a name with this one.
