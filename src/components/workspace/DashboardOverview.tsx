'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Scissors,
  Package,
  Users,
  MessageSquare,
  HelpCircle,
  SlidersHorizontal,
  RotateCcw,
  Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';

export interface DashboardOverviewProps {
  onSwitchTab: (tab: string) => void;
}

// Per-item dashboard customization: every stat card, quick action, and
// integrations panel can be shown/hidden individually. Grouped so the
// Customize popover reads as three short sections.
const DASHBOARD_ITEMS: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: 'Stat Cards',
    items: [
      { id: 'stat_booked', label: 'Jobs Booked' },
      { id: 'stat_edits', label: 'Edits in Progress' },
      { id: 'stat_contacts', label: 'Total Contacts' },
    ],
  },
  {
    group: 'Quick Actions',
    items: [
      { id: 'action_slate', label: 'Production Slate' },
      { id: 'action_gear', label: 'Build Gear List' },
      { id: 'action_crew', label: 'Assemble Crew' },
      { id: 'action_calendar', label: 'View Calendar' },
      { id: 'action_guide', label: 'System Guide' },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { id: 'panel_gateway', label: 'Team Alert Gateway' },
      { id: 'panel_telemetry', label: 'Hub Telemetry' },
    ],
  },
];
const DEFAULT_WIDGETS: Record<string, boolean> = Object.fromEntries(
  DASHBOARD_ITEMS.flatMap(g => g.items.map(i => [i.id, true]))
);
const WIDGETS_STORAGE_KEY = 'studio_dashboard_widgets_v2';
const LEGACY_WIDGETS_KEY = 'studio_dashboard_widgets';

