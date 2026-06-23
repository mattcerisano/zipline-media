import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client so the route can read org channel/event config and
// dispatch regardless of which user triggered the event.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type Platform = 'discord' | 'slack' | 'teams';

interface Channel {
  id: string;
  platform: Platform;
  label: string | null;
  webhook_url: string | null;
  enabled: boolean;
}

// Replace {placeholder} tokens with values; unknown/empty tokens render as TBD.
function renderTemplate(template: string, variables: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = variables[key];
    return val && val.trim() ? val : 'TBD';
  });
}

// Build the platform-specific request body for a rendered text message.
function buildPayload(platform: Platform, text: string): Record<string, unknown> {
  switch (platform) {
    case 'discord':
      // Discord webhooks accept markdown directly in `content`.
      return { content: text };
    case 'slack':
      return { text };
    case 'teams':
      // Teams legacy Incoming Webhook expects a MessageCard.
      return {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        text,
      };
    default:
      return { text };
  }
}

async function dispatch(channel: Channel, text: string): Promise<{ platform: Platform; ok: boolean; error?: string }> {
  if (!channel.webhook_url) {
    return { platform: channel.platform, ok: false, error: 'No webhook URL configured' };
  }
  try {
    const res = await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(channel.platform, text)),
    });
    if (!res.ok) {
      return { platform: channel.platform, ok: false, error: `HTTP ${res.status}` };
    }
    return { platform: channel.platform, ok: true };
  } catch (err: any) {
    return { platform: channel.platform, ok: false, error: err?.message || 'Request failed' };
  }
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured for notifications' }, { status: 500 });
  }

  try {
    const { event_key, variables = {}, test, channel_id, message } = await request.json();

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
