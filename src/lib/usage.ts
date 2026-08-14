import { supabase } from '@/lib/supabase';

/**
 * Usage tracking — which surfaces get opened and which actions get taken.
 *
 * Built for answering "does anyone actually use the Vault" and "is the calendar
 * being opened on phones", not for watching individuals. Two rules hold it to
 * that, and both are enforced rather than intended:
 *
 *   Only fixed labels are recorded. There is no parameter for user content and
 *   no column to put it in, so no call site can start logging a client name or
 *   a note by accident.
 *
 *   It never blocks or breaks anything. Every failure is swallowed — a
 *   telemetry outage must not stop someone opening a tab.
 */

export type UsageKind = 'view' | 'action';

/** Labels are fixed strings so the admin view can group them and nothing
 *  user-typed can leak in. Add to this union to add an event. */
export type UsageLabel =
  | 'new_production'
  | 'new_production_from_calendar'
  | 'quick_marker'
  // A calendar marker promoted into a full production — the Hold → Booked path.
  | 'marker_to_production'
  | 'production_from_marker'
  | 'add_contact'
  | 'add_deliverable'
  | 'export_call_sheet'
  | 'export_brief'
  | 'share_gear_list'
  | 'library_delete'
  | 'search_palette';

const viewport = (): string =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';

/**
 * Same surface opened repeatedly in a few seconds is one visit, not five.
 * Tab switching is fast and noisy, and a log full of bounce-throughs makes the
 * totals meaningless.
 */
const lastSeen = new Map<string, number>();
const DEDUPE_MS = 10_000;

async function record(kind: UsageKind, surface: string, label?: UsageLabel): Promise<void> {
  try {
    const key = `${kind}:${surface}:${label || ''}`;
    const now = Date.now();
    // Actions are always worth recording; only repeated views collapse.
    if (kind === 'view') {
      const seen = lastSeen.get(key);
      if (seen && now - seen < DEDUPE_MS) return;
      lastSeen.set(key, now);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    // The insert policy pins user_id to auth.uid(), so a signed-out write would
    // be rejected anyway. Returning early saves the round trip.
    if (!userId) return;

    await supabase.from('usage_events').insert([{
      user_id: userId,
      kind,
      surface,
      label: label || null,
      viewport: viewport(),
    }]);
  } catch {
    // Deliberately silent. Tracking is never worth an error in front of a user.
  }
}

/** A surface was opened — a tab, a board, a major panel. */
export function trackView(surface: string): void {
  void record('view', surface);
}

/** Something was done. `surface` is where from, `label` is what. */
export function trackAction(surface: string, label: UsageLabel): void {
  void record('action', surface, label);
}
