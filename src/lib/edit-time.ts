/**
 * Time logged against an edit card.
 *
 * Pure helpers only — parsing, formatting, and totalling. Every rule that
 * decides whether a span is *allowed* lives in the database and in
 * /api/edits/time; the caps repeated here are the same numbers, so the form can
 * refuse an impossible entry before the round trip rather than a second,
 * looser opinion about what counts.
 */

export interface TimeEntry {
  id: string;
  job_id: string;
  user_id: string;
  user_email?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  source: 'timer' | 'manual';
  note?: string | null;
  auto_closed?: boolean;
}

/** A timer still running after this is closed at the cap and marked. */
export const AUTO_CLOSE_HOURS = 12;

/** Hard ceiling on a single entry, matching the CHECK constraint. */
export const MAX_ENTRY_SECONDS = 24 * 60 * 60;

/** Ceiling on one hand-typed entry. Longer than a day's editing is a typo. */
export const MAX_MANUAL_MINUTES = 12 * 60;

export const MAX_NOTE_LEN = 500;

/** Is this entry still running? */
export const isRunning = (entry: TimeEntry): boolean => !entry.ended_at;

/**
 * Seconds on an entry. A stopped entry reports what the database computed from
 * its two timestamps; a running one is measured from its start, so the number
 * ticks without anything being written.
 */
export function entrySeconds(entry: TimeEntry, now: number = Date.now()): number {
  if (entry.ended_at) {
    if (typeof entry.duration_seconds === 'number') return Math.max(0, entry.duration_seconds);
    return elapsedSeconds(entry.started_at, now, Date.parse(entry.ended_at));
  }
  return elapsedSeconds(entry.started_at, now);
}

function elapsedSeconds(startedAt: string, now: number, end?: number): number {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  const finish = end !== undefined && !Number.isNaN(end) ? end : now;
  return Math.max(0, Math.floor((finish - start) / 1000));
}

/** Total across entries, running ones included. */
export function totalSeconds(entries: TimeEntry[], now: number = Date.now()): number {
  return entries.reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
}

/** "3h 05m" / "47m" / "—" for nothing at all. Billing shape, not stopwatch. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** "01:24:07" — the running timer, where the seconds are the point. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map(part => String(part).padStart(2, '0')).join(':');
}

/** Decimal hours, for an invoice line. 1h 45m → 1.75. */
export function billableHours(seconds: number): number {
  return Math.round((Math.max(0, seconds) / 3600) * 100) / 100;
}

/**
 * Read a hand-typed amount of time.
 *
 * Accepts what people actually type when they forgot to start the timer:
 * "90" (minutes), "1.5", "1.5h", "1h30", "1h 30m", "45m", "2:15". Returns
 * minutes, or null when it isn't a usable amount — including zero, a negative,
 * and anything past the per-entry cap, so the caller has one thing to check.
 */
export function parseManualMinutes(raw: string): number | null {
  const text = (raw || '').trim().toLowerCase();
  if (!text) return null;

  let minutes: number | null = null;

  const clock = text.match(/^(\d{1,2}):([0-5]\d)$/);
  // The trailing "m" is optional so "1h30" reads the same as "1h 30m".
  const composite = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+(?:\.\d+)?)\s*m?(?:ins?|inutes?)?)?$/);
  const justMinutes = text.match(/^(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?$/);
  const bare = text.match(/^(\d+(?:\.\d+)?)$/);

  if (clock) {
    minutes = Number(clock[1]) * 60 + Number(clock[2]);
  } else if (composite) {
    minutes = Number(composite[1]) * 60 + (composite[2] ? Number(composite[2]) : 0);
  } else if (justMinutes) {
    minutes = Number(justMinutes[1]);
  } else if (bare) {
    // A bare number is minutes — "30" is half an hour, not thirty of them.
    minutes = Number(bare[1]);
  }

  if (minutes === null || !Number.isFinite(minutes)) return null;
  minutes = Math.round(minutes);
  if (minutes <= 0 || minutes > MAX_MANUAL_MINUTES) return null;
  return minutes;
}
