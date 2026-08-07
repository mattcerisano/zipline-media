-- Wrap time on a production.
--
-- Jobs carried a call time and nothing else, so every calendar event assumed a
-- flat eight-hour day: an 8:00 AM call always ended at 4:00 PM on Google,
-- whatever the shoot actually was. A half-day read as a full one and a
-- fourteen-hour day read as short, which is misleading to anyone reading the
-- calendar to see whether someone is free.
--
-- Text rather than TIME, matching call_time. These are wall-clock strings in
-- the studio's timezone ("6:00 PM"), deliberately not absolute instants — see
-- the note in src/lib/date.ts about why storing them as timestamps is what
-- turned an 8:00 AM call into 4:00 AM on Google Calendar.
--
-- Nullable: most shoots are booked before anyone knows when they'll wrap, and
-- an empty wrap keeps the previous eight-hour estimate rather than forcing a
-- guess at creation time.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS wrap_time TEXT;
