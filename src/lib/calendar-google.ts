import { createClient } from '@supabase/supabase-js';
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
 * Create or update a job's event on one Google calendar, and record the id.
 *
 * Shared by the interactive push and the backfill pass, so a job that reaches
 * Google by either route ends up with exactly the same event. Storing the
 * returned id is what stops the next pull importing it as a brand new job.
 */
export async function pushJobEvent(token: string, job: any): Promise<string | null> {
  const eventBody = buildJobEventBody(job, await crewForJob(job.id));
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const create = () => fetch(EVENTS_URL, { method: 'POST', headers, body: JSON.stringify(eventBody) });

  let response: Response;
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

  if (newGoogleEventId && newGoogleEventId !== job.google_event_id) {
    await supabaseAdmin.from('jobs').update({ google_event_id: newGoogleEventId }).eq('id', job.id);
  }

  return newGoogleEventId || null;
}
