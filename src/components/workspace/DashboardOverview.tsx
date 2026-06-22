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

// Toggleable dashboard sections (#9). Kept coarse so customization stays simple.
const DASHBOARD_WIDGETS: { id: string; label: string }[] = [
  { id: 'stats', label: 'Stat Cards' },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'integrations', label: 'Integrations Panel' },
];
const DEFAULT_WIDGETS: Record<string, boolean> = { stats: true, quickActions: true, integrations: true };
const WIDGETS_STORAGE_KEY = 'studio_dashboard_widgets';

export default function DashboardOverview({
  onSwitchTab
}: DashboardOverviewProps) {
  const [widgets, setWidgets] = useState<Record<string, boolean>>(DEFAULT_WIDGETS);
  const [showCustomize, setShowCustomize] = useState(false);

  // Load saved widget visibility (per-browser, like the workspace layout prefs)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGETS_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setWidgets({ ...DEFAULT_WIDGETS, ...JSON.parse(saved) });
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
    try { localStorage.removeItem(WIDGETS_STORAGE_KEY); } catch { /* ignore */ }
    setShowCustomize(false);
  };

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
      const res = await fetch('/api/integrations/discord', {
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Customize
        </button>
        {showCustomize && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowCustomize(false)} />
            <div className="absolute right-0 top-11 z-40 w-60 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/30 px-2 py-1.5">Show / Hide Sections</p>
              {DASHBOARD_WIDGETS.map(w => (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{w.label}</span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${widgets[w.id] ? 'bg-accent border-accent' : 'border-white/20'}`}>
                    {widgets[w.id] && <Check className="w-3 h-3 text-white" />}
                  </span>
                </button>
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
      {widgets.stats && (
        <>
      <StatCard
        title="Jobs Booked"
        value={stats.bookedJobs.toString()}
        trend={`${stats.planningJobs} planning`}
        icon={Briefcase}
        isLoading={stats.loading}
      />
      <StatCard
        title="Edits in Progress"
        value={stats.editsInProgress.toString()}
        trend={`${stats.editsInReview} in review`}
        icon={Scissors}
        isLoading={stats.loading}
      />
      <StatCard
        title="Total Contacts"
        value={stats.totalContacts.toString()}
        trend={`${stats.totalClients} clients`}
        icon={Users}
        isLoading={stats.loading}
      />
        </>
      )}

      {widgets.quickActions && (
      <div className="md:col-span-2 lg:col-span-3 mt-5">
        <h3 className="text-sm font-black uppercase tracking-tighter mb-3 text-white bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <ActionButton 
            label="Production Slate" 
            onClick={() => onSwitchTab('slate')}
            icon={Briefcase}
          />
          <ActionButton 
            label="Build Gear List" 
            onClick={() => onSwitchTab('gear')}
            icon={Package}
          />
          <ActionButton 
            label="Assemble Crew" 
            onClick={() => onSwitchTab('slate')}
            icon={Users}
          />
          <ActionButton 
            label="View Calendar" 
            onClick={() => onSwitchTab('calendar')}
            icon={LayoutDashboard}
          />
          <ActionButton 
            label="System Guide" 
            onClick={() => onSwitchTab('quickstart')}
            icon={HelpCircle}
          />
        </div>
      </div>
      )}

      {/* Integrations Control Panel */}
      {widgets.integrations && (
      <div className="md:col-span-2 lg:col-span-3 mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Discord Controller */}
        <div className="lg:col-span-2 bg-zinc-950/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl hover:border-white/15 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <MessageSquare className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Discord Integration Gateway</h4>
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">System webhook notifications</p>
              </div>
            </div>

            <p className="text-white/60 text-[11px] mb-4 leading-relaxed">
              Sends real-time production updates, stage shifts, and new bookings to your Discord crew channels automatically.
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
              <p className="text-green-400 text-[10px] font-black uppercase tracking-widest animate-pulse">✓ Message dispatched successfully to Discord!</p>
            )}
            {sendResult === 'error' && (
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">✗ Error: Webhook URL environment variable not configured or invalid response.</p>
            )}
          </div>
        </div>

        {/* Status Dashboard */}
        <div className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between hover:border-white/15 transition-all duration-300 shadow-xl">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-3 border-b border-white/5 pb-2">Integration Hub Telemetry</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-white/40 font-bold uppercase tracking-wider text-[9px]">Google Calendar Feed</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-bold uppercase text-[9px] tracking-wider">Active (Webcal)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/40 font-bold uppercase tracking-wider text-[9px]">Google Drive Vault</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-bold uppercase text-[9px] tracking-wider">Active (Embeds)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/40 font-bold uppercase tracking-wider text-[9px]">Vimeo / Frame.io</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-bold uppercase text-[9px] tracking-wider">Active (Embeds)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-white/40 font-bold uppercase tracking-wider text-[9px]">Discord Webhooks</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider">Active (Gateway)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Zipline Studio OS v1.2</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
        </div>

      </div>
      )}

      {!widgets.stats && !widgets.quickActions && !widgets.integrations && (
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
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/15">{trend}</span>
        )}
      </div>
      <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-0.5">{title}</h3>
      {isLoading ? (
        <div className="h-8 w-24 bg-white/10 rounded animate-pulse mt-1" />
      ) : (
        <p className="text-2xl font-black tracking-tighter text-white bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{value}</p>
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
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center text-white transition-colors duration-300">{label}</span>
    </button>
  );
}
