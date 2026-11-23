-- B3 (2026-11-23): counters for the password-guess throttle used by sign-in and
-- account merge (src/lib/server/login-throttle.ts, Dafny-proved core). Ported from
-- NebulaKit backports 0030 / Pinfool 0039. Kept in D1, not KV: KV allows 1,000
-- writes a day on the free plan and each failure writes two counters, so one
-- address failing on purpose could spend them and switch the throttle off.
-- `expires_at` is unix seconds. Additive only. Until it is applied the throttle
-- fails open (allows attempts), as before this change.
CREATE TABLE IF NOT EXISTS login_throttle (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_login_throttle_expires ON login_throttle (expires_at);
