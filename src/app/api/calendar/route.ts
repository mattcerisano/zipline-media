import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as ics from 'ics';
import { Job } from '@/components/gearbuilder/types';
import { STUDIO_TIME_ZONE, parseCallTime, zonedWallClockToDate, parseLocalDate, addDays } from '@/lib/date';

// Subscribable ICS feed of the studio's productions — the "share your calendar"
// half of Slate. Any calendar app can subscribe to this URL and see shoots
// appear as they're booked.
//
// The feed is fetched by calendar servers (Google, Apple), which send no
// session cookie or bearer token, so it can't use the normal auth path. It's
// protected by a shared secret in the query string instead: set
// CALENDAR_FEED_TOKEN and the URL becomes a capability only people you give it
// to can use. See /api/calendar/feed-url, which hands the signed-in app the
// full URL to copy.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_SHOOT_HOURS = 8;

/** Constant-time-ish comparison so the token can't be probed a byte at a time. */
function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: Request) {
  try {
    const expectedToken = process.env.CALENDAR_FEED_TOKEN;
    if (expectedToken) {
      const provided = new URL(request.url).searchParams.get('token') || '';
      if (!tokensMatch(provided, expectedToken)) {
        return new NextResponse('Not found', { status: 404 });
      }
    } else {
      // Unconfigured means the feed is world-readable — every job title,
      // client name, and note. Loud in the logs so it doesn't stay that way.
      console.warn(
        'CALENDAR_FEED_TOKEN is not set: /api/calendar is publicly readable. ' +
        'Set it in the environment to lock the feed to a secret URL.'
      );
    }

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .neq('job_status', 'Cancelled');

    if (error) {
      throw error;
    }

    const events: ics.EventAttributes[] = [];

    for (const job of (jobs as Job[]) || []) {
      const shootDate = job.shoot_date;
      if (!shootDate || !parseLocalDate(shootDate)) continue;

      const call = parseCallTime(job.call_time);
      // Multi-day shoots run through to the end date; an end at or before the
      // start is a stale value, not a span.
      const lastDate = job.end_date && job.end_date > shootDate ? job.end_date : shootDate;

      const common = {
        title: `🎥 ${job.title}`,
        description: `Client: ${job.client_name || 'N/A'}\nStatus: ${job.job_status}\nNotes: ${job.notes_general || 'None'}`,
        location: job.location_address || job.location_name || undefined,
        status: 'CONFIRMED' as const,
        busyStatus: 'BUSY' as const,
        url: 'https://zipline.media/command-center',
      };

      if (!call) {
        // No call time: an all-day entry, so subscribers don't get a shoot
        // pinned to an hour nobody chose.
        const [sy, sm, sd] = shootDate.split('-').map(Number);
        // All-day ends are exclusive. addDays rolls month/year boundaries so a
        // shoot on the 31st doesn't produce a "day 32".
        const [ey, em, ed] = addDays(lastDate, 1).split('-').map(Number);
        events.push({
          ...common,
          start: [sy, sm, sd],
          startInputType: 'local',
          startOutputType: 'local',
          end: [ey, em, ed],
          endInputType: 'local',
          endOutputType: 'local',
        });
        continue;
      }

      // Call times are wall-clock in the studio's zone. Resolving them against
      // the server clock — UTC on Vercel — is what shifted an 8:00 AM call to
      // 4:00 AM for anyone subscribed from Eastern time.
      const start = zonedWallClockToDate(shootDate, call, STUDIO_TIME_ZONE);
      const end = zonedWallClockToDate(lastDate, call, STUDIO_TIME_ZONE);
      if (!start || !end) continue;
      const endInstant = new Date(end.getTime() + DEFAULT_SHOOT_HOURS * 60 * 60 * 1000);

      // Emitted as UTC so every subscriber, in any timezone, sees the same
      // moment rendered in their own local time.
      const toUtcParts = (d: Date): [number, number, number, number, number] => [
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
      ];

      events.push({
        ...common,
        start: toUtcParts(start),
        startInputType: 'utc',
        end: toUtcParts(endInstant),
        endInputType: 'utc',
      });
    }

    const { error: icsError, value } = ics.createEvents(events);

    if (icsError) {
      throw icsError;
    }

    return new NextResponse(value, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="zipline-media-slate.ics"',
        // Calendar clients poll this on their own schedule; a short cache keeps
        // a busy subscriber list from hammering the database.
        'Cache-Control': 'public, max-age=300',
      }
    });

  } catch (error) {
    console.error('ICS Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
