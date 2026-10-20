/**
 * Which addresses the notification route will post to.
 *
 * The server sends alerts to whatever webhook URL a channel holds, and the
 * "Send test" path takes the URL straight from the request. Without a check
 * the route would POST to any address a signed-in user typed — another
 * company's endpoint, or something on the hosting network. Each platform's
 * real webhooks live on a small set of HTTPS hosts; anything else is refused.
 */

export type WebhookPlatform = 'discord' | 'slack' | 'teams';

const HOSTS: Record<WebhookPlatform, (host: string, path: string) => boolean> = {
  // discord.com/api/webhooks/{id}/{token}, plus the older and preview hosts.
  discord: (host, path) =>
    ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'].includes(host) &&
    path.startsWith('/api/webhooks/'),
  slack: (host) => host === 'hooks.slack.com',
  // Legacy Incoming Webhooks (*.webhook.office.com, outlook.office.com) and
  // their Power Automate / Workflows replacements.
  teams: (host) =>
    host.endsWith('.webhook.office.com') ||
    host === 'outlook.office.com' ||
    host.endsWith('.logic.azure.com') ||
    host.endsWith('.powerplatform.com'),
};

/** True when `url` is an HTTPS webhook address on the platform's own hosts. */
export function isAllowedWebhookUrl(url: string | null | undefined, platform: string): boolean {
  if (!url) return false;
  const check = HOSTS[platform as WebhookPlatform];
  if (!check) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false;
  return check(parsed.hostname.toLowerCase(), parsed.pathname);
}
