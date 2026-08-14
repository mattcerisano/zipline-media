import { STUDIO_TIME_ZONE, addDays, wallClockFromGoogleDateTime } from '@/lib/date';

/**
 * Start/end for an edit pushed back onto an event that came *from* Google.
 *
 * A calendar marker stores dates only — the importer keeps the day a Google
 * event falls on and drops the clock. So moving a marker's date can't be sent
 * to Google as-is: writing `{ date }` onto a 2 PM meeting turns it into an
 * all-day block and loses the time nobody asked to change.
 *
 * This reads the shape back off the Google event and rebuilds the timing in
 * the same shape: all-day events move as all-day events, timed events keep the
 * hours they were booked at and move only the day.
 */

export interface GoogleEventTiming {
  start?: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
  end?: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
}

export interface MarkerDates {
  event_date: string;
  end_date?: string | null;
}

const hhmmss = ({ hour, minute }: { hour: number; minute: number }) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

/**
 * Returns the `start`/`end` to PATCH, or null when the Google event carries a
 * time that can't be read — better to refuse the push than to guess an hour
 * and overwrite the real one.
 */
export function importedMarkerTiming(
  google: GoogleEventTiming,
  marker: MarkerDates,
): { start: Record<string, string>; end: Record<string, string> } | null {
  const startDate = marker.event_date;
  // An end at or before the start is a single day, not a span — same reading
  // the rest of the calendar gives it.
  const lastDay = marker.end_date && marker.end_date > startDate ? marker.end_date : startDate;

  if (google.start?.date) {
    // All-day. Google's all-day end is exclusive, so a single day ends tomorrow.
    return { start: { date: startDate }, end: { date: addDays(lastDay, 1) } };
  }

  const startWall = wallClockFromGoogleDateTime(google.start?.dateTime);
  const endWall = wallClockFromGoogleDateTime(google.end?.dateTime);
  if (!startWall || !endWall) return null;

  // A wrap at or before the call is an event running past midnight, so its end
  // belongs on the following day. Without this, dragging an overnight event to
  // a single day would ask Google to end it before it starts, and Google would
  // reject the whole edit.
  const crossesMidnight =
    endWall.hour * 60 + endWall.minute <= startWall.hour * 60 + startWall.minute;
  const endDay = crossesMidnight ? addDays(lastDay, 1) : lastDay;

  // Naive wall clock plus an explicit zone, never a fixed UTC offset: moving
  // an event across a DST boundary with the old offset baked in would shift
  // the meeting by an hour.
  return {
    start: {
      dateTime: `${startDate}T${hhmmss(startWall)}`,
      timeZone: google.start?.timeZone || STUDIO_TIME_ZONE,
    },
    end: {
      dateTime: `${endDay}T${hhmmss(endWall)}`,
      timeZone: google.end?.timeZone || google.start?.timeZone || STUDIO_TIME_ZONE,
    },
  };
}
