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
      return { ok: false, message: '' };
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
 * Mirror a Calendar-tab marker (Hold, Meeting, time off) onto Google as an
 * all-day event. Safe to call on every save — the server updates in place once
 * the marker has a Google event id, and ignores markers imported from Google.
 */
export function pushEventToGoogleCalendar(eventId: string): Promise<PushResult> {
  return callCalendar({ action: 'push_event', eventId });
}

/**
 * Remove a marker's Google event. Shares the job delete path — the Google API
 * call is the same, and both treat an already-gone event as success.
 */
export function removeEventFromGoogleCalendar(googleEventId?: string | null): Promise<PushResult> {
  if (!googleEventId) return Promise.resolve({ ok: true, message: '' });
  return callCalendar({ action: 'delete', googleEventId });
}
