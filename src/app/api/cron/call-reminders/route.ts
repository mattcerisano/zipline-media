import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPushConfigured, sendToSubscriptions, type PushSubscriptionRow } from '@/lib/push';
import { parseCallTime, wallTimeToUtc } from '@/lib/call-time';

// Call-time reminder pushes, fired by Vercel Cron (see vercel.json). Every run
// looks at today's and tomorrow's shoots, works out each recipient's call time
// (their job_roles row wins over the job-level call time), and pushes a
// reminder once their lead window opens. The push_sent_log unique key makes
// each (job, user, day) reminder fire exactly once no matter how often the
// cron runs.
//
// Who gets reminded:
//   * crew on the job — job_roles rows whose email (or linked contact's email)
//     matches a registered push device;
//   * everyone with push enabled when the job has no crew list at all — the
//     common solo-operator case where nobody files themselves under crew.

export const maxDuration = 60;

const DEFAULT_LEAD_MINUTES = 60;
const MIN_LEAD_MINUTES = 5;
const MAX_LEAD_MINUTES = 12 * 60;

interface JobRow {
  id: string;
  title: string;
  shoot_date: string;
  call_time: string | null;
  location_name: string | null;
}

interface RoleRow {
  job_id: string;
  call_time: string | null;
  email: string | null;
  contact: { email: string | null } | null;
}

interface PrefRow {
  user_id: string;
  call_reminders: boolean;
  call_reminder_lead_minutes: number | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' });
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: org } = await admin
    .from('organizations')
    .select('id, timezone')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const timeZone = org?.timezone || 'America/New_York';

  // Today + tomorrow in the org's zone. Tomorrow is included because a long
  // lead time (up to 12h) can open the window the evening before an early call.
  const now = new Date();
  let dayFmt: Intl.DateTimeFormat;
  try {
    dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return NextResponse.json({ error: `Invalid org timezone "${timeZone}"` }, { status: 500 });
  }
  const days = [dayFmt.format(now), dayFmt.format(new Date(now.getTime() + 24 * 60 * 60 * 1000))];

  const { data: jobs, error: jobsError } = await admin
    .from('jobs')
    .select('id, title, shoot_date, call_time, location_name, job_status')
    .in('shoot_date', days)
    // NULL-safe: plain .neq() would also drop jobs with no status at all.
    .or('job_status.is.null,job_status.neq.Cancelled');
  if (jobsError) {
    return NextResponse.json({ error: `Could not load jobs: ${jobsError.message}` }, { status: 500 });
  }
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('id, user_id, user_email, endpoint, p256dh, auth');
  const subs = (allSubs as PushSubscriptionRow[]) || [];
  if (subs.length === 0) {
    return NextResponse.json({ checked: jobs.length, sent: 0, reason: 'no push devices registered' });
  }

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  const usersByEmail = new Map<string, string>();
  for (const s of subs) {
    const list = subsByUser.get(s.user_id) || [];
    list.push(s);
    subsByUser.set(s.user_id, list);
    if (s.user_email) usersByEmail.set(s.user_email.toLowerCase(), s.user_id);
  }

  const { data: prefRows } = await admin
    .from('push_prefs')
    .select('user_id, call_reminders, call_reminder_lead_minutes');
  const prefs = new Map<string, PrefRow>();
  for (const p of (prefRows as PrefRow[]) || []) prefs.set(p.user_id, p);

  const { data: roleRows } = await admin
    .from('job_roles')
    .select('job_id, call_time, email, contact:contacts(email)')
    .in('job_id', jobs.map((j) => j.id));
  const rolesByJob = new Map<string, RoleRow[]>();
  for (const r of (roleRows as unknown as RoleRow[]) || []) {
    const list = rolesByJob.get(r.job_id) || [];
    list.push(r);
    rolesByJob.set(r.job_id, list);
  }

  let sent = 0;
  let pruned = 0;

  for (const job of jobs as JobRow[]) {
    const roles = rolesByJob.get(job.id) || [];

    // recipient user id -> the call-time text that applies to them
    const recipients = new Map<string, string | null>();
    if (roles.length > 0) {
      for (const role of roles) {
        const email = (role.email || role.contact?.email || '').toLowerCase();
        const userId = email ? usersByEmail.get(email) : undefined;
        if (userId) recipients.set(userId, role.call_time || job.call_time);
      }
    } else {
      for (const userId of subsByUser.keys()) recipients.set(userId, job.call_time);
    }

    for (const [userId, callText] of recipients) {
      const pref = prefs.get(userId);
      if (pref && pref.call_reminders === false) continue;
      const lead = Math.min(
        MAX_LEAD_MINUTES,
        Math.max(MIN_LEAD_MINUTES, pref?.call_reminder_lead_minutes || DEFAULT_LEAD_MINUTES)
      );

      const parsed = parseCallTime(callText);
      if (!parsed) continue; // no call time set, or free text like "TBD"
      const callAt = wallTimeToUtc(job.shoot_date, parsed.hours, parsed.minutes, timeZone);
      if (!callAt) continue;

      const msLeft = callAt.getTime() - now.getTime();
      if (msLeft <= 0 || msLeft > lead * 60 * 1000) continue;

      // Claim the dedupe key before sending; a unique violation means an
      // earlier run (or a parallel one) already owns this reminder.
      const { error: claimError } = await admin
        .from('push_sent_log')
        .insert({ dedupe_key: `call:${job.id}:${userId}:${job.shoot_date}` });
      if (claimError) {
        // 23505 = already sent by an earlier run; anything else is a real problem.
        if (claimError.code !== '23505') console.error('Reminder dedupe claim failed:', claimError.message);
        continue;
      }

      const minutesLeft = Math.round(msLeft / 60000);
      const where = job.location_name ? ` · ${job.location_name}` : '';
      const result = await sendToSubscriptions(
        admin,
        subsByUser.get(userId) || [],
        {
          title: `🎬 Call ${(callText || '').trim() || 'time'} — ${job.title}`,
          body: `Call in about ${minutesLeft} min${where}`,
          url: '/command-center',
          tag: `call-${job.id}`,
        },
        // A reminder is pointless after call time has passed.
        { ttl: Math.max(600, Math.floor(msLeft / 1000)), urgency: 'high' }
      );
      sent += result.sent;
      pruned += result.pruned;
    }
  }

  // Keep the ledger from growing forever; two weeks covers any re-run window.
  await admin
    .from('push_sent_log')
    .delete()
    .lt('sent_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({ checked: jobs.length, sent, pruned, timeZone, days });
}
