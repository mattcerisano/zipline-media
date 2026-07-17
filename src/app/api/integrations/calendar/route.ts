import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
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
      return NextResponse.json({ success: true, message: `Synced ${syncCount} existing jobs. Created ${createCount} new jobs from Google Calendar.${importMsg}` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Google Calendar sync route error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
