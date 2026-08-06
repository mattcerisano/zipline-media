'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { postNotify } from '@/lib/notify';
import type { NotificationChannel, NotificationEvent, NotificationPlatform } from '@/components/gearbuilder/types';

// Display metadata for the three supported platforms.
const PLATFORMS: { platform: NotificationPlatform; label: string; hint: string }[] = [
  { platform: 'discord', label: 'Discord', hint: 'Server Settings → Integrations → Webhooks → Copy URL' },
  { platform: 'slack', label: 'Slack', hint: 'api.slack.com → Incoming Webhooks → Add to channel' },
  { platform: 'teams', label: 'Microsoft Teams', hint: 'Channel → Connectors → Incoming Webhook' },
];

// Human-friendly labels for each event rule, in display order.
const EVENT_META: { key: string; label: string }[] = [
  { key: 'job_created', label: 'New production added' },
  { key: 'status_booked', label: 'Status → Booked' },
  { key: 'status_hold', label: 'Status → Hold' },
  { key: 'status_planning', label: 'Status → Planning' },
  { key: 'status_wrapped', label: 'Status → Wrapped' },
  { key: 'status_cancelled', label: 'Status → Cancelled' },
];

const PLACEHOLDERS = '{title} · {client} · {production_company} · {shoot_date} · {location} · {old_status} · {new_status}';

const inputClass = 'w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white transition-colors';
const labelClass = 'block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5';

interface Props {
  isAdmin: boolean;
  onMessage: (msg: string) => void;
}

