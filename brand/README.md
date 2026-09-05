# Brand

`starspace-mark.png` is the *Space mark: the carved-wood star with an inscribed
delta that the community has used since before this site existed. It is the
**single source of truth**. Every icon, favicon, share card and in-page logo is
generated from it — nothing re-draws it, approximates it, or ships a second
version of it.

```bash
bun run build:brand
```

That regenerates all of these into `static/`, and they are committed:

| Output                                                 | What it is                                    |
| ------------------------------------------------------ | --------------------------------------------- |
| `favicon.svg`, `favicon-dark.svg`, `favicon-light.svg` | Tab icons — the mark on a night or light tile |
| `apple-touch-icon.png`                                 | 180×180, iOS home screen                      |
| `icon-192.png`, `icon-512.png`                         | PWA install icons                             |
| `og-image.png`                                         | 1200×630 share card                           |
| `brand/starspace-mark.webp`                            | 256px transparent mark for the nav and footer |

`og-image.svg` here is the share card's **layout**: the sky, the starfield and
the wording. `{{MARK}}` in it is replaced with the master as a data URI at build
time. Edit the wording there, not in the generated PNG.

## Why things are the way they are

- **The master is quantised to 256 colours.** The mark is a photograph of wood
  grain, so a palette costs nothing visible and takes the file from 1.4 MB to
  370 KB. The install icons are quantised for the same reason.
- **The favicons embed the mark as a data URI** rather than referencing it.
  Browsers routinely refuse to load external resources from an SVG used as a
  favicon, and that failure is silent — you get a blank tab icon with nothing to
  explain it.
- **Every generated PNG is flattened to RGB.** Apple rejects an alpha channel in
  a touch icon, and `tests/unit/product-identity.test.ts` checks the PNG colour
  type of all four.
- **The starfield on the card is seeded** (`20260904`), so rebuilding it is not a
  binary diff for its own sake.

The script needs ImageMagick 7 (`magick`) and `rsvg-convert`. It is deliberately
**not** part of `bun run build` — run it when the artwork or the card's wording
changes, and commit what it produces.
