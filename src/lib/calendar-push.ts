import { supabase } from '@/lib/supabase';

/**
 * Client-side helpers for keeping Google Calendar in step with Slate.
 *
 * Slate is the studio's scheduling surface: a production booked here should
 * appear on the team's Google Calendar without anyone re-entering it. Until
 * now the only thing that pushed was the Calendar tab's inline editor, so a
 * shoot created in Slate reached Google only if someone happened to open it
 * there and hit Save.
 *
 * Both helpers are deliberately quiet. A failed push must never block the
 * database write that already succeeded — the next sync reconciles, and the
 * caller decides whether to surface the returned message.
 */

export interface PushResult {
  /** True when the event reached Google. False covers "not connected" too. */
  ok: boolean;
  /** Human-readable outcome, suitable for a toast. Empty when uninteresting. */
  message: string;
}

async function callCalendar(body: Record<string, unknown>): Promise<PushResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      // An empty message here made every signed-out push fail with no trace
      // at all — callers skip logging when there's nothing to log.
      return { ok: false, message: 'Your session expired — sign in again to sync with Google Calendar.' };
    }

    const res = await fetch('/api/integrations/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { ok: false, message: data.error || data.message || 'Google Calendar sync failed.' };
    }
    return { ok: true, message: data.message || 'Synced to Google Calendar.' };
  } catch {
    return { ok: false, message: 'Could not reach Google Calendar.' };
  }
}

/** Create or update the Google Calendar event for a job. */
export function pushJobToGoogleCalendar(jobId: string): Promise<PushResult> {
  return callCalendar({ action: 'push', jobId });
}

/**
 * Remove a job's Google Calendar event. Call this *before* deleting the row —
 * the google_event_id is needed to find the event, and once the row is gone
 * the event would otherwise linger on the calendar forever (and get re-imported
 * as a new job on the next pull).
 */
export function removeJobFromGoogleCalendar(googleEventId?: string | null): Promise<PushResult> {
  if (!googleEventId) return Promise.resolve({ ok: true, message: '' });
  return callCalendar({ action: 'delete', googleEventId });
}

/**
 * Mirror a Calendar-tab marker (Hold, Meeting, time off) onto Google.
 *
 * Where it lands depends on what the marker says. Availability — Out of Office,
 * Travel Day, Available — goes onto every connected calendar, because it
 * describes someone's week and belongs next to their own appointments.
 * Bookings — Hold, Booked, Meeting, Planning, Edit Day — go to the studio
 * calendar alone, which the team already shares. Safe to call on every save:
 * each copy is updated in place, copies on calendars the marker no longer
 * belongs on are removed, and markers imported from Google are left alone.
 */
export function pushEventToGoogleCalendar(eventId: string): Promise<PushResult> {
  return callCalendar({ action: 'push_event', eventId });
}

/**
 * Remove a marker from Google. Takes the *Slate* event id, not a Google one:
 * a mirrored marker has a different id on every calendar, and the server is the
 * only side that knows them all. Call it before deleting the row, while those
 * links are still readable.
 */
export function removeEventFromGoogleCalendar(eventId?: string | null): Promise<PushResult> {
  if (!eventId) return Promise.resolve({ ok: true, message: '' });
  return callCalendar({ action: 'delete_event', eventId });
}
