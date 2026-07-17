import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface PullResult {
  connected: boolean;
  syncCount: number;
  createCount: number;
  importCount: number;
  message: string;
}

/**
 * Pull the user's Google Calendar into the app: 🎥-tagged events sync as jobs
 * (two-way with Slate), everything else imports as read-mostly calendar
 * markers. Shared by the user-triggered sync route and the background cron so
 * both paths behave identically. Safe to run repeatedly — job matching and
 * marker upserts are idempotent.
 */
export async function pullGoogleCalendarForUser(userId: string, existingToken?: string): Promise<PullResult> {
  const token = existingToken || (await getValidGoogleToken(userId));
  if (!token) {
    return { connected: false, syncCount: 0, createCount: 0, importCount: 0, message: 'Google account not connected.' };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=🎥`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Calendar list API error: ${errText}`);
  }

  const data = await res.json();
  const events = data.items || [];
  const slateIds: string[] = [];
  const googleEventIds: string[] = [];

  for (const event of events) {
    const description = event.description || '';
    const idMatch = description.match(/Slate ID:\s*([a-zA-Z0-9-]+)/);
    const slateId = idMatch ? idMatch[1].trim() : null;

    // Validate slateId format as valid UUID to prevent Postgres crashes
    if (slateId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slateId)) {
      slateIds.push(slateId);
    }
    if (event.id) {
      googleEventIds.push(event.id);
    }
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
  let syncCount = 0;
  let createCount = 0;

  for (const event of events) {
    const summary = event.summary || '';
    const description = event.description || '';

    // Extract Slate ID from description
    const idMatch = description.match(/Slate ID:\s*([a-zA-Z0-9-]+)/);
    const slateId = idMatch ? idMatch[1].trim() : null;
    const isValidSlateId = slateId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slateId);

    // Parse date
    let shootDate: string | null = null;
    if (event.start?.date) {
      shootDate = event.start.date;
    } else if (event.start?.dateTime) {
      shootDate = event.start.dateTime.split('T')[0];
    }

    // Parse call time
    let callTime: string | null = null;
    if (event.start?.dateTime) {
      const dateObj = new Date(event.start.dateTime);
      let hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      callTime = `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    const title = summary.replace(/^🎥\s*/, '');

    if (isValidSlateId && existingJobsMap.has(slateId)) {
      const updateFields: any = {
        id: slateId,
        title,
        google_event_id: event.id
      };
      if (shootDate) updateFields.shoot_date = shootDate;
      if (callTime) updateFields.call_time = callTime;

      jobsToUpdate.push(updateFields);
      syncCount++;
    } else if (summary.startsWith('🎥')) {
      // Check if we already created a job for this google event to prevent duplicates
      const hasExisting = existingJobsByGoogleIdMap.has(event.id);

      if (!hasExisting) {
        const insertFields: any = {
          title,
          google_event_id: event.id,
          job_status: 'Scheduled',
          shoot_date: shootDate || new Date().toISOString().split('T')[0],
          call_time: callTime || '08:00 AM',
          // Edit Tracker is opt-in — explicit null beats the legacy
          // DEFAULT 'Filmed' on databases that haven't run the migration.
          edit_status: null,
        };

        const clientMatch = description.match(/Client:\s*(.+)/);
        if (clientMatch) {
          insertFields.client_name = clientMatch[1].trim();
        }

        jobsToInsert.push(insertFields);
        createCount++;
      }
    }
  }

  // Execute bulk updates
  if (jobsToUpdate.length > 0) {
    const { error: bulkUpdateErr } = await supabaseAdmin
      .from('jobs')
      .upsert(jobsToUpdate, { onConflict: 'id' });

    if (bulkUpdateErr) {
      throw new Error(`Bulk update failed: ${bulkUpdateErr.message}`);
    }
  }

  // Execute bulk inserts
  if (jobsToInsert.length > 0) {
    const { error: bulkInsertErr } = await supabaseAdmin
      .from('jobs')
      .insert(jobsToInsert);

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
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    const evRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250` +
        `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (evRes.ok) {
      const evData = await evRes.json();
      const markers: any[] = [];

      for (const event of evData.items || []) {
        const summary: string = event.summary || '';
        // 🎥 events are productions — they sync as jobs above, not markers.
        if (summary.startsWith('🎥') || !event.id) continue;
        if (event.status === 'cancelled') continue;

        const startDate: string | null =
          event.start?.date || event.start?.dateTime?.split('T')[0] || null;
        if (!startDate) continue;

        // Google all-day end dates are exclusive; walk back one day so a
        // single-day event doesn't paint two calendar cells.
        let endDate: string | null = null;
        if (event.end?.date) {
          const d = new Date(`${event.end.date}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          const inclusive = d.toISOString().split('T')[0];
          if (inclusive > startDate) endDate = inclusive;
        } else if (event.end?.dateTime) {
          const inclusive = event.end.dateTime.split('T')[0];
          if (inclusive > startDate) endDate = inclusive;
        }

        markers.push({
          title: summary || '(No title)',
          preset: 'google',
          event_date: startDate,
          end_date: endDate,
          google_event_id: event.id,
        });
      }

      if (markers.length > 0) {
        const { error: markerErr } = await supabaseAdmin
          .from('calendar_events')
          .upsert(markers, { onConflict: 'google_event_id' });
        if (markerErr) {
          console.warn('Google event import skipped:', markerErr.message);
        } else {
          importCount = markers.length;
        }
      }
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
