-- Times on calendar markers.
--
-- calendar_events carried dates and nothing else, so every marker was an
-- all-day block: a 2:00 PM client meeting booked on the Calendar tab covered
-- the whole day here and pushed to Google as an all-day event, which is what
-- made the calendar useless for telling whether an afternoon was actually
-- free. Events imported *from* Google lost their times the same way.
--
-- Text rather than TIME, matching jobs.call_time and jobs.wrap_time. These are
-- wall-clock strings in the studio's timezone ("2:00 PM"), deliberately not
-- absolute instants — see the note in src/lib/date.ts about why storing them
-- as timestamps is what turned an 8:00 AM call into 4:00 AM on Google.
--
-- Both nullable: a marker with no start time stays an all-day entry, which is
-- the right shape for a hold or a day off.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;
