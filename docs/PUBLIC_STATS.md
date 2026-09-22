# `/stats` — the server's figures, and your own

The public stats page. Two halves that fail independently, and a privacy line
between them that the whole design is arranged around.

Related: [`ADMIN_STATS.md`](ADMIN_STATS.md) is the _other_ stats page — this
site's own traffic, owner-only. They share nothing but a word.

## What the page shows

| To                                        | What                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Anyone, signed in or not                  | The server right now (people, channels, boosts) and the last 30 days (messages, voice time, joins and leaves) |
| Signed in, no Discord linked              | The same, plus an offer to link Discord                                                                       |
| Signed in with Discord, not in the server | The same, plus an invite                                                                                      |
| Signed in with Discord, in the server     | The same, plus their own counts, standing and join date                                                       |

**Signing in is an offer, never a wall.** The public half is the whole page
minus one panel. `page.test.ts` pins that: every signed-out case asserts the
server figures are still on screen.

## Where the numbers come from

Both halves read SpaceBot. Neither is computed here, and nothing is hardcoded —
if SpaceBot cannot say, this site does not say.

| Half       | Endpoint                              | Scope          | Reader                             |
| ---------- | ------------------------------------- | -------------- | ---------------------------------- |
| The server | `GET /api/v1/stats?days=90`           | `stats:read`   | `src/lib/server/guild-stats.ts`    |
| One member | `GET /api/v1/members/:userId?days=30` | `members:read` | `src/lib/server/member-profile.ts` |

`stats:read` is already on every key this site holds — it is what draws the
hero's member trend — so the public half works the moment SpaceBot is
connected. **`members:read` is new**, and a key issued before it existed does
not carry it. `/admin/spacebot` reports it as its own row, and the Connect
handshake now asks for it (`CONNECT_SCOPES`). Until the owner reconnects, the
personal panel says the figures are not available and the rest of the page is
unaffected.

Presentation lives in `src/lib/stats-copy.ts`, which is client-safe — the page
component imports it, and SvelteKit will not let a component reach into
`$lib/server`. It borrows `formatDuration`, `formatWhen` and `whenClause` from
`channel-activity.ts` rather than growing a second set, so `/guide` and `/stats`
cannot disagree about what "3.4 hours" or "yesterday" looks like.

## The privacy line

Three rules, and each one is a test.

**The Discord id never comes from the request.** `discordAccountId` reads
`oauth_accounts` for `locals.user.id` — the session the hooks already
established. Signing in with Discord is the entire proof that the account is
yours, so the id must have exactly one source. A `?user=` parameter would turn
this page into a lookup service for anyone who knows a snowflake, and SpaceBot
cannot tell the difference: a key with `members:read` may ask about any member.
That trust is this site's to keep.

The id is also re-checked against `^\d{5,32}$` on the way out, because it goes
into a URL and a row this site did not write is not trusted for being in this
site's database.

**Nothing personal is cached anywhere shared.** The server's figures go in KV
under `guild:stats`, because the answer is identical for every visitor. One
person's figures are never written to KV at all, and the page sets
`cache-control: private, no-store` — the same header `/guide` carries, for the
same reason plus one: a stored copy of this page would be a copy of somebody's
own numbers.

**SpaceBot sends counts, not content.** Messages, voice seconds, commands, and
a rank. No message text, no channel ids, no names, and never a word about who
else is ahead of them. The module could not publish what it was never given.

## What fails to what

Each surface degrades on its own. There is no state where one failure takes down
another.

- No SpaceBot key, or an unreachable bot → `available: false` on both halves.
  The page says the figures are unavailable and points at Discord. It never
  renders a wall of zeroes: **a zero on a stats page is a claim.**
- A key with `stats:read` and no `members:read` → the whole public page, no
  personal panel, and a line saying so.
- A snapshot with no member count → no "right now" tile, the daily rows intact.
  Half a page beats an error page.
- Fewer than 30 days of history → the window is labelled by the days it has.
  A server SpaceBot has watched for eleven days reads "the last 11 days", not
  "the last 30".
- Fewer than two days → no sparkline. One point is not a line, and drawing it
  flat claims a trend nobody measured.

## Numbers the page deliberately will not give

- **A window-wide unique poster count.** SpaceBot's rollups are distinct-people
  _per day_; summing them counts the same regular once per day they showed up.
  `totalGuildDays` has no such field, and a comment says why.
- **A rank for somebody who did none of that thing.** "Last of 37" is a claim
  about a contest they did not enter. The population is still shown — it is what
  "nobody posted this month" and "you are the only one who didn't" are told
  apart by.
- **A total that quietly omits unlogged channels.** Channels in the server's
  `excluded_channels` were never recorded, so they cannot be counted;
  `unrecorded_channels` is what lets the panel say so out loud.
- **A percentile of the server.** `formatAhead` says "ahead of 90%", of the
  people who turned up that month — not "top 10%", which invites reading a rank
  as a share of the whole membership.

## Files

```
src/lib/server/guild-stats.ts     the server's figures, from SpaceBot
src/lib/server/member-profile.ts  one member's, plus discordAccountId
src/lib/stats-copy.ts             presentation; client-safe
src/routes/stats/+page.server.ts  the KV cache and the three states
src/routes/stats/+page.svelte     the page
```

Tests sit beside each one. `tests/unit/agent-readiness.test.ts` fails if
`/stats` ever leaves `SITEMAP_ROUTES`.
