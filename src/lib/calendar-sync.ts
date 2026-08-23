import { createClient } from '@supabase/supabase-js';
import { getGoogleToken, describeTokenFailure } from '@/lib/google-auth';
import { pushJobEvent } from '@/lib/calendar-google';
import { SLATE_APP_TAG, STUDIO_MARKER_TAG } from '@/lib/calendar-tags';
import { formatCallTime, wallClockFromGoogleDateTime, addDays } from '@/lib/date';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Re-exported so the many existing importers of these tags keep working.
export { SLATE_APP_TAG, STUDIO_MARKER_TAG };

/** How far either side of today the sync looks. Matches the marker import window. */
const PULL_DAYS_BACK = 30;
const PULL_DAYS_FORWARD = 365;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Fetch every page of a Google Calendar event list.
 *
 * The list endpoint caps a response at `maxResults` (250 here) and hands back
 * a `nextPageToken` for the rest. Both queries used to read only the first
 * page, so a busy calendar silently lost every event past the cap — shoots
 * that simply never appeared in the app.
 */
async function listAllEvents(token: string, params: Record<string, string>): Promise<any[]> {
  const items: any[] = [];
  let pageToken: string | undefined;
  // Hard stop so a pathological calendar can't spin the cron forever.
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ ...params, maxResults: '250' });
    if (pageToken) qs.set('pageToken', pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Google Calendar list API error: ${await res.text()}`);
    }

    const data = await res.json();
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

/** The Slate job id an event points at, from its tag first and description second. */
function slateJobIdOf(event: any): string | null {
  const tagged = event?.extendedProperties?.private?.slateJobId;
  if (typeof tagged === 'string' && UUID_RE.test(tagged.trim())) return tagged.trim();

  const idMatch = (event?.description || '').match(/Slate ID:\s*([a-zA-Z0-9-]+)/);
  const fromDescription = idMatch ? idMatch[1].trim() : null;
  // Validate as a UUID before it reaches Postgres, which errors on a malformed
  // value in an `in.()` filter rather than just not matching.
  return fromDescription && UUID_RE.test(fromDescription) ? fromDescription : null;
}

/**
 * Collapse rows that would collide on the same upsert key, keeping the first.
 *
 * Postgres refuses an `ON CONFLICT DO UPDATE` whose payload touches the same
 * row twice — "command cannot affect row a second time" — so a batch may carry
 * each key only once. Two Google events reaching one Slate job is routine, not
 * exotic: `singleEvents` expands a recurring series into instances that all
 * inherit the same `slateJobId`, copying a Slate event in Google clones its
 * tag and its "Slate ID:" line, and the push route recreates an event whose
 * original was deleted. Without this the whole sync threw and *nothing* got
 * written, so one stray duplicate stalled every job.
 *
 * First wins because both event lists arrive ordered by start time: that picks
 * the earliest occurrence and keeps picking it on the next sync, rather than
 * flipping the job between instances run to run.
 */
export function dedupeByKey<T>(rows: T[], keyOf: (row: T) => string | null | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) {
      out.push(row);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** True for events Slate owns: tagged by push, or carrying the legacy 🎥 prefix. */
function isProductionEvent(event: any): boolean {
  if (event?.extendedProperties?.private?.app === SLATE_APP_TAG) return true;
  return (event?.summary || '').startsWith('🎥');
}

export interface PullResult {
  connected: boolean;
  syncCount: number;
  createCount: number;
  importCount: number;
  message: string;
}

// Record the outcome of a sync attempt on the user's google_tokens row so the
// UI can surface "last synced X ago / failing since Y". Update (not upsert):
// a user who never connected has no row and should stay that way. Fails soft
// on databases that haven't added the columns yet.
async function recordSyncStatus(userId: string, ok: boolean, error?: string) {
  try {
    await supabaseAdmin
      .from('google_tokens')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_ok: ok,
        last_sync_error: ok ? null : (error || 'Sync failed').slice(0, 500),
      })
      .eq('id', userId);
  } catch { /* status is best-effort */ }
}

/** One line for the sync toast: silent when there was nothing to push. */
export function describeBackfill(result: BackfillResult): string {
  const parts: string[] = [];
  if (result.pushed > 0) {
    parts.push(`Pushed ${result.pushed} job${result.pushed === 1 ? '' : 's'} to Google Calendar.`);
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} could not be pushed — see the logs.`);
  }
  return parts.join(' ');
}

