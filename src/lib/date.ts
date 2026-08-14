/**
 * Date helpers for Studio OS.
 *
 * Shoot dates, due dates, etc. are stored as date-only strings ("YYYY-MM-DD")
 * coming from <input type="date">. `new Date("2026-06-22")` parses that as
 * **UTC midnight**, so `toLocaleDateString` renders it in the previous day for
 * anyone in a negative-offset timezone (e.g. the US). That's the off-by-one
 * that made cards and call sheets show the wrong shoot date.
 *
 * `parseLocalDate` interprets a date-only string in the *local* timezone so the
 * day the user picked is the day that displays and exports.
 */

/** Parse a date string as a local date. Date-only strings ("YYYY-MM-DD") are
 *  treated as local midnight; full ISO datetimes fall through to native parsing. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a stored date string for display without timezone drift. */
export function formatLocalDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  fallback = 'TBD',
): string {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString('en-US', options) : fallback;
}

/* ------------------------------------------------------------------ *
 * Timezone-safe call times
 *
 * Call times are stored as wall-clock strings ("8:00 AM") with no zone —
 * they mean "8am where the shoot is", which for this studio is the studio's
 * timezone. The API routes that talk to Google run on Vercel, where the
 * server clock is UTC, so `new Date("2026-08-10T08:00:00")` used to parse as
 * 08:00 *UTC* and land on the calendar as 4:00 AM Eastern. Every conversion
 * between a stored call time and an absolute instant has to name the zone
 * explicitly; these helpers are the only sanctioned way to do it.
 * ------------------------------------------------------------------ */

/**
 * The zone stored call times are expressed in. Override per-deployment with
 * STUDIO_TIMEZONE (server) or NEXT_PUBLIC_STUDIO_TIMEZONE (client) — both
 * accept any IANA name, e.g. "America/Los_Angeles".
 */
export const STUDIO_TIME_ZONE: string =
  (typeof process !== 'undefined' &&
    (process.env.STUDIO_TIMEZONE || process.env.NEXT_PUBLIC_STUDIO_TIMEZONE)) ||
  'America/New_York';

export interface WallClock {
  hour: number;
  minute: number;
}

/** Parse a stored call time ("8:00 AM", "17:30", "8 AM") into 24h parts. */
export function parseCallTime(value: string | null | undefined): WallClock | null {
  if (!value) return null;
  const m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(value.trim());
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3]?.toUpperCase();

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  else if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23) return null;

  return { hour, minute };
}

/** Render 24h parts back into the stored display format ("8:00 AM"). */
export function formatCallTime({ hour, minute }: WallClock): string {
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

/**
 * Stored wall-clock time → the "HH:mm" an `<input type="time">` requires.
 * Anything unparseable comes back empty, which the input renders as blank
 * rather than refusing to show the field at all.
 */
export function toTimeInputValue(value: string | null | undefined): string {
  const parsed = parseCallTime(value);
  if (!parsed) return '';
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
}

/**
 * "HH:mm" from a time input → the display form everything else stores
 * ("2:00 PM"), so a time typed on the calendar reads the same as a call time
 * typed in Slate.
 */
export function fromTimeInputValue(value: string | null | undefined): string {
  const parsed = parseCallTime(value);
  return parsed ? formatCallTime(parsed) : '';
}

/** "YYYY-MM-DD" + N days, staying in date-string space (no DST arithmetic). */
export function addDays(dateStr: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return dateStr;
  // UTC math is safe here: the value is a plain calendar date, and UTC has no
  // DST discontinuities to skip a day across.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Offset, in ms, between the given instant's UTC reading and its reading in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asIfUtc - instant.getTime();
}

/**
 * Resolve a wall-clock date + time in `timeZone` to the absolute instant it
 * names. Two passes so times near a DST transition resolve with the offset
 * actually in effect at the target instant rather than the guessed one.
 */
export function zonedWallClockToDate(
  dateStr: string,
  { hour, minute }: WallClock,
  timeZone: string = STUDIO_TIME_ZONE,
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;

  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
  let instant = naive - zoneOffsetMs(new Date(naive), timeZone);
  instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/**
 * Read the wall clock out of a Google `dateTime` ("2026-08-10T08:00:00-04:00").
 * The string already carries the local time at the event's own location, so
 * the digits are taken verbatim — parsing it through `Date` would re-render
 * it in the server's zone and shift the hour.
 */
export function wallClockFromGoogleDateTime(
  dateTime: string | null | undefined,
): (WallClock & { date: string }) | null {
  if (!dateTime) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(dateTime.trim());
  if (!m) return null;
  return { date: m[1], hour: Number(m[2]), minute: Number(m[3]) };
}

/**
 * Today as "YYYY-MM-DD" in the viewer's own timezone.
 *
 * Built from local parts rather than `toISOString().split('T')[0]`, which
 * returns the UTC day: anywhere west of UTC that reads as tomorrow for the
 * whole evening, so a form defaulting to "today" pre-fills the wrong date.
 */
export function todayLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
