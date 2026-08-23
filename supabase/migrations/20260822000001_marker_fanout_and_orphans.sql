-- Two follow-ups to the studio-calendar change.
--
-- 1. Markers fan out per person. Productions belong on the one studio calendar,
--    but a Hold, a Travel Day or an Out of Office is something each person
--    wants on their own calendar. calendar_events.google_event_id holds a
--    single id, so mirroring a marker to several calendars needs a row per
--    (marker, account) instead. The legacy column stays exactly as it is: it
--    identifies markers imported *from* Google, which is a different job.
--
-- 2. Jobs record which calendar their event is actually on. Without it, a
--    production pushed to someone's personal calendar before the studio one
--    was designated leaves an untouchable copy behind — nothing knows whose
--    calendar to look in to clean it up.

CREATE TABLE IF NOT EXISTS public.calendar_event_google_links (
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- One Google event is one marker copy: catches a link row pointing at an event
-- another row already claims on the same calendar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cegl_user_google_event
  ON public.calendar_event_google_links (user_id, google_event_id);

-- Reverse lookup, for cleaning up after an event cancelled on Google's side.
CREATE INDEX IF NOT EXISTS idx_cegl_google_event
  ON public.calendar_event_google_links (google_event_id);

-- Tokens-adjacent: only the service role touches this, same as google_tokens.
-- RLS on with no policies denies every anon/authenticated read and write.
ALTER TABLE public.calendar_event_google_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS google_calendar_user_id UUID;
