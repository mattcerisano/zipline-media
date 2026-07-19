import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSameOrigin } from '@/lib/api-guard';
import { renderTemplate, dispatchToChannel as dispatch, type TeamChannel as Channel, type NotificationPlatform as Platform } from '@/lib/team-notify';

// Service-role client so the route can read org channel/event config and
// dispatch regardless of which user triggered the event.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as any));
  const { event_key, variables = {}, test, channel_id, message, platform, webhook_url } = body;

  // --- Direct test: dispatch straight to a supplied webhook URL. --------
  // No database lookup and no service-role key required, so "Send Test"
  // works before the channel is even saved AND surfaces the real reason a
  // webhook fails (bad URL, deleted webhook, network) instead of a silent
  // "failed". Same-origin only so it can't be used as an open relay.
  if (test && webhook_url) {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = await dispatch(
      { id: '', platform: (platform as Platform) || 'discord', label: null, webhook_url, enabled: true },
      '🛠️ Zipline Media test alert — your notifications are connected and working.'
    );
    return NextResponse.json(
      result.ok ? { success: true } : { error: result.error || 'Failed to send test' },
      { status: result.ok ? 200 : 502 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured for notifications (SUPABASE_SERVICE_ROLE_KEY missing on the server).' }, { status: 500 });
  }

  try {

    // Resolve the singleton org (matches branding/settings loading elsewhere).
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: 'No organization configured' }, { status: 500 });
    }

    // --- Test mode: send a canned message to one specific channel --------
    if (test && channel_id) {
      const { data: channel } = await supabaseAdmin
        .from('notification_channels')
        .select('id, platform, label, webhook_url, enabled')
        .eq('id', channel_id)
        .maybeSingle();

      if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }
      const result = await dispatch(
        channel as Channel,
        '🛠️ Zipline Media test alert — your notifications are connected and working.'
      );
      return NextResponse.json(
        result.ok ? { success: true } : { error: result.error || 'Failed to send test' },
        { status: result.ok ? 200 : 502 }
      );
    }

    // --- Broadcast mode: send an ad-hoc message to all enabled channels --
    if (message) {
      const { data: channels } = await supabaseAdmin
        .from('notification_channels')
        .select('id, platform, label, webhook_url, enabled')
        .eq('org_id', org.id)
        .eq('enabled', true);

      const usable = (channels || []).filter((c) => c.webhook_url) as Channel[];
      if (usable.length === 0) {
        return NextResponse.json({ error: 'No enabled channels configured' }, { status: 400 });
      }
      const results = await Promise.all(usable.map((c) => dispatch(c, message)));
      const anyOk = results.some((r) => r.ok);
      return NextResponse.json(
        anyOk ? { success: true, results } : { error: 'All channels failed', results },
        { status: anyOk ? 200 : 502 }
      );
    }

    // --- Event mode: look up the rule, bail if disabled/missing ----------
    if (!event_key) {
      return NextResponse.json({ error: 'event_key is required' }, { status: 400 });
    }

    const { data: eventRule } = await supabaseAdmin
      .from('notification_events')
      .select('enabled, message_template')
      .eq('org_id', org.id)
      .eq('event_key', event_key)
      .maybeSingle();

    if (!eventRule || !eventRule.enabled || !eventRule.message_template) {
      return NextResponse.json({ skipped: true, reason: 'event disabled or not configured' });
    }

    const { data: channels } = await supabaseAdmin
      .from('notification_channels')
      .select('id, platform, label, webhook_url, enabled')
      .eq('org_id', org.id)
      .eq('enabled', true);

    const usable = (channels || []).filter((c) => c.webhook_url) as Channel[];
    if (usable.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no enabled channels' });
    }

    const text = renderTemplate(eventRule.message_template, variables);
    const results = await Promise.all(usable.map((c) => dispatch(c, text)));

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Notify dispatch error:', error);
    return NextResponse.json({ error: 'Failed to dispatch notification' }, { status: 500 });
  }
}
