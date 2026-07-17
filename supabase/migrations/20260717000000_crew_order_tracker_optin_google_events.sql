-- 1. Crew manifest ordering: lets producers control the order crew appear in
--    on the Call Sheet / Master Brief exports. NULLs sort last, so existing
--    rows keep their current (insertion) order until explicitly reordered.
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 2. Edit Tracker is opt-in: new jobs no longer land on the post board
--    automatically. The board already filters on edit_status being set; the
--    old DEFAULT 'Filmed' defeated that by stamping every new job.
ALTER TABLE jobs ALTER COLUMN edit_status DROP DEFAULT;

-- 3. Google Calendar import: calendar sync can now pull the team's regular
--    Google events in as calendar markers. The google_event_id makes the
--    import idempotent (re-syncs update instead of duplicating). Unique index
--    on a nullable column still allows unlimited manual markers (NULLs are
--    distinct in Postgres).
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_event_id
  ON calendar_events (google_event_id);
