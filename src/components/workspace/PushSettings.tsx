'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, BellRing, BellOff, Send, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authHeader } from '@/lib/api-client';

// Per-user web push controls: turn notifications on for *this device*, pick
// what you get pinged about (call-time reminders with a lead time, @mention
// pings), and send yourself a test. Subscriptions are per browser/device, so
// enabling on a phone and a laptop means two rows in push_subscriptions.

interface Prefs {
  call_reminders: boolean;
  call_reminder_lead_minutes: number;
  mention_pings: boolean;
}

const DEFAULT_PREFS: Prefs = { call_reminders: true, call_reminder_lead_minutes: 60, mention_pings: true };

const LEAD_CHOICES = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '90 minutes' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
];

// The applicationServerKey must be raw bytes; VAPID public keys travel as URL-safe base64.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export default function PushSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false); // this device has an active subscription
  const [deviceCount, setDeviceCount] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDeviceCount = useCallback(async () => {
    // RLS scopes this to the caller's own rows.
    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true });
    setDeviceCount(count || 0);
  }, []);

  useEffect(() => {
    const load = async () => {
      const ok =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      setSupported(ok);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id || null);

        const res = await fetch('/api/push');
        const cfg = await res.json().catch(() => ({}));
        setConfigured(cfg.configured !== false);
        setPublicKey(cfg.publicKey || null);

        if (ok) {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          setEnabled(!!sub);
        }
        if (session?.user?.id) {
          await refreshDeviceCount();
          const { data: prefRow } = await supabase
            .from('push_prefs')
            .select('call_reminders, call_reminder_lead_minutes, mention_pings')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (prefRow) setPrefs(prefRow as Prefs);
        }
      } catch (err) {
        console.error('Push settings load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshDeviceCount]);

  const enable = async () => {
    if (!publicKey) return;
    setBusy('toggle');
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Notifications are blocked for this site — allow them in your browser settings, then try again.');
        return;
      }
      // Explicit register: outside production builds the SW isn't auto-registered.
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEnabled(true);
      setMessage('Push enabled on this device.');
      await refreshDeviceCount();
    } catch (err: any) {
      console.error('Push enable failed:', err);
      setMessage(`Could not enable push: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    setBusy('toggle');
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMessage('Push disabled on this device.');
      await refreshDeviceCount();
    } catch (err: any) {
      console.error('Push disable failed:', err);
      setMessage(`Could not disable push: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setMessage(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { ...(await authHeader()) },
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? 'Test sent — check your notifications.' : data.error || `Test failed (HTTP ${res.status}).`);
    } catch {
      setMessage('Test failed — could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  const savePrefs = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next); // optimistic — a toggle should feel instant
    if (!userId) return;
    const { error } = await supabase
      .from('push_prefs')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Failed to save push prefs:', error);
      setMessage('Could not save preferences — run the latest database migrations.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  if (supported === false) {
    return (
      <p className="text-[10px] text-white/40 leading-relaxed">
        This browser doesn&apos;t support web push.
        {isIOS() && !isStandalone() && (
          <> On iPhone/iPad, first add Studio OS to your Home Screen (Share → Add to Home Screen), then open it from there and enable push.</>
        )}
      </p>
    );
  }

  if (!configured) {
    return (
      <p className="text-[10px] font-bold text-amber-400 leading-relaxed">
        Web push isn&apos;t configured on the server — generate VAPID keys with <code className="font-mono">npx web-push generate-vapid-keys</code> and
        set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in your Vercel environment.{' '}
        <a
          href="https://github.com/mattcerisano/zipline-media/blob/main/docs/PUSH_SETUP.md"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-amber-300"
        >
          Step-by-step setup guide
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <Smartphone className="w-3.5 h-3.5" />
          {enabled ? 'Enabled on this device' : 'Off on this device'}
          {deviceCount > 0 && <span className="text-white/30">· {deviceCount} device{deviceCount === 1 ? '' : 's'} registered</span>}
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <button
              onClick={sendTest}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-40"
            >
              {busy === 'test' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send test
            </button>
          )}
          <button
            onClick={enabled ? disable : enable}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {busy === 'toggle' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : enabled ? (
              <BellOff className="w-3.5 h-3.5" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            {enabled ? 'Disable on this device' : 'Enable push'}
          </button>
        </div>
      </div>

      {isIOS() && !isStandalone() && !enabled && (
        <p className="text-[9px] text-white/30 leading-relaxed">
          iPhone/iPad: add Studio OS to your Home Screen first (Share → Add to Home Screen) — Safari only allows push for installed web apps.
        </p>
      )}

      {/* What you get pinged about — synced across all your devices. */}
      <div className="space-y-3 pt-1">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Call-time reminders</span>
              <p className="text-[9px] text-white/35 mt-0.5">A heads-up before your call on shoot days — your crew call time if you&apos;re on the crew list, otherwise the production&apos;s.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.call_reminders}
              onChange={(e) => savePrefs({ call_reminders: e.target.checked })}
              className="accent-[var(--accent)] w-4 h-4 shrink-0 ml-3"
            />
          </label>
          {prefs.call_reminders && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Remind me</span>
              <select
                value={prefs.call_reminder_lead_minutes}
                onChange={(e) => savePrefs({ call_reminder_lead_minutes: Number(e.target.value) })}
                className="bg-black/50 border border-white/10 py-1.5 px-2 rounded-lg outline-none focus:border-accent text-[11px] text-white"
              >
                {LEAD_CHOICES.map((c) => (
                  <option key={c.minutes} value={c.minutes}>{c.label} before</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">@Mention pings</span>
              <p className="text-[9px] text-white/35 mt-0.5">When a teammate @mentions you in Edit Tracker notes.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.mention_pings}
              onChange={(e) => savePrefs({ mention_pings: e.target.checked })}
              className="accent-[var(--accent)] w-4 h-4 shrink-0 ml-3"
            />
          </label>
        </div>
      </div>

      {message && <p className="text-[10px] font-bold text-accent">{message}</p>}
    </div>
  );
}
