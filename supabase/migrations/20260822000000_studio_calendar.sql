-- One studio calendar, not one per person.
--
-- Slate pushes a production to Google using whichever account happened to hit
-- Save, so a shoot booked by a producer landed on the *producer's* calendar and
-- never reached anyone else's. jobs.google_event_id is a single column — one
-- job maps to exactly one Google event — so the data model only ever supported
-- one calendar for the whole studio. This flag says which one it is.
--
-- The partial unique index enforces the "one" half: at most one row may carry
-- true, so designating a new studio calendar has to clear the old one first.

ALTER TABLE public.google_tokens
  ADD COLUMN IF NOT EXISTS is_studio_calendar BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_studio_calendar
  ON public.google_tokens (is_studio_calendar)
  WHERE is_studio_calendar;