export default function IntegrationsSettings({ isAdmin, onMessage }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail'>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        const oid = org?.id || null;
        setOrgId(oid);

        const [chRes, evRes] = await Promise.all([
          supabase.from('notification_channels').select('*'),
          supabase.from('notification_events').select('*'),
        ]);
        setChannels((chRes.data as NotificationChannel[]) || []);
        setEvents((evRes.data as NotificationEvent[]) || []);
      } catch (err) {
        console.error('Failed to load integrations:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Find or synthesize a channel row for a platform (seed rows should exist).
  const channelFor = (platform: NotificationPlatform): NotificationChannel =>
    channels.find((c) => c.platform === platform) || { id: '', platform, enabled: false };

  const updateChannel = (platform: NotificationPlatform, patch: Partial<NotificationChannel>) => {
    setChannels((prev) => {
      const existing = prev.find((c) => c.platform === platform);
      if (existing) return prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c));
      return [...prev, { id: '', platform, enabled: false, ...patch }];
    });
  };

  const updateEvent = (key: string, patch: Partial<NotificationEvent>) => {
    setEvents((prev) => {
      const existing = prev.find((e) => e.event_key === key);
      if (existing) return prev.map((e) => (e.event_key === key ? { ...e, ...patch } : e));
      return [...prev, { id: '', event_key: key, enabled: false, ...patch }];
    });
  };

  const handleSave = async () => {
    // Both guards used to be a bare `return`: Save appeared to work, nothing
    // persisted, and nothing said why. A missing organization row is the more
    // likely of the two — the app reads and updates that table but has never
    // had any code that creates one, so a database whose seed didn't run has
    // no org and every org-scoped setting silently discards itself.
    if (!isAdmin) {
      onMessage('Only an admin can change notification settings.');
      return;
    }

    setSaving(true);
    onMessage('');
    try {
      let oid = orgId;
      if (!oid) {
        const { data: created, error: orgErr } = await supabase
          .from('organizations')
          .insert([{ name: 'Zipline Media', tagline: 'Creative Video Production', brand_color: '#0077FF' }])
          .select('id')
          .single();
        if (orgErr || !created) {
          throw new Error(
            `No organization exists yet and one couldn't be created${orgErr ? `: ${orgErr.message}` : ''}. ` +
            'Run the profiles_and_branding migration in Supabase.'
          );
        }
        oid = created.id;
        setOrgId(oid);
      }
      const orgId2 = oid;
      const channelRows = channels.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        org_id: orgId2,
        platform: c.platform,
        label: c.label || PLATFORMS.find((p) => p.platform === c.platform)?.label,
        webhook_url: c.webhook_url || null,
        enabled: c.enabled,
        updated_at: new Date().toISOString(),
      }));
      const eventRows = events.map((e) => ({
        ...(e.id ? { id: e.id } : {}),
        org_id: orgId2,
        event_key: e.event_key,
        enabled: e.enabled,
        message_template: e.message_template || null,
        updated_at: new Date().toISOString(),
      }));

      const [chErr, evErr] = await Promise.all([
        supabase.from('notification_channels').upsert(channelRows, { onConflict: 'org_id,platform' }),
        supabase.from('notification_events').upsert(eventRows, { onConflict: 'org_id,event_key' }),
      ]);
      if (chErr.error) throw chErr.error;
      if (evErr.error) throw evErr.error;

      // Re-fetch so freshly inserted rows get their generated ids.
      const [chRes, evRes] = await Promise.all([
        supabase.from('notification_channels').select('*'),
        supabase.from('notification_events').select('*'),
      ]);
      setChannels((chRes.data as NotificationChannel[]) || []);
      setEvents((evRes.data as NotificationEvent[]) || []);
      onMessage('Integrations saved.');
    } catch (err: any) {
      console.error('Failed to save integrations:', err);
      onMessage(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (platform: NotificationPlatform) => {
    const channel = channelFor(platform);
    if (!channel.webhook_url || !channel.webhook_url.trim()) {
      onMessage('Paste a webhook URL first, then send a test.');
      return;
    }
    setTesting(platform);
    setTestResult((r) => ({ ...r, [platform]: undefined as any }));
    onMessage('');
    try {
      // Test the URL that's currently in the box — no save required, and the
      // server dispatches to it directly so a failure reports the real reason.
      const res = await postNotify({ test: true, platform, webhook_url: channel.webhook_url.trim() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult((r) => ({ ...r, [platform]: 'ok' }));
        onMessage('Test message sent — check your channel.');
      } else {
        setTestResult((r) => ({ ...r, [platform]: 'fail' }));
        onMessage(data.error ? `Test failed: ${data.error}` : `Test failed (HTTP ${res.status}).`);
      }
    } catch (err: any) {
      setTestResult((r) => ({ ...r, [platform]: 'fail' }));
      onMessage(`Test failed: ${err?.message || 'could not reach the server.'}`);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <p className="text-[11px] text-white/40 py-6">Only admins can configure team notifications.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Channels */}
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white mb-1">Channels</h4>
        <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
          Connect the chat platforms your team uses. Alerts fan out to every enabled channel with a webhook URL.
        </p>
        <div className="space-y-3">
          {PLATFORMS.map(({ platform, label, hint }) => {
            const channel = channelFor(platform);
            const result = testResult[platform];
            return (
              <div key={platform} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white">{label}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                      {channel.enabled ? 'On' : 'Off'}
                    </span>
                    <input
                      type="checkbox"
                      checked={!!channel.enabled}
                      onChange={(e) => updateChannel(platform, { enabled: e.target.checked })}
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                  </label>
                </div>
                <label className={labelClass}>Webhook URL</label>
                <input
                  className={inputClass}
                  type="url"
                  placeholder="https://…"
                  value={channel.webhook_url || ''}
                  onChange={(e) => updateChannel(platform, { webhook_url: e.target.value })}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-white/30 tracking-wide">{hint}</span>
                  <button
                    onClick={() => sendTest(platform)}
                    disabled={testing === platform || !channel.webhook_url}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-40"
                  >
                    {testing === platform ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : result === 'ok' ? (
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                    ) : result === 'fail' ? (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    {result === 'ok' ? 'Sent' : result === 'fail' ? 'Failed' : 'Send test'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events */}
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white mb-1">Alerts</h4>
        <p className="text-[10px] text-white/40 mb-1 leading-relaxed">
          Toggle which events notify the team and customize the message. Placeholders:
        </p>
        <p className="text-[9px] text-white/30 mb-3 font-mono break-words">{PLACEHOLDERS}</p>
        <div className="space-y-3">
          {EVENT_META.map(({ key, label }) => {
            const ev = events.find((e) => e.event_key === key) || { id: '', event_key: key, enabled: false };
            return (
              <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <label className="flex items-center justify-between mb-2 cursor-pointer">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!ev.enabled}
                    onChange={(e) => updateEvent(key, { enabled: e.target.checked })}
                    className="accent-[var(--accent)] w-4 h-4"
                  />
                </label>
                <textarea
                  className={`${inputClass} resize-y min-h-[60px]`}
                  rows={2}
                  placeholder="Message sent to the team…"
                  value={ev.message_template || ''}
                  onChange={(e) => updateEvent(key, { message_template: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save Integrations'}
        </button>
      </div>
    </div>
  );
}
