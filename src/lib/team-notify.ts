/**
 * Team-channel webhook dispatch (Discord / Slack / Teams), shared by the
 * /api/integrations/notify route and server-side senders like the
 * call-reminder cron. Rows come from notification_channels; message templates
 * from notification_events.
 */

export type NotificationPlatform = 'discord' | 'slack' | 'teams';

export interface TeamChannel {
  id: string;
  platform: NotificationPlatform;
  label: string | null;
  webhook_url: string | null;
  enabled: boolean;
}

/** Replace {placeholder} tokens with values; unknown/empty tokens render as TBD. */
export function renderTemplate(template: string, variables: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = variables[key];
    return val && val.trim() ? val : 'TBD';
  });
}

/** Build the platform-specific request body for a rendered text message. */
export function buildPayload(platform: NotificationPlatform, text: string): Record<string, unknown> {
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

export async function dispatchToChannel(
  channel: TeamChannel,
  text: string
): Promise<{ platform: NotificationPlatform; ok: boolean; error?: string }> {
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
  } catch (err: unknown) {
    return { platform: channel.platform, ok: false, error: (err as Error)?.message || 'Request failed' };
  }
}
