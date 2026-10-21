import { formatLocalDate } from '@/lib/date';

/** The fields a production picker needs; `Job` satisfies it. */
export interface PickableProduction {
  id: string;
  title: string;
  shoot_date?: string | null;
  job_status?: string | null;
  client_name?: string | null;
}

/**
 * Soonest shoot first, then past shoots newest first, then undated: the
 * order the Gear Builder's production picker uses. `today` is a local
 * YYYY-MM-DD, the same shape as shoot_date, so the comparison is textual.
 */
export function orderProductions<T extends PickableProduction>(jobs: T[], today: string): T[] {
  const dated = (j: T): j is T & { shoot_date: string } => !!j.shoot_date;
  const upcoming = jobs.filter(dated).filter(j => j.shoot_date >= today).sort((a, b) => a.shoot_date.localeCompare(b.shoot_date));
  const past = jobs.filter(dated).filter(j => j.shoot_date < today).sort((a, b) => b.shoot_date.localeCompare(a.shoot_date));
  const undated = jobs.filter(j => !j.shoot_date);
  return [...upcoming, ...past, ...undated];
}

/** "Title — Oct 21, 2026 · Client · Hold"; Booked is the norm so it is left off. */
export function productionLabel(job: PickableProduction): string {
  const date = job.shoot_date
    ? formatLocalDate(job.shoot_date, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'date TBD';
  const status = job.job_status && job.job_status !== 'Booked' ? job.job_status : null;
  return [`${job.title} — ${date}`, job.client_name, status].filter(Boolean).join(' · ');
}
