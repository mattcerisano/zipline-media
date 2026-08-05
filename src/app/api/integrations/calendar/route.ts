import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { pullGoogleCalendarForUser, SLATE_APP_TAG, STUDIO_MARKER_TAG } from '@/lib/calendar-sync';
import { getAuthedUserId } from '@/lib/api-auth';
import { STUDIO_TIME_ZONE, parseCallTime, addDays } from '@/lib/date';
import { buildJobDescription, buildMarkerDescription } from '@/lib/event-description';

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

/** Tangerine. Productions, so they stand apart from every marker type. */
const PRODUCTION_COLOR_ID = '6';

const DEFAULT_SHOOT_HOURS = 8;

/**
 * Translate a job's stored date/time fields into a Google event's start/end.
 *
 * Call times are wall-clock strings with no zone ("8:00 AM"), so they are sent
 * as a naive dateTime plus an explicit `timeZone` and Google resolves them in
 * that zone. Building a `Date` here instead would resolve them against the
 * server clock — UTC on Vercel — which is what put an 8:00 AM call on the
 * calendar at 4:00 AM Eastern.
 */
function buildEventTiming(job: {
  shoot_date?: string | null;
  end_date?: string | null;
  call_time?: string | null;
}): { start: Record<string, string>; end: Record<string, string> } {
  const startDate = job.shoot_date || new Date().toISOString().split('T')[0];
  // An end_date at or before the start is a stale/no-op value, not a span.
  const lastDate = job.end_date && job.end_date > startDate ? job.end_date : startDate;
  const call = parseCallTime(job.call_time);

  if (!call) {
    // All-day event. Google's all-day end date is exclusive, so a single-day
    // shoot ends the following day — an end equal to the start is rejected.
    return {
      start: { date: startDate },
      end: { date: addDays(lastDate, 1) },
    };
  }

  const hhmm = `${String(call.hour).padStart(2, '0')}:${String(call.minute).padStart(2, '0')}:00`;
  const wrapHour = (call.hour + DEFAULT_SHOOT_HOURS) % 24;
  // A call late enough that the default day runs past midnight pushes the end
  // onto the next date rather than ending before it starts.
  const wrapsMidnight = call.hour + DEFAULT_SHOOT_HOURS >= 24;
  const endDate = wrapsMidnight ? addDays(lastDate, 1) : lastDate;
  const endHhmm = `${String(wrapHour).padStart(2, '0')}:${String(call.minute).padStart(2, '0')}:00`;

  return {
    start: { dateTime: `${startDate}T${hhmm}`, timeZone: STUDIO_TIME_ZONE },
    end: { dateTime: `${endDate}T${endHhmm}`, timeZone: STUDIO_TIME_ZONE },
  };
}

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

    // 1. Retrieve a valid Google Token
    const token = await getValidGoogleToken(userId);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Google account not connected.' });
    }

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

      // Crew rides along in the description, so the event doubles as a
      // pocket call sheet. Ordered the way the manifest is, and failing soft:
      // a roles lookup that errors must not block the calendar push.
      const { data: crew } = await supabaseAdmin
        .from('job_roles')
        .select('name, position, department, phone, call_time, sort_order')
        .eq('job_id', job.id)
        .order('sort_order', { ascending: true, nullsFirst: false });

      const timing = buildEventTiming(job);
      const eventBody: any = {
        summary: `🎥 ${job.title}`,
        description: buildJobDescription(job, crew || []),
        location: job.location_address || job.location_name || '',
        start: timing.start,
        end: timing.end,
        // Tangerine — productions get their own colour so a shoot is never
        // mistaken for a meeting at a glance.
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

      let response: Response;
      const googleEventId = job.google_event_id;

      if (googleEventId) {
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );

        // 404 = the event was deleted outright; 410 = it was cancelled and
        // Google is holding a tombstone. Neither can be updated in place, so
        // recreate rather than leaving the job silently unsynced.
        if (response.status === 404 || response.status === 410) {
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(eventBody),
            }
          );
        }
      } else {
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Calendar API responded with status ${response.status}: ${errText}`);
      }

      const eventData = await response.json();
      const newGoogleEventId = eventData.id;

      if (newGoogleEventId && newGoogleEventId !== job.google_event_id) {
        await supabaseAdmin
          .from('jobs')
          .update({ google_event_id: newGoogleEventId })
          .eq('id', job.id);
      }

      return NextResponse.json({ success: true, message: 'Google Calendar event synced.', googleEventId: newGoogleEventId });
    }

    // ==========================================
    // ACTION: PUSH A CALENDAR MARKER TO GOOGLE
    // ==========================================
    // Holds, meetings, and time off created on the Calendar tab. Pushed as
    // all-day events — a marker has no call time, and inventing one would put
    // it at an hour nobody chose.
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

      const lastDay = event.end_date && event.end_date > event.event_date ? event.end_date : event.event_date;
      const eventBody: any = {
        summary: event.title || 'Untitled',
        description: buildMarkerDescription({
          notes: event.notes,
          presetLabel: PRESET_LABELS[event.preset] || null,
          event_date: event.event_date,
          end_date: event.end_date,
        }),
        // Google's all-day end is exclusive, so a single day ends tomorrow.
        start: { date: event.event_date },
        end: { date: addDays(lastDay, 1) },
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
      const result = await pullGoogleCalendarForUser(userId, token);
      return NextResponse.json({ success: true, message: result.message });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Google Calendar sync route error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
