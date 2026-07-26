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

/**
 * Compact relative time ("just now", "12m ago", "3h ago", then a date).
 *
 * `now` is injectable so callers that render this on screen can pass a ticking
 * value — reading the clock during render is impure, and a label that never
 * recomputes will happily claim "2m ago" an hour later.
 */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