// Users on the old section-level prefs keep their choices: a hidden section
// maps to all of its items hidden.
function migrateLegacyPrefs(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(LEGACY_WIDGETS_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as Record<string, boolean>;
    const next = { ...DEFAULT_WIDGETS };
    if (legacy.stats === false) ['stat_booked', 'stat_edits', 'stat_contacts'].forEach(k => { next[k] = false; });
    if (legacy.quickActions === false) ['action_slate', 'action_gear', 'action_crew', 'action_calendar', 'action_guide'].forEach(k => { next[k] = false; });
    if (legacy.integrations === false) ['panel_gateway', 'panel_telemetry'].forEach(k => { next[k] = false; });
    localStorage.removeItem(LEGACY_WIDGETS_KEY);
    localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export default function DashboardOverview({
  onSwitchTab
}: DashboardOverviewProps) {
  const [widgets, setWidgets] = useState<Record<string, boolean>>(DEFAULT_WIDGETS);
  const [showCustomize, setShowCustomize] = useState(false);

  // Load saved widget visibility (per-browser, like the workspace layout prefs)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGETS_STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWidgets({ ...DEFAULT_WIDGETS, ...JSON.parse(saved) });
      } else {
        const migrated = migrateLegacyPrefs();
        if (migrated) setWidgets(migrated);
      }
    } catch { /* ignore */ }
  }, []);

  const toggleWidget = (id: string) => {
    setWidgets(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    try {
      localStorage.removeItem(WIDGETS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_WIDGETS_KEY);
    } catch { /* ignore */ }
    setShowCustomize(false);
  };

  // Section visibility derives from its items.
  const showStats = widgets.stat_booked || widgets.stat_edits || widgets.stat_contacts;
  const showActions = widgets.action_slate || widgets.action_gear || widgets.action_crew || widgets.action_calendar || widgets.action_guide;
  const showIntegrations = widgets.panel_gateway || widgets.panel_telemetry;
  const allHidden = !showStats && !showActions && !showIntegrations;

  // Real integration status (replaces the old hardcoded "Active" rows).
  const [telemetry, setTelemetry] = useState<{ google: boolean | null; webhooks: number | null }>({ google: null, webhooks: null });

  useEffect(() => {
    const check = async () => {
      let google: boolean | null = false;
      let webhooks: number | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch('/api/auth/google/status', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json().catch(() => ({}));
          google = !!data.connected;
        }
      } catch { google = false; }
      try {
        const { data } = await supabase
          .from('notification_channels')
          .select('id, enabled, webhook_url');
        webhooks = (data || []).filter((c: any) => c.enabled && c.webhook_url).length;
      } catch { webhooks = null; }
      setTelemetry({ google, webhooks });
    };
    check();
  }, []);

  const [discordMsg, setDiscordMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null);

  const [stats, setStats] = useState({
    bookedJobs: 0,
    planningJobs: 0,
    editsInProgress: 0,
    editsInReview: 0,
    totalContacts: 0,
    totalClients: 0,
    loading: true
  });

  const fetchStats = useCallback(async () => {
      try {
        const [jobsRes, contactsRes, clientsRes] = await Promise.all([
          supabase.from('jobs').select('job_status, edit_status'),
          supabase.from('contacts').select('id', { count: 'exact', head: true }),
          supabase.from('clients').select('id', { count: 'exact', head: true })
        ]);

        const jobs = jobsRes.data || [];
        const booked = jobs.filter(j => j.job_status === 'Booked').length;
        const planning = jobs.filter(j => j.job_status === 'Planning').length;
        
        // Edits in progress: Not Cancelled, has edit_status, and is one of the active edit stages
        const inProgress = jobs.filter(j => 
          j.job_status !== 'Cancelled' && 
          j.edit_status && 
          ['Filmed', 'WIP', 'V1', 'Revisions'].includes(j.edit_status)
        ).length;
        
        const inReview = jobs.filter(j => 
          j.job_status !== 'Cancelled' && 
          j.edit_status && 
          ['V1', 'Revisions'].includes(j.edit_status)
        ).length;

        setStats({
          bookedJobs: booked,
          planningJobs: planning,
          editsInProgress: inProgress,
          editsInReview: inReview,
          totalContacts: contactsRes.count || 0,
          totalClients: clientsRes.count || 0,
          loading: false
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setStats(prev => ({ ...prev, loading: false }));
      }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Live team sync: keep dashboard counts current as teammates work
  useRealtime(['jobs', 'contacts', 'clients'], fetchStats);

  const testDiscordWebhook = async () => {
    if (!discordMsg.trim()) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/integrations/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🛠️ **Studio OS System Alert Test**\n${discordMsg}`
        })
      });
      if (res.ok) {
        setSendResult('success');
        setDiscordMsg('');
      } else {
        setSendResult('error');
      }
    } catch (err) {
      console.error(err);
      setSendResult('error');
    }
    setIsSending(false);
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-6">
      {/* Customize bar */}
      <div className="flex items-center justify-end mb-3 relative">
        <button
          onClick={() => setShowCustomize(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium tracking-tight text-white/60 hover:text-white transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Customize
        </button>
        {showCustomize && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowCustomize(false)} />
            <div className="absolute right-0 top-11 z-40 w-64 max-h-[70vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-xl shadow-2xl p-2">
              {DASHBOARD_ITEMS.map(group => (
                <div key={group.group}>
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 px-2 pt-2 pb-1">{group.group}</p>
                  {group.items.map(w => (
                    <button
                      key={w.id}
                      onClick={() => toggleWidget(w.id)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{w.label}</span>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${widgets[w.id] ? 'bg-accent border-accent' : 'border-white/20'}`}>
                        {widgets[w.id] && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <button
                onClick={resetWidgets}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-accent transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
              </button>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {showStats && (
        <>
      {widgets.stat_booked && (
      <StatCard
        title="Jobs Booked"
        value={stats.bookedJobs.toString()}
        trend={`${stats.planningJobs} planning`}
        icon={Briefcase}
        isLoading={stats.loading}
      />
      )}
      {widgets.stat_edits && (
      <StatCard
        title="Edits in Progress"
        value={stats.editsInProgress.toString()}
        trend={`${stats.editsInReview} in review`}
        icon={Scissors}
        isLoading={stats.loading}
      />
      )}
      {widgets.stat_contacts && (
      <StatCard
        title="Total Contacts"
        value={stats.totalContacts.toString()}
        trend={`${stats.totalClients} clients`}
        icon={Users}
        isLoading={stats.loading}
      />
      )}
        </>
      )}

      {showActions && (
      <div className="md:col-span-2 lg:col-span-3 mt-5">
        <h3 className="text-base font-semibold tracking-tight mb-3 text-white bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {widgets.action_slate && (
          <ActionButton
            label="Production Slate"
            onClick={() => onSwitchTab('slate')}
            icon={Briefcase}
          />
          )}
          {widgets.action_gear && (
          <ActionButton
            label="Build Gear List"
            onClick={() => onSwitchTab('gear')}
            icon={Package}
          />
          )}
          {widgets.action_crew && (
          <ActionButton
            label="Assemble Crew"
            onClick={() => onSwitchTab('slate')}
            icon={Users}
          />
          )}
          {widgets.action_calendar && (
          <ActionButton
            label="View Calendar"
            onClick={() => onSwitchTab('calendar')}
            icon={LayoutDashboard}
          />
          )}
          {widgets.action_guide && (
          <ActionButton
            label="System Guide"
            onClick={() => onSwitchTab('quickstart')}
            icon={HelpCircle}
          />
          )}
        </div>
      </div>
      )}

      {/* Integrations Control Panel */}
      {showIntegrations && (
      <div className={`md:col-span-2 lg:col-span-3 mt-5 grid grid-cols-1 gap-4 ${widgets.panel_gateway && widgets.panel_telemetry ? 'lg:grid-cols-3' : ''}`}>

        {/* Discord Controller */}
        {widgets.panel_gateway && (
        <div className="lg:col-span-2 bg-zinc-950/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl hover:border-white/15 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <MessageSquare className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-white">Team Alert Gateway</h4>
                <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-white/35">Discord · Slack · Teams</p>
              </div>
            </div>

            <p className="text-white/60 text-[11px] mb-4 leading-relaxed">
              Sends real-time production updates, stage shifts, and new bookings to every enabled team channel. Configure channels in the Integrations tab.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Write system message test..."
                value={discordMsg}
                onChange={(e) => setDiscordMsg(e.target.value)}
                className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/35 transition-all duration-300"
              />
              <button 
                onClick={testDiscordWebhook}
                disabled={isSending || !discordMsg.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-[0.98]"
              >
                {isSending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Test Alert'}
              </button>
            </div>

            {sendResult === 'success' && (
              <p className="text-green-400 text-[10px] font-black uppercase tracking-widest animate-pulse">✓ Message dispatched to your team channels!</p>
            )}
            {sendResult === 'error' && (
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">✗ No enabled channels — add a webhook in the Integrations tab.</p>
            )}
          </div>
        </div>
        )}

        {/* Status Dashboard */}
        {widgets.panel_telemetry && (
        <div className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:border-white/15 transition-all duration-300 shadow-xl">
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70 mb-3 border-b border-white/5 pb-2">Integration Hub Telemetry</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-white/45 font-medium text-[11px]">Google Account</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${telemetry.google === null ? 'bg-white/20' : telemetry.google ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className={`font-medium text-[11px] ${telemetry.google === null ? 'text-white/30' : telemetry.google ? 'text-green-400' : 'text-red-400'}`}>
                    {telemetry.google === null ? 'Checking…' : telemetry.google ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/45 font-medium text-[11px]">Team Webhooks</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${telemetry.webhooks === null ? 'bg-white/20' : telemetry.webhooks > 0 ? 'bg-purple-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className={`font-medium text-[11px] ${telemetry.webhooks === null ? 'text-white/30' : telemetry.webhooks > 0 ? 'text-purple-400' : 'text-red-400'}`}>
                    {telemetry.webhooks === null ? 'Checking…' : telemetry.webhooks > 0 ? `${telemetry.webhooks} channel${telemetry.webhooks === 1 ? '' : 's'} live` : 'None enabled'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/45 font-medium text-[11px]">Calendar Feed</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-medium text-[11px]">Active (Webcal)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/45 font-medium text-[11px]">Vimeo / Frame.io</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full" />
                  <span className="text-white/40 font-medium text-[11px]">Embed-based</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wide text-white/30">Zipline Studio OS v1.2</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
        </div>
        )}

      </div>
      )}

      {allHidden && (
        <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
          <p className="font-bold uppercase tracking-widest text-xs text-white">All sections hidden — use Customize to bring them back.</p>
        </div>
      )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  icon: any;
  isLoading?: boolean;
}

function StatCard({ 
  title, 
  value, 
  trend, 
  icon: Icon,
  isLoading 
}: StatCardProps) {
  return (
    <div className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,119,255,0.1)] hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-accent/40 transition-all duration-300" />

      <div className="flex items-center justify-between mb-2.5">
        <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-accent/10 transition-colors">
          <Icon className="w-4.5 h-4.5 text-white/40 group-hover:text-accent transition-colors" />
        </div>
        {isLoading ? (
          <div className="h-5 w-20 bg-white/5 rounded animate-pulse" />
        ) : (
          <span className="text-[10px] font-medium text-green-400 tracking-wide bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/15">{trend}</span>
        )}
      </div>
      <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.12em] mb-0.5">{title}</h3>
      {isLoading ? (
        <div className="h-8 w-24 bg-white/10 rounded animate-pulse mt-1" />
      ) : (
        <p className="text-[28px] font-semibold tracking-tight text-white bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{value}</p>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon: any;
}

function ActionButton({ label, onClick, icon: Icon }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 md:p-5 bg-zinc-950/40 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-gradient-to-b hover:from-accent hover:to-blue-600 hover:border-accent hover:shadow-[0_0_30px_rgba(0,119,255,0.25)] hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden cursor-pointer"
    >
      {/* Subtle icon background glow on hover */}
      <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-colors duration-300" />
      <Icon className="w-6 h-6 mb-2 text-accent group-hover:text-white group-hover:scale-110 transition-all duration-300" />
      <span className="text-[11px] font-medium tracking-tight text-center text-white transition-colors duration-300">{label}</span>
    </button>
  );
}
