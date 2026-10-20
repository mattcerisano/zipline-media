import { describe, expect, it } from 'vitest';
import { isAllowedWebhookUrl } from './webhook-hosts';

describe('isAllowedWebhookUrl', () => {
  it('accepts each platform’s real webhook addresses', () => {
    expect(isAllowedWebhookUrl('https://discord.com/api/webhooks/123/abc', 'discord')).toBe(true);
    expect(isAllowedWebhookUrl('https://discordapp.com/api/webhooks/123/abc', 'discord')).toBe(true);
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/T0/B0/xyz', 'slack')).toBe(true);
    expect(isAllowedWebhookUrl('https://zipline.webhook.office.com/webhookb2/abc', 'teams')).toBe(true);
    expect(isAllowedWebhookUrl('https://prod-12.westus.logic.azure.com/workflows/abc', 'teams')).toBe(true);
  });

  it('refuses other hosts, plain http, and look-alikes', () => {
    expect(isAllowedWebhookUrl('https://example.com/hook', 'discord')).toBe(false);
    expect(isAllowedWebhookUrl('http://discord.com/api/webhooks/1/a', 'discord')).toBe(false);
    expect(isAllowedWebhookUrl('https://discord.com.evil.net/api/webhooks/1/a', 'discord')).toBe(false);
    expect(isAllowedWebhookUrl('https://discord.com/other/path', 'discord')).toBe(false);
    expect(isAllowedWebhookUrl('https://hooks.slack.com@evil.net/x', 'slack')).toBe(false);
    expect(isAllowedWebhookUrl('https://169.254.169.254/latest', 'slack')).toBe(false);
    expect(isAllowedWebhookUrl('https://hooks.slack.com:8443/x', 'slack')).toBe(false);
  });

  it('refuses a URL meant for a different platform, or none at all', () => {
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/x', 'discord')).toBe(false);
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/x', 'carrier-pigeon')).toBe(false);
    expect(isAllowedWebhookUrl('', 'slack')).toBe(false);
    expect(isAllowedWebhookUrl('not a url', 'slack')).toBe(false);
  });
});
