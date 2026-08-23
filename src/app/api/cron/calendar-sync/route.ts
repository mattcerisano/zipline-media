import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pullGoogleCalendarForUser, pushMissingJobsToStudioCalendar } from '@/lib/calendar-sync';
import { getStudioCalendarToken } from '@/lib/studio-calendar';

// Background calendar sync, fired by Vercel Cron (see vercel.json).
//
// Both directions, in this order:
//  1. Push productions that have never reached Google onto the studio calendar,
//     so a shoot booked by someone who isn't connected to Google still shows up
//     for the people who are. Runs once, against the one studio calendar.
//  2. Pull Google Calendar for every connected account, so the Command Center
//     calendar stays current even when nobody has the app open — a shoot added
//     straight in Google can never silently go missing.

export const maxDuration = 60;

export async function GET(request: Request) {
  // When CRON_SECRET is set in the environment, Vercel sends it as a bearer
  // token on cron invocations — require it so outsiders can't burn API quota.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // Unset means this endpoint is open: anyone can trigger a full Google
    // Calendar sync for every connected account, on repeat. No data comes back
    // to them, but it burns the studio's Google API quota and hammers the
    // database. Loud in the logs so it doesn't stay unset, matching how
    // /api/calendar flags a missing CALENDAR_FEED_TOKEN.
    console.warn(
      'CRON_SECRET is not set: /api/cron/calendar-sync can be triggered by anyone. ' +
      'Set it in the environment to restrict the endpoint to Vercel Cron.'
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: accounts, error } = await admin.from('google_tokens').select('id');
  if (error) {
    return NextResponse.json({ error: `Could not list connected accounts: ${error.message}` }, { status: 500 });
  }

  // No acting user here, so an undecided studio calendar resolves to null and
  // the push is skipped rather than guessing whose calendar to write to.
  let pushed = 0;
  let pushFailed = 0;
  try {
    const studio = await getStudioCalendarToken(null);
    if (studio.token) {
      const backfill = await pushMissingJobsToStudioCalendar(studio.token, studio.userId);
      pushed = backfill.pushed;
      pushFailed = backfill.failed;
    } else if (studio.message) {
      console.warn('Studio calendar push skipped:', studio.message);
    }
  } catch (err: any) {
    // The pull is the half that has always run; a push failure must not stop it.
    console.warn('Studio calendar push failed:', err?.message);
  }

  const results: { userId: string; ok: boolean; message: string }[] = [];
  // Sequential on purpose: connected accounts are few, and this keeps a burst
  // of Google API calls (and their token refreshes) from racing each other.
  for (const account of accounts || []) {
    try {
      const r = await pullGoogleCalendarForUser(account.id);
      results.push({ userId: account.id, ok: r.connected, message: r.message });
    } catch (err: any) {
      results.push({ userId: account.id, ok: false, message: err?.message || 'sync failed' });
    }
  }

  return NextResponse.json({ ran: results.length, pushed, pushFailed, results });
}
