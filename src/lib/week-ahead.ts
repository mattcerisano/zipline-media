/**
 * The dashboard's "This week": what's coming, what's late, and what's been
 * left behind. Kept here rather than in the widget so the rules — which shoot
 * counts as this week, which card counts as late, which status is stale — are
 * plain functions with tests, not render-time guesses.
 *
 * Every date is a stored date-only string ("YYYY-MM-DD"). Comparing those as
 * strings orders them correctly and can't drag a day across a timezone, which
 * is how the rest of the app handles them too.
 */
import { addDays, parseCallTime } from './date';
import { daysOut } from './drives';

export interface WeekJob {
  id: string;
  title: string;
  client_name?: string | null;
  production_company?: string | null;
  job_status?: string | null;
  edit_status?: string | null;
  shoot_date?: string | null;
  end_date?: string | null;
  call_time?: string | null;
  location_name?: string | null;
  due_date?: string | null;
  editor_name?: string | null;
}

export interface WeekDrive {
  id: string;
  label: string;
  holder_name?: string | null;
  status?: string | null;
  checked_out_at?: string | null;
}

/** Statuses a shoot still carries when nobody closed it out afterwards. */
export const OPEN_SHOOT_STATUSES = ['Booked', 'Hold', 'Planning'] as const;

/** Edit stages that mean the work is finished. */
const DONE_EDIT_STAGES = new Set(['Delivered', 'Wrapped']);

/** The last day a shoot occupies — its end date for a multi-day run. */
export function lastDayOf(job: Pick<WeekJob, 'shoot_date' | 'end_date'>): string | null {
  if (!job.shoot_date) return null;
  return job.end_date && job.end_date > job.shoot_date ? job.end_date : job.shoot_date;
}

/** Minutes after midnight for a call time, with untimed shoots sorted last in their day. */
function callMinutes(call?: string | null): number {
  const t = parseCallTime(call);
  return t ? t.hour * 60 + t.minute : 24 * 60;
}

export interface ShootDay {
  /** "YYYY-MM-DD" */
  date: string;
  shoots: (WeekJob & { /** True on the second and later days of a multi-day shoot. */ continuing: boolean })[];
}

/**
 * Shoots on each day from `today` through the next `days - 1`, by call time.
 * A multi-day shoot appears on every day it runs, marked as continuing after
 * its first, because "who's on set Thursday" is the question this answers.
 * Cancelled shoots aren't happening, so they're left out.
 */
export function upcomingShootDays(jobs: WeekJob[], today: string, days = 7): ShootDay[] {
  const out: ShootDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const shoots = jobs
      .filter(j => j.job_status !== 'Cancelled' && j.shoot_date)
      .filter(j => {
        const end = lastDayOf(j) as string;
        return (j.shoot_date as string) <= date && date <= end;
      })
      .map(j => ({ ...j, continuing: (j.shoot_date as string) < date }))
      .sort((a, b) => callMinutes(a.call_time) - callMinutes(b.call_time) || a.title.localeCompare(b.title));
    if (shoots.length) out.push({ date, shoots });
  }
  return out;
}

export interface DueEdit extends WeekJob {
  overdue: boolean;
}

/**
 * Edit Tracker cards that are late or due within `days`, latest-due last.
 * Only cards actually on the board (an edit stage set) and not yet delivered.
 */
export function editsDue(jobs: WeekJob[], today: string, days = 7): DueEdit[] {
  const horizon = addDays(today, days - 1);
  return jobs
    .filter(j => j.job_status !== 'Cancelled')
    .filter(j => !!j.edit_status && !DONE_EDIT_STAGES.has(j.edit_status))
    .filter(j => !!j.due_date && (j.due_date as string) <= horizon)
    .map(j => ({ ...j, overdue: (j.due_date as string) < today }))
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string) || a.title.localeCompare(b.title));
}

/**
 * Shoots whose last day has passed but which still read Booked, Hold or
 * Planning. Nobody marked them wrapped (or cancelled), so they inflate the
 * booked count, stay in "upcoming" filters and never reach the edit board.
 * Most recent first — the one that just finished is the one to close out.
 */
export function needsClosingOut(jobs: WeekJob[], today: string): WeekJob[] {
  return jobs
    .filter(j => (OPEN_SHOOT_STATUSES as readonly string[]).includes(j.job_status || ''))
    .filter(j => {
      const end = lastDayOf(j);
      return !!end && end < today;
    })
    .sort((a, b) => (lastDayOf(b) as string).localeCompare(lastDayOf(a) as string));
}

/**
 * Drives that are out, the ones gone longest first. Days are counted the way
 * the Drive Tracker counts them (daysOut), so the two screens agree.
 */
export function drivesOutLongest(drives: WeekDrive[], now: Date = new Date(), limit = 5): (WeekDrive & { days: number | null })[] {
  return drives
    .filter(d => d.status === 'out')
    .map(d => ({ ...d, days: daysOut({ status: 'out', checked_out_at: d.checked_out_at ?? null }, now) }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.label.localeCompare(b.label))
    .slice(0, limit);
}
