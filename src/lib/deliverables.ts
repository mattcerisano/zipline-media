/**
 * Deliverables — the cutdowns and versions a shoot owes the client.
 *
 * Stored in `social_deliverables`, which despite the name is the studio's only
 * deliverables table: it predates the Slate board reading it. A row can hang
 * off a client, a job, or both. The Social tab lists them by client; Slate
 * pins them to the production they came out of.
 *
 * The shape and the status vocabulary live here rather than in either screen,
 * so the two can't drift into disagreeing about what "delivered" means.
 */

export interface Deliverable {
  id: string;
  client_id?: string | null;
  job_id?: string | null;
  label?: string | null;
  format?: string | null;
  duration?: string | null;
  platform?: string | null;
  status?: string | null;
  asset_url?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export const DELIVERABLE_STATUS = ['todo', 'in_progress', 'delivered'] as const;
export const DELIVERABLE_FORMATS = ['9:16', '1:1', '16:9', '4:5', '2.39:1'] as const;

/** Tapping the status chip walks the pipeline and wraps back to the start. */
export function nextDeliverableStatus(current?: string | null): string {
  const i = DELIVERABLE_STATUS.indexOf((current || 'todo') as (typeof DELIVERABLE_STATUS)[number]);
  return DELIVERABLE_STATUS[(i + 1) % DELIVERABLE_STATUS.length];
}

/** "in_progress" → "in progress". Stored value stays snake_case. */
export const deliverableStatusLabel = (s?: string | null) => (s || 'todo').replace('_', ' ');

/** Chip colours, shared so a deliverable reads the same on either screen. */
export function deliverableStatusTone(status?: string | null): string {
  if (status === 'delivered') return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  if (status === 'in_progress') return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  return 'text-white/40 border-white/15 bg-white/5';
}
