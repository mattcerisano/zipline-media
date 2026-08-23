import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { SLATE_APP_TAG } from '@/lib/calendar-tags';
import { buildJobDescription } from '@/lib/event-description';
import { buildGoogleTiming, DEFAULT_SHOOT_HOURS } from '@/lib/calendar-timing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/** Tangerine. Productions, so they stand apart from every marker type. */
export const PRODUCTION_COLOR_ID = '6';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Translate a job's stored date/time fields into a Google event's start/end.
 * The timing rules themselves live in src/lib/calendar-timing.ts, shared with
 * markers and unit-tested there.
 */
export function buildEventTiming(job: {
  shoot_date?: string | null;
  end_date?: string | null;
  call_time?: string | null;
  wrap_time?: string | null;
}): { start: Record<string, string>; end: Record<string, string> } {
  return buildGoogleTiming({
    startDate: job.shoot_date || new Date().toISOString().split('T')[0],
    endDate: job.end_date,
    startTime: job.call_time,
    endTime: job.wrap_time,
    defaultDurationHours: DEFAULT_SHOOT_HOURS,
  });
}

/** The Google event body for a production, crew call sheet and all. */
export function buildJobEventBody(job: any, crew: any[]): Record<string, any> {
  return {
    summary: `🎥 ${job.title}`,
    description: buildJobDescription(job, crew || []),
    location: job.location_address || job.location_name || '',
    ...buildEventTiming(job),
    colorId: PRODUCTION_COLOR_ID,
    // Machine-readable linkage back to Slate. The "Slate ID:" line in the
    // description is human-facing and breaks the moment someone edits the
    // description in Google; this survives edits and lets the pull find
    // Slate's own events without depending on the 🎥 title prefix.
    extendedProperties: {
      private: {
        app: SLATE_APP_TAG,
        slateJobId: job.id,
      },
    },
  };
}

/** Crew rides along in the description, so the event doubles as a pocket call
 *  sheet. Ordered the way the manifest is, and failing soft: a roles lookup
 *  that errors must not block the calendar push. */
async function crewForJob(jobId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('job_roles')
    .select('name, position, department, phone, call_time, sort_order')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true, nullsFirst: false });
  return data || [];
}

/**
 * Remove one event from one calendar, treating "already gone" as done.
 *
 * 404 means it was deleted outright and 410 that Google is holding a tombstone;
 * both are the end state this asks for. Returns whether the event was actually
 * there, which is how the sweep below knows when to stop looking.
 */
export async function deleteEventFrom(token: string, googleEventId: string): Promise<boolean> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) return true;
  if (res.status === 404 || res.status === 410) return false;

  throw new Error(`Google Calendar delete failed with status ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Every account with a Google connection, for sweeps that must span calendars. */
async function connectedUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('google_tokens').select('id');
  return (data || []).map((row: any) => row.id as string);
}

/**
 * Delete an event that has been left behind on a calendar we no longer write to.
 *
 * A production pushed before the studio calendar was designated lives on
 * whoever saved it — the event survives the job being republished to the studio
 * calendar, so the same shoot shows up twice for that one person and nothing
 * ever removes the copy. Jobs now record which calendar holds their event, so
 * usually there is exactly one place to look. Rows written before that column
 * existed have no owner recorded, so fall back to trying each connected account
 * in turn.
 *
 * Only ever targets an id Slate itself stored, so a sweep cannot touch an event
 * the studio did not create. Failures are swallowed: an orphan left behind is
 * untidy, never a reason to fail the push that has already succeeded.
 */
export async function reapOrphanedEvent(
  googleEventId: string,
  knownOwnerId: string | null | undefined,
  skipUserId: string | null
): Promise<boolean> {
  const candidates = knownOwnerId ? [knownOwnerId] : await connectedUserIds();

  for (const userId of candidates) {
    if (userId === skipUserId) continue;
    try {
      const token = await getValidGoogleToken(userId);
      if (!token) continue;
      if (await deleteEventFrom(token, googleEventId)) return true;
    } catch (err: any) {
      console.warn(`Could not reap event ${googleEventId} from ${userId}:`, err?.message);
    }
  }

  return false;
}

/**
 * Store where a job's Google event ended up.
 *
 * Falls back to the id alone on databases that haven't added
 * `google_calendar_user_id`: losing the attribution costs a tidier orphan
 * sweep later, while losing the id would have the next pull import the event
 * as a brand new job.
 */
async function recordJobEvent(jobId: string, googleEventId: string | null, calendarUserId: string | null) {
  const { error } = await supabaseAdmin
    .from('jobs')
    .update({ google_event_id: googleEventId, google_calendar_user_id: calendarUserId })
    .eq('id', jobId);

  if (error && /google_calendar_user_id|schema cache/i.test(error.message || '')) {
    await supabaseAdmin.from('jobs').update({ google_event_id: googleEventId }).eq('id', jobId);
  } else if (error) {
    console.warn(`Could not record the Google event for job ${jobId}:`, error.message);
  }
}

/**
 * Create or update a job's event on one Google calendar, and record the id.
 *
 * Shared by the interactive push and the backfill pass, so a job that reaches
 * Google by either route ends up with exactly the same event. Storing the
 * returned id is what stops the next pull importing it as a brand new job.
 *
 * `calendarUserId` is whose calendar `token` opens, recorded alongside the id so
 * a later push or delete knows where the event actually is.
 */
export async function pushJobEvent(
  token: string,
  job: any,
  calendarUserId?: string | null
): Promise<string | null> {
  const eventBody = buildJobEventBody(job, await crewForJob(job.id));
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const create = () => fetch(EVENTS_URL, { method: 'POST', headers, body: JSON.stringify(eventBody) });

  let response: Response;
  let recreated = false;
  if (job.google_event_id) {
    response = await fetch(`${EVENTS_URL}/${encodeURIComponent(job.google_event_id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(eventBody),
    });

    // 404 = the event was deleted outright; 410 = it was cancelled and Google
    // is holding a tombstone. Neither can be updated in place, so recreate
    // rather than leaving the job silently unsynced.
    if (response.status === 404 || response.status === 410) {
      recreated = true;
      response = await create();
    }
  } else {
    response = await create();
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API responded with status ${response.status}: ${errText}`);
  }

  const eventData = await response.json();
  const newGoogleEventId = eventData.id;

  const idChanged = !!newGoogleEventId && newGoogleEventId !== job.google_event_id;
  const ownerChanged = !!calendarUserId && calendarUserId !== job.google_calendar_user_id;
  if (idChanged || ownerChanged) {
    await recordJobEvent(job.id, idChanged ? newGoogleEventId : job.google_event_id, calendarUserId ?? null);
  }

  // Having to recreate means the old id was not on this calendar — it is on
  // whichever one the job was pushed to before, where it will keep showing the
  // shoot for exactly one person unless it is removed.
  if (recreated && job.google_event_id) {
    await reapOrphanedEvent(job.google_event_id, job.google_calendar_user_id, calendarUserId ?? null);
  }

  return newGoogleEventId || null;
}
