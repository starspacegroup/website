-- B5 (2026-11-23), ported from the Pinfool fork (its 0039_request_limits.sql) via
-- NebulaKit backports (its 0030). Numbered 0017 on this lineage (0016 is the last).
--
-- Counters that limit how often one client address may do something costly:
-- send a contact message, create an account, or start an OAuth sign-in. Without
-- them one script could use up the day's database writes.
--
-- `who` is a SHA-256 of the client address, never the address itself. A row is
-- one fixed window (`window_start`, unix seconds) for one `scope`; old windows
-- are deleted a batch at a time (src/lib/server/request-limit.ts pruneLimits).
-- Additive only. Until it is applied the limiter fails open (allows requests).
CREATE TABLE IF NOT EXISTS request_limits (
	scope TEXT NOT NULL,
	who TEXT NOT NULL,
	window_start INTEGER NOT NULL,
	hits INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (scope, who, window_start)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits (window_start);
