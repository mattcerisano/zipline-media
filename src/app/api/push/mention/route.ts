import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';
import { isPushConfigured, sendToSubscriptions, type PushSubscriptionRow } from '@/lib/push';

// @mention pings straight to phones. The client sends the mentioned contacts'
// emails (the Rolodex ↔ account identity bridge used across the app); this
// route resolves them to registered devices and pushes to teammates who
// haven't turned mention pings off. Requires a signed-in caller — same trust
// level as the shared team-channel webhook broadcast.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Push not set up — mentions still go out through team channels, so this
    // is a silent no-op rather than an error the UI has to handle.
    return NextResponse.json({ skipped: true, reason: 'push not configured' });
  }

  const body = await request.json().catch(() => ({} as any));
  const emails: string[] = Array.isArray(body?.emails)
    ? body.emails
        .filter((e: unknown): e is string => typeof e === 'string' && e.includes('@'))
        .map((e: string) => e.trim().toLowerCase())
        .slice(0, 25)
    : [];
  const text: string = typeof body?.body === 'string' ? body.body.trim().slice(0, 300) : '';
  const title: string = typeof body?.title === 'string' && body.title.trim()
    ? body.title.trim().slice(0, 120)
    : '💬 You were mentioned';
  const url: string = typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/command-center';

  if (emails.length === 0 || !text) {
    return NextResponse.json({ error: 'emails[] and body are required' }, { status: 400 });
  }

  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, user_email, endpoint, p256dh, auth')
      .in('user_email', emails);

    let rows = (subs as PushSubscriptionRow[]) || [];
    // Don't ping yourself for your own note.
    if (user.email) rows = rows.filter((r) => r.user_email !== user.email);
    if (rows.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no registered devices for those emails' });
    }

    // Respect per-user opt-out; a missing prefs row means defaults (on).
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: prefs } = await supabaseAdmin
      .from('push_prefs')
      .select('user_id, mention_pings')
      .in('user_id', userIds);
    const optedOut = new Set((prefs || []).filter((p) => p.mention_pings === false).map((p) => p.user_id));
    rows = rows.filter((r) => !optedOut.has(r.user_id));

    const result = await sendToSubscriptions(supabaseAdmin, rows, { title, body: text, url, tag: 'mention' });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Mention push failed:', error);
    return NextResponse.json({ error: 'Failed to send mention pings' }, { status: 500 });
  }
}
