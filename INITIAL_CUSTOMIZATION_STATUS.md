---
status: complete
app_name: *Space
branding_updated: true
share_assets_updated: true
template_documentation_removed: true
credential_fields_unique: true
last_updated: 2026-09-04
---

# Initial Customization Status

This file is the shared source of truth for humans and AI assistants.

## Current State

- Status: complete
- App name: *Space
- Branding updated: yes
- Share assets updated: yes
- Template documentation removed or replaced: yes
- Credential fields unique: yes

## What Was Done

This repository is the *Space website, not a template awaiting a name. The pass that got it
there, on 2026-09-04:

1. `bun run customize` set the name, short name, slug (`starspace-group`), dev port (4203),
   canonical URL and repo. Two things it could not get right on its own were repaired by hand:
   the new repo name contains the old slug, so every GitHub link was rewritten twice; and a name
   beginning with `*` lands inside regex literals, which turns `/NebulaKit/i` into an unclosed
   block comment.
2. The home page, `/projects` and `/sister-spaces` were built for this site; the starter's
   pitch for itself is gone from every public surface.
3. Brand assets are the *Space mark — favicons, app icons, and a share card generated from
   `static/og-image.svg`.
4. The theme carries the brand coral, darkened in light mode to clear WCAG AA on
   `primary/background`.

The rebranding machinery (`bun run customize`, [CUSTOMIZE.md](CUSTOMIZE.md),
[docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md)) is still here, inherited from
the template, for anyone forking this repository for something else.

## Notes

- `credential_fields_unique` tracks whether `site.slug` is this product's own slug.
  Every auth and secret form field derives its `id`/`name` from it (see
  [src/lib/utils/form-fields.ts](src/lib/utils/form-fields.ts)). The slug here is
  `starspace-group`, so a password manager will not offer another template site's
  credentials on this one.

- Keep this file in the repository so future sessions can see the onboarding work is finished and stop recommending it.
