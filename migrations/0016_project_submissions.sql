-- Project submissions: a member of the Discord server, signed in with that
-- account, asks for their project to be listed on /projects.
--
-- The directory itself stays checked-in data (src/lib/data/projects.ts): a
-- submission is a request for a human to add an entry, not an entry. The
-- reviewer moves it one way from pending to approved or rejected; approving
-- here does not publish anything, the maintainer still adds the card.
--
-- discord_user_id is the snowflake the membership check was made against,
-- kept so a reviewer can find the person in the server. user_id ties it to the
-- site account for "your submissions" on the page.
CREATE TABLE IF NOT EXISTS project_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_submissions_created ON project_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_submissions_status ON project_submissions(status);
CREATE INDEX IF NOT EXISTS idx_project_submissions_user ON project_submissions(user_id);
