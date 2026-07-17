-- Deletion round-trip for imported Google Calendar markers:
--   * hidden=true is a tombstone: a teammate removed the marker in-app, and
--     re-syncs must not resurrect it (upserts never touch `hidden`).
--   * Events cancelled/deleted on the Google side are removed here by the
--     sync (it now requests showDeleted and deletes matching rows outright).
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
