import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { pullGoogleCalendarForUser } from '@/lib/calendar-sync';
import { getAuthedUserId } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

      const shootDateStr = job.shoot_date;
      const eventBody: any = {
        summary: `🎥 ${job.title}`,
        description: `Client: ${job.client_name || 'N/A'}\nSlate ID: ${job.id}\nNotes: ${job.notes_general || 'None'}`,
        location: job.location_address || job.location_name || '',
      };

      if (shootDateStr) {
        if (job.call_time) {
          const timeMatch = job.call_time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          let hour = 8;
          let minute = 0;
          if (timeMatch) {
            let h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const ampm = timeMatch[3];
            if (ampm && ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            else if (ampm && ampm.toUpperCase() === 'AM' && h === 12) h = 0;
            hour = h;
            minute = m;
          }
          
          // Construct start time locally then convert to ISO format
          const startDateTime = new Date(`${shootDateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
          const endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours default
          
          eventBody.start = { dateTime: startDateTime.toISOString() };
          eventBody.end = { dateTime: endDateTime.toISOString() };
        } else {
          // All day event: End date must be exclusive (+1 day)
          const startDate = new Date(shootDateStr);
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          eventBody.start = { date: shootDateStr };
          eventBody.end = { date: endDate.toISOString().split('T')[0] };
        }
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        eventBody.start = { date: todayStr };
        eventBody.end = { date: todayStr };
      }

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

        if (response.status === 404) {
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
