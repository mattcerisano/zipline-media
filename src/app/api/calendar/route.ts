import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as ics from 'ics';
import { Job } from '@/components/gearbuilder/types';

// Optional: you might not want to rely on the environment variables directly if this route is accessed externally,
// but for this implementation it will use the public/service keys configured in .env.local.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .neq('job_status', 'Cancelled');

    if (error) {
      throw error;
    }

    const events: ics.EventAttributes[] = (jobs as Job[]).map(job => {
      // Parse shoot date
      const shootDate = job.shoot_date ? new Date(job.shoot_date) : null;
      let year = new Date().getFullYear();
      let month = new Date().getMonth() + 1;
      let day = new Date().getDate();

      if (shootDate && !isNaN(shootDate.getTime())) {
        year = shootDate.getUTCFullYear();
        month = shootDate.getUTCMonth() + 1;
        day = shootDate.getUTCDate();
      }

      // Parse call time if available
      let hour = 8;
      let minute = 0;
      if (job.call_time) {
        const timeMatch = job.call_time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3];
          
          if (ampm && ampm.toUpperCase() === 'PM' && h < 12) {
            h += 12;
          } else if (ampm && ampm.toUpperCase() === 'AM' && h === 12) {
            h = 0;
          }
          hour = h;
          minute = m;
        }
      }

      return {
        title: `🎥 ${job.title}`,
        description: `Client: ${job.client_name || 'N/A'}\nStatus: ${job.job_status}\nNotes: ${job.notes_general || 'None'}`,
        location: job.location_address || job.location_name || undefined,
        start: [year, month, day, hour, minute],
        duration: { hours: 8, minutes: 0 }, // Default duration
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
        url: 'https://zipline.media/command-center'
      };
    });

    const { error: icsError, value } = ics.createEvents(events);

    if (icsError) {
      throw icsError;
    }

    return new NextResponse(value, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="zipline-media-slate.ics"'
      }
    });

  } catch (error) {
    console.error('ICS Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
