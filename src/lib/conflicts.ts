/**
 * Double-booking: is this person, or this piece of gear, already on another
 * shoot at the same time?
 *
 * Two shoots overlap when their days overlap. On a single shared day where
 * both have a call and a wrap time, they overlap only if those hours do — a
 * morning shoot and an evening one can share a camera operator. Missing times
 * count as the whole day: a warning that turns out unnecessary costs a glance,
 * a missed one costs a shoot.
 *
 * Dates are stored "YYYY-MM-DD" strings and compared as strings, like the rest
 * of the app, so no timezone can shift a day.
 */
import { parseCallTime } from './date';

export interface BookingJob {
  id: string;
  title: string;
  shoot_date?: string | null;
  end_date?: string | null;
  call_time?: string | null;
  wrap_time?: string | null;
  job_status?: string | null;
}

function span(job: BookingJob): { start: string; end: string } | null {
  if (!job.shoot_date) return null;
  const end = job.end_date && job.end_date > job.shoot_date ? job.end_date : job.shoot_date;
  return { start: job.shoot_date, end };
}

/** Minutes after midnight for call and wrap; a wrap at or before the call runs past midnight. */
function hours(job: BookingJob): { from: number; to: number } | null {
  const call = parseCallTime(job.call_time);
  const wrap = parseCallTime(job.wrap_time);
  if (!call || !wrap) return null;
  const from = call.hour * 60 + call.minute;
  let to = wrap.hour * 60 + wrap.minute;
  if (to <= from) to += 24 * 60;
  return { from, to };
}

/** Do two shoots claim the same time? Cancelled shoots claim nothing. */
export function shootsOverlap(a: BookingJob, b: BookingJob): boolean {
  if (a.job_status === 'Cancelled' || b.job_status === 'Cancelled') return false;
  const sa = span(a);
  const sb = span(b);
  if (!sa || !sb) return false;
  if (sa.end < sb.start || sb.end < sa.start) return false;

  // Same single day, both fully timed: the hours decide.
  if (sa.start === sa.end && sb.start === sb.end) {
    const ha = hours(a);
    const hb = hours(b);
    if (ha && hb) return ha.from < hb.to && hb.from < ha.to;
  }
  return true;
}

/** Other shoots overlapping `target`, earliest first. */
export function overlappingShoots<T extends BookingJob>(target: BookingJob, jobs: T[]): T[] {
  return jobs
    .filter(j => j.id !== target.id && shootsOverlap(target, j))
    .sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || ''));
}

/**
 * For each person on `target`'s crew, the other overlapping shoots they're
 * also crewed on. Only people with a clash appear in the result.
 */
export function crewConflicts(
  target: BookingJob,
  roles: { contact_id?: string | null; job_id: string }[],
  jobs: BookingJob[],
): Record<string, BookingJob[]> {
  const clashing = new Map(overlappingShoots(target, jobs).map(j => [j.id, j]));
  const out: Record<string, BookingJob[]> = {};
  for (const r of roles) {
    if (!r.contact_id || r.job_id === target.id) continue;
    const other = clashing.get(r.job_id);
    if (!other) continue;
    const list = (out[r.contact_id] ||= []);
    if (!list.some(j => j.id === other.id)) list.push(other);
  }
  return out;
}

export interface GearJob extends BookingJob {
  gear_manifest?: Record<string, number> | null;
}

export interface GearShortfall {
  item: string;
  /** How many this list wants. */
  wanted: number;
  /** How many the studio has. */
  owned: number;
  /** The overlapping shoots already using some, and how many each. */
  elsewhere: { job: GearJob; count: number }[];
}

/**
 * Items on this list that, together with overlapping shoots' lists, need more
 * than the studio owns. Items with no known quantity aren't judged.
 */
export function gearShortfalls(
  target: BookingJob,
  manifest: Record<string, number>,
  jobs: GearJob[],
  owned: Record<string, number>,
): GearShortfall[] {
  const others = overlappingShoots(target, jobs);
  const out: GearShortfall[] = [];
  for (const [item, wantedRaw] of Object.entries(manifest)) {
    const wanted = Number(wantedRaw) || 0;
    const have = owned[item];
    if (!wanted || have === undefined) continue;
    const elsewhere = others
      .map(job => ({ job, count: Number(job.gear_manifest?.[item]) || 0 }))
      .filter(e => e.count > 0);
    const used = elsewhere.reduce((n, e) => n + e.count, 0);
    if (used > 0 && used + wanted > have) out.push({ item, wanted, owned: have, elsewhere });
  }
  return out.sort((a, b) => a.item.localeCompare(b.item));
}
