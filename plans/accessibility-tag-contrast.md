# The "Made at *Space" tag fails AA in the light theme

**Status:** found 2026-09-20, not yet fixed. One rule, one component.

Found while auditing the sites shown as work on davis9001.com — that site sells
accessibility, so anything it points at has to survive the same audit it does.
`starspace.group` came back clean in dark and with one violation type in light.

## What fails

`src/lib/components/TagPill.svelte`, the `.tag-made-here` variant:

| colour | on | ratio | needs |
|---|---|---|---|
| `#bc3f1f` | `#f0dfdb` | **4.21:1** | 4.5:1 |

13.2px regular, so no large-text exemption. It is close — a near miss rather
than a careless one — but every "Made at *Space" tag on the projects grid is
below the line, and that is the tag doing the most work on the page.

## The fix

`#b43c1d` clears it at 4.52:1 on the same tinted background. Same hue, one
step darker, and it stays visibly the warm accent rather than turning brown.

If the tag's background is itself a tint of the accent, the cleaner fix is to
darken the text and leave the tint alone, rather than lightening the tint —
lightening it drags every other tag variant with it.

## Worth noting

The dark theme passes. This is the shape of bug that light/dark parity hides:
whoever tuned this was almost certainly looking at the dark side, where the
same pair clears comfortably. A contrast check that runs over both themes in
CI catches it; one that runs over the theme you happen to be using does not.

NebulaKit ships `bun run validate:contrast`, which checks the token pairs but
not component-level combinations like this one. Extending it to walk rendered
components would have caught this — worth considering upstream.
