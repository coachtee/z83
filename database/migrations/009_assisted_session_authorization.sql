-- Staff opening a session must not, by itself, grant access to the
-- applicant's data. A session starts 'pending' and only becomes 'open'
-- once the applicant explicitly authorizes it themselves (their own
-- password, entered on the shared device) — see POST
-- /cafe/sessions/:id/authorize in docs/API.md.
ALTER TABLE assisted_sessions DROP CONSTRAINT assisted_sessions_status_check;
ALTER TABLE assisted_sessions ADD CONSTRAINT assisted_sessions_status_check
  CHECK (status IN ('pending', 'open', 'closed'));
ALTER TABLE assisted_sessions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE assisted_sessions ADD COLUMN authorized_at timestamptz;

-- The "one open session per applicant" index only covered 'open' before;
-- a pending session (not yet authorized) should equally block a second
-- concurrent request for the same applicant.
DROP INDEX idx_assisted_sessions_one_open_per_applicant;
CREATE UNIQUE INDEX idx_assisted_sessions_one_active_per_applicant
  ON assisted_sessions(applicant_user_id) WHERE status IN ('pending', 'open');
