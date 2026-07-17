'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Calendar,
  HardDrive,
  Link2,
  Check,
  Copy,
  Loader2,
  Plug,
  Unplug,
  CheckCircle2,
  XCircle,
  Video,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import IntegrationsSettings from './IntegrationsSettings';
import { confirmAction } from '@/components/Feedback';

// One page for every integration: connect your Google account (Gmail inbox,
// Calendar sync, Drive browser all ride on it), wire team chat webhooks
// (Discord / Slack / Teams), and grab the live calendar feed URL. Everything
// that used to be scattered across the Calendar Sync modal and Settings →
// Integrations lives here in one flow.

export default function IntegrationsHub() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Connect problems render right next to the button — a message at the
  // bottom of a long page reads as "the button does nothing".
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [copiedFeed, setCopiedFeed] = useState(false);

  const refreshGoogleStatus = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch('/api/auth/google/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setGoogleConnected(!!data.connected);
      setGoogleConfigured(data.configured !== false);
    } catch {
      setGoogleConnected(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.access_token) {
        refreshGoogleStatus(session.access_token);
        try {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
          // Missing row = solo operator who predates roles; treat as admin,
          // matching the tab's allowedRoles gate (admin/staff only see this).
          setIsAdmin(!data || (data as any).role === 'admin');
        } catch {
          setIsAdmin(true);
        }
      } else {
        setGoogleConnected(false);
      }
    });
  }, [refreshGoogleStatus]);

  const handleConnect = async () => {
    setGoogleError(null);
    if (!session?.access_token) {
      setGoogleError('Your session has expired — refresh the page and sign in again.');
      return;
    }
    setBusy('connect');
    try {
      const res = await fetch('/api/auth/google', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setGoogleError(data.error || `Could not start the Google connection (HTTP ${res.status}).`);
    } catch {
      setGoogleError('Could not reach the connection service — check your network and try again.');
    }
    setBusy(null);
  };

  const handleDisconnect = async () => {
    if (!session?.access_token) return;
    if (!(await confirmAction({ title: 'Disconnect Google?', message: 'The Inbox, Calendar push, and Drive browser will fall back to offline mode until you reconnect.', danger: true, confirmLabel: 'Disconnect' }))) return;
    setBusy('disconnect');
    setMessage(null);
    try {
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setGoogleConnected(false);
        setMessage('Google account disconnected.');
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Failed to disconnect.');
      }
    } catch {
      setMessage('Failed to disconnect.');
    }
    setBusy(null);
  };

  const feedUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar` : '/api/calendar';
  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 2000);
    } catch {
      setMessage('Copy failed — the feed URL is shown below.');
    }
  };

  const googleServices = [
    { icon: Mail, label: 'Gmail Inbox', desc: 'Live email threads in the Inbox tab' },
    { icon: Calendar, label: 'Calendar Push', desc: 'Send shoots straight to Google Calendar' },
    { icon: HardDrive, label: 'Drive Browser', desc: 'Browse project folders inside cards' },
  ];

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-6 space-y-6">
      {/* ============ GOOGLE ACCOUNT ============ */}
      <section className="bg-zinc-950/40 border border-white/10 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">Google Account</h3>
            <p className="text-[10px] text-white/40 mt-0.5">One connection powers Gmail, Calendar, and Drive.</p>
          </div>
          <div className="flex items-center gap-2">
            {googleConnected === null ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
              </span>
            ) : googleConnected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold uppercase tracking-widest text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <XCircle className="w-3.5 h-3.5" /> Not connected
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {googleServices.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2.5 bg-black/30 border border-white/5 rounded-xl p-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${googleConnected ? 'bg-accent/10 text-accent' : 'bg-white/5 text-white/30'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white">{label}</p>
                <p className="text-[9px] text-white/35 leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {googleConnected ? (
            <>
              <button
                onClick={handleConnect}
                disabled={busy !== null}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-50"
              >
                {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                Reconnect
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy !== null}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={busy !== null}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
              Connect Google Account
            </button>
          )}
        </div>
        {!googleConfigured && (
          <p className="text-[10px] font-bold text-amber-400 mt-2">
            Google OAuth isn&apos;t configured on the server — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (this site&apos;s URL + /api/auth/google/callback) in your Vercel environment.{' '}
            <a
              href="https://github.com/mattcerisano/zipline-media/blob/main/docs/GOOGLE_SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-300"
            >
              Step-by-step setup guide
            </a>
          </p>
        )}
        {googleError && (
          <p className="text-[10px] font-bold text-red-400 mt-2">{googleError}</p>
        )}
      </section>

      {/* ============ CALENDAR FEED ============ */}
      <section className="bg-zinc-950/40 border border-white/10 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" /> Live Calendar Feed
            </h3>
            <p className="text-[10px] text-white/40 mt-1 leading-relaxed">
              Subscribe from Google Calendar or Apple Calendar (&ldquo;Add calendar → From URL&rdquo;) and every booked shoot appears automatically — no account connection required.
            </p>
            <p className="text-[9px] text-white/25 font-mono mt-2 break-all">{feedUrl}</p>
          </div>
          <button
            onClick={copyFeed}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors shrink-0"
          >
            {copiedFeed ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedFeed ? 'Copied' : 'Copy Feed URL'}
          </button>
        </div>
      </section>

      {/* ============ VIDEO REVIEW ============ */}
      <section className="bg-zinc-950/40 border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2 mb-1">
          <Video className="w-4 h-4 text-accent" /> Video Review
        </h3>
        <p className="text-[10px] text-white/40 leading-relaxed">
          Vimeo and Frame.io review links pasted on Edit Tracker cards embed automatically — nothing to connect here. Adding a Vimeo API token on the server additionally pulls comments into cards.
        </p>
      </section>

      {/* ============ TEAM NOTIFICATIONS (Discord / Slack / Teams) ============ */}
      <section className="bg-zinc-950/40 border border-white/10 rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-tight text-white">Team Notifications</h3>
          <p className="text-[10px] text-white/40 mt-0.5">Discord, Slack, and Microsoft Teams webhooks + which events alert the team.</p>
        </div>
        <IntegrationsSettings isAdmin={isAdmin} onMessage={(m) => setMessage(m)} />
      </section>

      {message && (
        <p className="text-[11px] font-bold text-accent px-1">{message}</p>
      )}
    </div>
  );
}
