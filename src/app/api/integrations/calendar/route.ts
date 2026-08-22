import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { pullGoogleCalendarForUser, pushMissingJobsToStudioCalendar, describeBackfill } from '@/lib/calendar-sync';
import { pushJobEvent, deleteEventFrom, reapOrphanedEvent } from '@/lib/calendar-google';
import { pushMarkerToAllCalendars, removeMarkerFromAllCalendars } from '@/lib/marker-sync';
import { getStudioCalendarToken } from '@/lib/studio-calendar';
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
    //
    // Markers are the exception on the write side: they mirror onto every
    // connected calendar and resolve their own tokens per account, so they need
    // no studio token and must not be blocked when the studio one is broken.
    const writes = action === 'push' || action === 'delete' || action === 'sync';
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
      const googleEventId = await pushJobEvent(token, job, studio?.userId ?? null);

      return NextResponse.json({ success: true, message: 'Google Calendar event synced.', googleEventId });
    }

    // ==========================================
    // ACTION: PUSH A CALENDAR MARKER TO GOOGLE
    // ==========================================
    // Holds, meetings, and time off created on the Calendar tab. Unlike a
    // production, a marker is mirrored onto *every* connected calendar rather
    // than the one studio calendar: it says something about a person's week, so
    // it belongs on their own calendar, while still needing to be visible to
    // the rest of the team. See src/lib/marker-sync.ts.
    if (action === 'push_event') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }

      const result = await pushMarkerToAllCalendars(eventId);

      if (result.noAccounts) {
        return NextResponse.json({ success: false, message: 'Google account not connected.' });
      }
      if (result.synced === 0 && result.failed > 0) {
        return NextResponse.json({ success: false, message: 'Google Calendar sync failed.' });
      }

      const partial = result.failed > 0 ? ` ${result.failed} calendar${result.failed === 1 ? '' : 's'} could not be updated.` : '';
      return NextResponse.json({
        success: true,
        message: `Event synced to ${result.synced} Google calendar${result.synced === 1 ? '' : 's'}.${partial}`,
      });
    }

    // ==========================================
    // ACTION: REMOVE A MARKER FROM GOOGLE
    // ==========================================
    // Takes the Slate event id, not a Google one: a mirrored marker has a
    // different id on every calendar, and all of them have to go.
    if (action === 'delete_event') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ success: true, message: 'No event to remove.' });
      }

      await removeMarkerFromAllCalendars(eventId);
      return NextResponse.json({ success: true, message: 'Google Calendar event removed.' });
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

      const removed = await deleteEventFrom(token, googleEventId);

      // Not on the studio calendar means it is on whichever personal calendar
      // the job was pushed to before the studio one was designated. Sweep for
      // it rather than leaving the shoot on that one person's calendar forever.
      if (!removed) {
        await reapOrphanedEvent(googleEventId, null, studio?.userId ?? null);
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
      const backfill = await pushMissingJobsToStudioCalendar(token, studio?.userId ?? null);
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
