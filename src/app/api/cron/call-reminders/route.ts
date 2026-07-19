import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPushConfigured, sendToSubscriptions, type PushSubscriptionRow } from '@/lib/push';
import { parseCallTime, wallTimeToUtc } from '@/lib/call-time';
import { renderTemplate, dispatchToChannel, type TeamChannel } from '@/lib/team-notify';

// Call-time reminders, fired by Vercel Cron (see vercel.json). Every run looks
// at productions shooting today or tomorrow — including later days of
// multi-day shoots (shoot_date..end_date) — works out each recipient's call
// time (their job_roles row wins over the job-level call time), and pushes a
// reminder once their lead window opens. The push_sent_log unique key makes
// each (job, user, shoot day) reminder fire exactly once no matter how often
// the cron runs.
//
// Who gets a personal push:
//   * crew on the job — job_roles rows whose email (or linked contact's email)
//     matches a registered push device;
//   * everyone with push enabled when the job has no crew list at all — the
//     common solo-operator case where nobody files themselves under crew.
//
// If the 'call_reminder' team-notification event is enabled (Integrations →
// Team Notifications), the job-level call time is also announced once per
// job/day in every enabled Discord/Slack/Teams channel, one hour before call —
// so crew without push devices still get the heads-up.

export const maxDuration = 60;

const DEFAULT_LEAD_MINUTES = 60;
const MIN_LEAD_MINUTES = 5;
const MAX_LEAD_MINUTES = 12 * 60;
const CHANNEL_LEAD_MINUTES = 60;

interface JobRow {
  id: string;
  title: string;
  client_name: string | null;
  shoot_date: string;
  end_date: string | null;
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

