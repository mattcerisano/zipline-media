import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { pullGoogleCalendarForUser, pushMissingJobsToStudioCalendar, describeBackfill } from '@/lib/calendar-sync';
import { STUDIO_MARKER_TAG } from '@/lib/calendar-tags';
import { pushJobEvent } from '@/lib/calendar-google';
import { getStudioCalendarToken } from '@/lib/studio-calendar';
import { getAuthedUserId } from '@/lib/api-auth';
import { buildMarkerDescription } from '@/lib/event-description';
import { buildGoogleTiming, DEFAULT_MARKER_HOURS } from '@/lib/calendar-timing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Google Calendar colour ids per marker preset. Mirrors EVENT_PRESETS in
 * ProductionCalendar — duplicated deliberately, because that module is
 * 'use client' and importing it into a route would drag React into the server
 * bundle. Keep the two in step.
 */
const GOOGLE_COLOR_BY_PRESET: Record<string, string> = {
  hold: '5',       // Banana
  timeout: '4',    // Flamingo
  booked: '10',    // Basil
  meeting: '7',    // Peacock
  planning: '1',   // Lavender
  available: '2',  // Sage
  travel: '9',     // Blueberry
  edit: '3',       // Grape
};

/** Display names for marker presets, for the event description. */
const PRESET_LABELS: Record<string, string> = {
  hold: 'Hold',
  timeout: 'Out of Office',
  booked: 'Booked',
  meeting: 'Meeting',
  planning: 'Planning Shoot',
  available: 'Available',
  travel: 'Travel Day',
  edit: 'Edit Day',
};