/** Most jobs one backfill pass will push, so a first sync can't run all day. */
const PUSH_BATCH_LIMIT = 100;

/** Ceiling on the jobs a push pass will even look at, so the scan stays bounded. */
const JOB_SCAN_LIMIT = 1000;

export interface BackfillResult {
  pushed: number;
  failed: number;
}

/**
 * Push productions that have never reached Google onto the studio calendar.
 *
 * The interactive push runs in the browser of whoever saved the job, so a shoot
 * booked while that person had no Google connection — or before the studio
 * calendar was designated — simply never left Slate. Nothing retried it: the
 * sync was pull-only, so those dates stayed invisible on every calendar.
 *
 * A job is a candidate when it has no `google_event_id` at all, or when the id
 * it has isn't on this calendar — the case for a shoot pushed to someone's
 * personal calendar before the studio one was chosen. Both are safe to repeat:
 * a job that already has an id is updated in place rather than duplicated, and
 * one that doesn't gets an id the first time it succeeds and is skipped after.
 * Edits keep pushing on save, so this is a backstop, not the main road.
 * Failures are counted rather than thrown — one job Google refuses must not
 * strand the rest, and the next sync tries again.
 */
export async function pushMissingJobsToStudioCalendar(
  token: string,
  calendarUserId?: string | null
): Promise<BackfillResult> {
  // Same window the pull uses. Pushing years of wrapped shoots onto the
  // calendar would bury the work that is actually coming up.
  const since = new Date(Date.now() - PULL_DAYS_BACK * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const until = new Date(Date.now() + PULL_DAYS_FORWARD * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .neq('job_status', 'Cancelled')
    .gte('shoot_date', since)
    .lte('shoot_date', until)
    .order('shoot_date', { ascending: true })
    .limit(JOB_SCAN_LIMIT);

  if (error) {
    console.warn('Could not list jobs for the studio calendar push:', error.message);
    return { pushed: 0, failed: 0 };
  }
  if (!jobs?.length) return { pushed: 0, failed: 0 };

  // A job carrying a google_event_id is not necessarily *on this* calendar: it
  // may point at an event in the personal calendar it was pushed to before the
  // studio calendar was designated. Ask Google which Slate events this calendar
  // actually holds, so those jobs get republished here instead of being skipped
  // forever for having an id.
  let onStudioCalendar: Set<string> | null = null;
  try {
    // No `singleEvents` here, deliberately: expanding a series would return
    // per-instance ids (`<id>_20260824T130000Z`) that never match the master id
    // stored on the job, and every sync would "helpfully" push it again.
    const existing = await listAllEvents(token, {
      privateExtendedProperty: `app=${SLATE_APP_TAG}`,
      timeMin: new Date(Date.now() - PULL_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + PULL_DAYS_FORWARD * 24 * 60 * 60 * 1000).toISOString(),
    });
    onStudioCalendar = new Set(
      existing.filter(e => e?.id && e.status !== 'cancelled').map(e => e.id as string)
    );
  } catch (err: any) {
    // Without the listing, fall back to the conservative rule — only jobs that
    // have never reached any calendar. Re-pushing everything on a transient
    // Google error would duplicate the studio's whole board.
    console.warn('Could not list existing Slate events; pushing only unsynced jobs:', err?.message);
  }

  const needsPush = jobs.filter(job => {
    if (!job.google_event_id) return true;
    return onStudioCalendar ? !onStudioCalendar.has(job.google_event_id) : false;
  });

  let pushed = 0;
  let failed = 0;
  // Sequential on purpose: a burst of parallel writes trips Google's per-user
  // rate limit, and a backfill has no deadline worth risking that for.
  for (const job of needsPush.slice(0, PUSH_BATCH_LIMIT)) {
    try {
      await pushJobEvent(token, job, calendarUserId);
      pushed++;
    } catch (err: any) {
      failed++;
      console.warn(`Could not push job ${job.id} to Google:`, err?.message);
    }
  }

  return { pushed, failed };
}

/**
 * Pull the user's Google Calendar into the app: 🎥-tagged events sync as jobs
 * (two-way with Slate), everything else imports as read-mostly calendar
 * markers. Shared by the user-triggered sync route and the background cron so
 * both paths behave identically. Safe to run repeatedly — job matching and
 * marker upserts are idempotent.
 */
export async function pullGoogleCalendarForUser(userId: string, existingToken?: string): Promise<PullResult> {
  let token = existingToken || null;
  if (!token) {
    const result = await getGoogleToken(userId);
    token = result.token;
    if (!token) {
      // A user with a google_tokens row but no valid token has a broken
      // connection — record *which* kind, so the chip can distinguish a
      // revoked grant (reconnect) from a server misconfiguration (don't
      // bother). Users who never connected have no row; the update is a no-op.
      const failure = result.failure || 'refresh_failed';
      const message = describeTokenFailure(failure, result.detail);
      if (result.detail) {
        console.error(`Google token unavailable for ${userId} (${failure}):`, result.detail);
      }
      await recordSyncStatus(userId, false, message);
      return { connected: false, syncCount: 0, createCount: 0, importCount: 0, message };
    }
  }

  try {
    const result = await runPull(userId, token);
    await recordSyncStatus(userId, true);
    return result;
  } catch (err: any) {
    await recordSyncStatus(userId, false, err?.message);
    throw err;
  }
}

async function runPull(userId: string, token: string): Promise<PullResult> {
  const timeMin = new Date(Date.now() - PULL_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + PULL_DAYS_FORWARD * 24 * 60 * 60 * 1000).toISOString();

  // Two queries, merged by event id:
  //  - the 🎥 text search, which still catches shoots typed straight into
  //    Google by hand, and
  //  - an exact lookup of events Slate itself pushed, which no longer depends
  //    on the emoji surviving in the title.
  // `singleEvents` expands recurring series into dated instances; without it
  // Google returns the recurring master, which has no concrete shoot date.
  const shared = { singleEvents: 'true', orderBy: 'startTime', timeMin, timeMax };
  const [tagged, bySearch] = await Promise.all([
    listAllEvents(token, { ...shared, privateExtendedProperty: `app=${SLATE_APP_TAG}` }),
    listAllEvents(token, { ...shared, q: '🎥' }),
  ]);

  const byId = new Map<string, any>();
  for (const event of [...tagged, ...bySearch]) {
    if (event?.id && event.status !== 'cancelled') byId.set(event.id, event);
  }
  const events = Array.from(byId.values());

  const slateIds: string[] = [];
  const googleEventIds: string[] = [];

  for (const event of events) {
    const slateId = slateJobIdOf(event);
    if (slateId) slateIds.push(slateId);
    if (event.id) googleEventIds.push(event.id);
  }

  // Bulk fetch existing jobs to match locally in memory
  const existingJobsMap = new Map<string, any>();
  const existingJobsByGoogleIdMap = new Map<string, any>();

  if (slateIds.length > 0 || googleEventIds.length > 0) {
    const queryParts: string[] = [];
    if (slateIds.length > 0) {
      queryParts.push(`id.in.(${Array.from(new Set(slateIds)).join(',')})`);
    }
    if (googleEventIds.length > 0) {
      queryParts.push(`google_event_id.in.(${Array.from(new Set(googleEventIds)).join(',')})`);
    }

    const { data: dbJobs, error: dbJobsErr } = await supabaseAdmin
      .from('jobs')
      .select('id, google_event_id')
      .or(queryParts.join(','));

    if (dbJobsErr) {
      throw new Error(`Failed to query existing jobs: ${dbJobsErr.message}`);
    }

    if (dbJobs) {
      for (const job of dbJobs) {
        existingJobsMap.set(job.id, job);
        if (job.google_event_id) {
          existingJobsByGoogleIdMap.set(job.google_event_id, job);
        }
      }
    }
  }

  const jobsToUpdate: any[] = [];
  const jobsToInsert: any[] = [];

  for (const event of events) {
    const summary = event.summary || '';
    const description = event.description || '';

    const slateId = slateJobIdOf(event);

    // The wall clock is read straight out of Google's dateTime string, which
    // already carries the event's own local time. Routing it through `new
    // Date(...).getHours()` re-rendered it in the server's zone — UTC on
    // Vercel — so an 8:00 AM Eastern call came back as "12:00 PM".
    const wall = wallClockFromGoogleDateTime(event.start?.dateTime);
    const shootDate: string | null = event.start?.date || wall?.date || null;
    const callTime: string | null = wall ? formatCallTime(wall) : null;

    // Multi-day shoots: Google's all-day end is exclusive, so step back a day
    // to get the last date actually worked. Timed events end on the same date
    // unless they genuinely run across midnight.
    let endDate: string | null = null;
    if (event.end?.date) {
      const inclusive = addDays(event.end.date, -1);
      if (shootDate && inclusive > shootDate) endDate = inclusive;
    } else if (event.end?.dateTime) {
      const endWall = wallClockFromGoogleDateTime(event.end.dateTime);
      if (endWall && shootDate && endWall.date > shootDate) endDate = endWall.date;
    }

    const title = summary.replace(/^🎥\s*/, '');

    if (slateId && existingJobsMap.has(slateId)) {
      const updateFields: any = {
        id: slateId,
        title,
        google_event_id: event.id
      };
      if (shootDate) updateFields.shoot_date = shootDate;
      if (callTime) updateFields.call_time = callTime;
      // Explicit null clears a span that was shortened back to one day.
      updateFields.end_date = endDate;

      jobsToUpdate.push(updateFields);
    } else if (isProductionEvent(event)) {
      // Check if we already created a job for this google event to prevent duplicates
      const hasExisting = existingJobsByGoogleIdMap.has(event.id);

      if (!hasExisting) {
        const insertFields: any = {
          title,
          google_event_id: event.id,
          // 'Scheduled' is not one of the app's statuses (Planning / Hold /
          // Booked / Wrapped / Cancelled), so imported shoots landed outside
          // every status filter and rendered with the fallback grey dot.
          job_status: 'Planning',
          shoot_date: shootDate || new Date().toISOString().split('T')[0],
          end_date: endDate,
          // All-day events carry no call time; leave it unset rather than
          // inventing an 8:00 AM call the producer never entered.
          call_time: callTime,
          // Edit Tracker is opt-in — explicit null beats the legacy
          // DEFAULT 'Filmed' on databases that haven't run the migration.
          edit_status: null,
        };

        const clientMatch = description.match(/Client:\s*(.+)/);
        if (clientMatch) {
          insertFields.client_name = clientMatch[1].trim();
        }

        jobsToInsert.push(insertFields);
      }
    }
  }

  // One row per job id, one per Google event: see dedupeByKey. Counting the
  // deduped arrays keeps the "Synced N jobs" message honest about rows written
  // rather than events seen.
  const updates = dedupeByKey(jobsToUpdate, row => row.id);
  const inserts = dedupeByKey(jobsToInsert, row => row.google_event_id);
  const syncCount = updates.length;
  const createCount = inserts.length;

  // Execute bulk updates
  if (updates.length > 0) {
    const { error: bulkUpdateErr } = await supabaseAdmin
      .from('jobs')
      .upsert(updates, { onConflict: 'id' });

    if (bulkUpdateErr) {
      throw new Error(`Bulk update failed: ${bulkUpdateErr.message}`);
    }
  }

  // Execute bulk inserts
  if (inserts.length > 0) {
    const { error: bulkInsertErr } = await supabaseAdmin
      .from('jobs')
      .insert(inserts);

    if (bulkInsertErr) {
      throw new Error(`Bulk insert failed: ${bulkInsertErr.message}`);
    }
  }

  // Also import the connected account's regular events (meetings, holds,
  // anything without the 🎥 job marker) as read-mostly calendar markers so
  // the team calendar actually shows up in Command Center. Idempotent via
  // google_event_id upsert; fails soft on deployments missing the column.
  let importCount = 0;
  try {
    // showDeleted lets cancelled events flow through so their markers can be
    // cleaned up here instead of lingering forever.
    const allEvents = await listAllEvents(token, {
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'true',
      timeMin,
      timeMax,
    });

    const markers: any[] = [];
    const cancelledIds: string[] = [];

    for (const event of allEvents) {
      const summary: string = event.summary || '';
      if (!event.id) continue;
      // Deleted on Google's side → Google is authoritative; drop the
      // marker (tombstoned or not).
      if (event.status === 'cancelled') {
        cancelledIds.push(event.id);
        continue;
      }
      // Productions sync as jobs above, not markers.
      if (isProductionEvent(event)) continue;
      // Pushed from the Calendar tab — the local row already exists and owns
      // the title and preset. Importing it back would duplicate the marker and
      // relabel it 'google'.
      if (event.extendedProperties?.private?.app === STUDIO_MARKER_TAG) continue;

      const startWall = wallClockFromGoogleDateTime(event.start?.dateTime);
      const startDate: string | null = event.start?.date || startWall?.date || null;
      if (!startDate) continue;

      // Google all-day end dates are exclusive; walk back one day so a
      // single-day event doesn't paint two calendar cells.
      let endDate: string | null = null;
      const endWall = event.end?.dateTime ? wallClockFromGoogleDateTime(event.end.dateTime) : null;
      if (event.end?.date) {
        const inclusive = addDays(event.end.date, -1);
        if (inclusive > startDate) endDate = inclusive;
      } else if (endWall?.date && endWall.date > startDate) {
        endDate = endWall.date;
      }

      markers.push({
        title: summary || '(No title)',
        preset: 'google',
        event_date: startDate,
        end_date: endDate,
        // A timed Google event kept only its dates here, so a 2:00 PM meeting
        // imported as an all-day block. The wall clock is taken verbatim from
        // Google's own offset — see wallClockFromGoogleDateTime.
        start_time: startWall ? formatCallTime(startWall) : null,
        end_time: endWall ? formatCallTime(endWall) : null,
        google_event_id: event.id,
      });
    }

    // Same ON CONFLICT rule as the job upsert above: one row per event id.
    const uniqueMarkers = dedupeByKey(markers, m => m.google_event_id);

    if (uniqueMarkers.length > 0) {
      let { error: markerErr } = await supabaseAdmin
        .from('calendar_events')
        .upsert(uniqueMarkers, { onConflict: 'google_event_id' });

      // A database without the marker-times columns rejects the batch whole.
      // Importing the events without their hours beats importing nothing.
      if (markerErr && /start_time|end_time|schema cache/i.test(markerErr.message || '')) {
        const untimed = uniqueMarkers.map(m => {
          const rest = { ...m };
          delete rest.start_time;
          delete rest.end_time;
          return rest;
        });
        ({ error: markerErr } = await supabaseAdmin
          .from('calendar_events')
          .upsert(untimed, { onConflict: 'google_event_id' }));
      }

      if (markerErr) {
        console.warn('Google event import skipped:', markerErr.message);
      } else {
        importCount = uniqueMarkers.length;
      }
    }

    if (cancelledIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('calendar_events')
        .delete()
        .in('google_event_id', cancelledIds);
      if (delErr) console.warn('Cancelled-event cleanup skipped:', delErr.message);

      // A marker Slate pushed here has its id in the links table, not the
      // column above, so deleting this copy in Google leaves the marker (and
      // everyone else's copy) alone — which is the point of mirroring. Drop the
      // dead link so the next edit republishes rather than PUTting a tombstone.
      const { error: linkErr } = await supabaseAdmin
        .from('calendar_event_google_links')
        .delete()
        .eq('user_id', userId)
        .in('google_event_id', cancelledIds);
      if (linkErr) console.warn('Marker link cleanup skipped:', linkErr.message);
    }
  } catch (importErr: any) {
    // Import is additive — a failure here must not break the job sync.
    console.warn('Google event import failed:', importErr?.message);
  }

  const importMsg = importCount > 0 ? ` Imported ${importCount} Google Calendar events.` : '';
  return {
    connected: true,
    syncCount,
    createCount,
    importCount,
    message: `Synced ${syncCount} existing jobs. Created ${createCount} new jobs from Google Calendar.${importMsg}`,
  };
}