  // A job is in scope when [shoot_date, end_date||shoot_date] touches
  // today/tomorrow — the .or() covers single-day jobs (no end_date) and the
  // later days of multi-day shoots.
  const { data: jobs, error: jobsError } = await admin
    .from('jobs')
    .select('id, title, client_name, shoot_date, end_date, call_time, location_name, job_status')
    .lte('shoot_date', days[1])
    .or(`end_date.gte.${days[0]},shoot_date.gte.${days[0]}`)
    // NULL-safe: plain .neq() would also drop jobs with no status at all.
    .or('job_status.is.null,job_status.neq.Cancelled');
  if (jobsError) {
    return NextResponse.json({ error: `Could not load jobs: ${jobsError.message}` }, { status: 500 });
  }
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  // Personal pushes need VAPID keys + registered devices; channel reminders
  // need neither, so a missing half only disables that half.
  const pushReady = isPushConfigured();
  let subs: PushSubscriptionRow[] = [];
  if (pushReady) {
    const { data: allSubs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, user_email, endpoint, p256dh, auth');
    subs = (allSubs as PushSubscriptionRow[]) || [];
  }

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  const usersByEmail = new Map<string, string>();
  for (const s of subs) {
    const list = subsByUser.get(s.user_id) || [];
    list.push(s);
    subsByUser.set(s.user_id, list);
    if (s.user_email) usersByEmail.set(s.user_email.toLowerCase(), s.user_id);
  }

  const prefs = new Map<string, PrefRow>();
  if (subs.length > 0) {
    const { data: prefRows } = await admin
      .from('push_prefs')
      .select('user_id, call_reminders, call_reminder_lead_minutes');
    for (const p of (prefRows as PrefRow[]) || []) prefs.set(p.user_id, p);
  }

  const rolesByJob = new Map<string, RoleRow[]>();
  if (subs.length > 0) {
    const { data: roleRows } = await admin
      .from('job_roles')
      .select('job_id, call_time, email, contact:contacts(email)')
      .in('job_id', jobs.map((j) => j.id));
    for (const r of (roleRows as unknown as RoleRow[]) || []) {
      const list = rolesByJob.get(r.job_id) || [];
      list.push(r);
      rolesByJob.set(r.job_id, list);
    }
  }

  // Team-channel fan-out: only when the org has opted in and wired a channel.
  let channelTemplate: string | null = null;
  let channels: TeamChannel[] = [];
  if (org?.id) {
    const { data: rule } = await admin
      .from('notification_events')
      .select('enabled, message_template')
      .eq('org_id', org.id)
      .eq('event_key', 'call_reminder')
      .maybeSingle();
    if (rule?.enabled && rule.message_template) {
      const { data: ch } = await admin
        .from('notification_channels')
        .select('id, platform, label, webhook_url, enabled')
        .eq('org_id', org.id)
        .eq('enabled', true);
      channels = ((ch as TeamChannel[]) || []).filter((c) => c.webhook_url);
      if (channels.length > 0) channelTemplate = rule.message_template;
    }
  }

  if (subs.length === 0 && !channelTemplate) {
    return NextResponse.json({
      checked: jobs.length,
      sent: 0,
      reason: pushReady ? 'no push devices and no channel rule' : 'VAPID keys not configured and no channel rule',
    });
  }

  let sent = 0;
  let pruned = 0;
  let channelsSent = 0;

  for (const job of jobs as JobRow[]) {
    // Which of today/tomorrow are shoot days for this job? ISO date strings
    // compare correctly as plain strings.
    const lastDay = job.end_date || job.shoot_date;
    const activeDays = days.filter((d) => d >= job.shoot_date && d <= lastDay);
    if (activeDays.length === 0) continue;

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

    for (const day of activeDays) {
      for (const [userId, callText] of recipients) {
        const pref = prefs.get(userId);
        if (pref && pref.call_reminders === false) continue;
        const lead = Math.min(
          MAX_LEAD_MINUTES,
          Math.max(MIN_LEAD_MINUTES, pref?.call_reminder_lead_minutes || DEFAULT_LEAD_MINUTES)
        );

        const parsed = parseCallTime(callText);
        if (!parsed) continue; // no call time set, or free text like "TBD"
        const callAt = wallTimeToUtc(day, parsed.hours, parsed.minutes, timeZone);
        if (!callAt) continue;

        const msLeft = callAt.getTime() - now.getTime();
        if (msLeft <= 0 || msLeft > lead * 60 * 1000) continue;

        // Claim the dedupe key before sending; a unique violation means an
        // earlier run (or a parallel one) already owns this reminder.
        const { error: claimError } = await admin
          .from('push_sent_log')
          .insert({ dedupe_key: `call:${job.id}:${userId}:${day}` });
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

      // One channel announcement per job/day at the job-level call time.
      if (channelTemplate) {
        const parsed = parseCallTime(job.call_time);
        if (!parsed) continue;
        const callAt = wallTimeToUtc(day, parsed.hours, parsed.minutes, timeZone);
        if (!callAt) continue;
        const msLeft = callAt.getTime() - now.getTime();
        if (msLeft <= 0 || msLeft > CHANNEL_LEAD_MINUTES * 60 * 1000) continue;

        const { error: claimError } = await admin
          .from('push_sent_log')
          .insert({ dedupe_key: `callchan:${job.id}:${day}` });
        if (claimError) {
          if (claimError.code !== '23505') console.error('Channel reminder claim failed:', claimError.message);
          continue;
        }

        const text = renderTemplate(channelTemplate, {
          title: job.title,
          client: job.client_name || undefined,
          shoot_date: day,
          location: job.location_name || undefined,
          call_time: (job.call_time || '').trim() || undefined,
        });
        const results = await Promise.all(channels.map((c) => dispatchToChannel(c, text)));
        channelsSent += results.filter((r) => r.ok).length;
      }
    }
  }

  // Keep the ledger from growing forever; two weeks covers any re-run window.
  await admin
    .from('push_sent_log')
    .delete()
    .lt('sent_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({ checked: jobs.length, sent, pruned, channelsSent, timeZone, days });
}