export async function POST(request: Request) {
  try {
    // Identity is derived from the verified session, not the request body, so a
    // user can only sync their own connected Google Calendar.
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { action, jobId } = body;

    // Which Google account a request touches depends on its direction.
    //
    // Writes — push, push_event, delete, and the push half of sync — go to the
    // *studio* calendar whoever is signed in. Sending them to the acting user's
    // calendar is what scattered productions across personal calendars: a shoot
    // a producer booked landed on the producer's own Google Calendar, or nowhere
    // at all if they had never connected Google, and nobody else ever saw it.
    // `jobs.google_event_id` holds one id, so one calendar is all the schema
    // ever supported.
    //
    // Reads keep the caller's own token, which is what the pull is for: it
    // imports the signed-in user's Google events into Slate as markers.
    const writes = action === 'push' || action === 'push_event' || action === 'delete' || action === 'sync';
    const studio = writes ? await getStudioCalendarToken(userId) : null;
    if (studio && !studio.token) {
      return NextResponse.json({ success: false, message: studio.message || 'Google account not connected.' });
    }

    // Non-null for every write action; the pull resolves its own below.
    const token = studio?.token as string;

    // ==========================================
    // ACTION: PUSH TO GOOGLE CALENDAR
    // ==========================================
    if (action === 'push') {
      if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required for push' }, { status: 400 });
      }

      // Fetch job from Supabase
      const { data: job, error: jobErr } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobErr || !job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // Building the event and writing it back are shared with the backfill
      // pass, so a production reaches Google identically however it got there.
      const googleEventId = await pushJobEvent(token, job);

      return NextResponse.json({ success: true, message: 'Google Calendar event synced.', googleEventId });
    }

    // ==========================================
    // ACTION: PUSH A CALENDAR MARKER TO GOOGLE
    // ==========================================
    // Holds, meetings, and time off created on the Calendar tab. A marker with
    // a start time is pushed as a timed event; one without stays all-day,
    // which is the right shape for a hold or a day off.
    if (action === 'push_event') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }

      const { data: event, error: evErr } = await supabaseAdmin
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (evErr || !event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Markers imported *from* Google are Google's to change, not ours —
      // pushing one back would fight the next sync.
      if (event.preset === 'google') {
        return NextResponse.json({ success: true, message: 'Imported event — left as-is.' });
      }

      const timing = buildGoogleTiming({
        startDate: event.event_date,
        endDate: event.end_date,
        startTime: event.start_time,
        endTime: event.end_time,
        defaultDurationHours: DEFAULT_MARKER_HOURS,
      });
      const eventBody: any = {
        summary: event.title || 'Untitled',
        description: buildMarkerDescription({
          notes: event.notes,
          presetLabel: PRESET_LABELS[event.preset] || null,
          event_date: event.event_date,
          end_date: event.end_date,
          start_time: event.start_time,
          end_time: event.end_time,
        }),
        start: timing.start,
        end: timing.end,
        // Same colour as the chip in Studio OS, so a Hold reads as a Hold in
        // both places rather than taking the calendar's default blue.
        colorId: GOOGLE_COLOR_BY_PRESET[event.preset] || undefined,
        extendedProperties: { private: { app: STUDIO_MARKER_TAG, studioEventId: event.id } },
      };

      let res: Response;
      if (event.google_event_id) {
        res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.google_event_id)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventBody),
          }
        );
        // 404 = deleted, 410 = cancelled. Neither can be updated in place.
        if (res.status === 404 || res.status === 410) {
          res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventBody),
          });
        }
      } else {
        res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        });
      }

      if (!res.ok) {
        throw new Error(`Google Calendar event push failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      }

      const created = await res.json();
      if (created.id && created.id !== event.google_event_id) {
        // Storing the id is what stops the next import creating a duplicate.
        await supabaseAdmin
          .from('calendar_events')
          .update({ google_event_id: created.id })
          .eq('id', event.id);
      }

      return NextResponse.json({ success: true, message: 'Event synced to Google Calendar.', googleEventId: created.id });
    }

    // ==========================================
    // ACTION: DELETE THE GOOGLE EVENT FOR A JOB
    // ==========================================
    // Called before the job row is removed, so a production deleted in Slate
    // stops occupying the team's Google Calendar. Without this the event
    // outlived the job and the next pull re-imported it as a brand new one.
    if (action === 'delete') {
      const { googleEventId } = body;
      if (!googleEventId || typeof googleEventId !== 'string') {
        return NextResponse.json({ success: true, message: 'No Google event to remove.' });
      }

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );

      // 404/410 mean it is already gone — the desired end state either way.
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const errText = await res.text();
        throw new Error(`Google Calendar delete failed with status ${res.status}: ${errText}`);
      }

      return NextResponse.json({ success: true, message: 'Google Calendar event removed.' });
    }

    // ==========================================
    // ACTION: PULL FROM GOOGLE CALENDAR
    // ==========================================
    if (action === 'pull') {
      // Shared with the background cron (/api/cron/calendar-sync) so manual
      // and automatic syncs behave identically.
      const own = await getValidGoogleToken(userId);
      if (!own) {
        return NextResponse.json({ success: false, message: 'Google account not connected.' });
      }
      const result = await pullGoogleCalendarForUser(userId, own);
      return NextResponse.json({ success: true, message: result.message });
    }

    // ==========================================
    // ACTION: TWO-WAY SYNC
    // ==========================================
    // What the "Run Two-Way Sync" button has always claimed to do. It used to
    // send action:'pull' and nothing else, so Slate → Google never ran outside
    // an individual save — dates a colleague added stayed invisible on the
    // calendar no matter how often anyone pressed it.
    if (action === 'sync') {
      // Push first: a job that has never reached Google gets its event now, so
      // the pull that follows sees it as an existing production rather than
      // importing a duplicate.
      const backfill = await pushMissingJobsToStudioCalendar(token);
      const pushed = describeBackfill(backfill);

      const own = await getValidGoogleToken(userId);
      if (!own) {
        // The push half ran on the studio calendar and does not need this
        // user's own connection; only importing their events does.
        return NextResponse.json({
          success: true,
          message: `${pushed} Connect Google to import your own events into Slate.`.trim(),
        });
      }

      const result = await pullGoogleCalendarForUser(userId, own);
      return NextResponse.json({ success: true, message: `${pushed} ${result.message}`.trim() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Google Calendar sync route error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
