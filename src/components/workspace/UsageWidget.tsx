'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, Trash2, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast, confirmAction } from '@/components/Feedback';
import { formatLocalDate, todayLocalISO } from '@/lib/date';

/**
 * Usage — which parts of the app get opened, and by whom.
 *
 * Reading is admin-only at the database level, not just hidden here: a staff
 * account querying usage_events directly gets nothing back. See
 * 20260807000001_usage_events.sql.
 *
 * Only surfaces and fixed action labels are recorded — never anything typed.
 * If this screen ever shows a client name, something has gone wrong upstream.
 */

interface Row {
  id: string;
  user_id: string | null;
  kind: string;
  surface: string;
  label: string | null;
  viewport: string | null;
  created_at: string;
}

const RANGES = [
  { key: '1', label: 'Today', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
] as const;

const LABEL_TEXT: Record<string, string> = {
  new_production: 'New production',
  new_production_from_calendar: 'New production (from calendar)',
  quick_marker: 'Quick calendar marker',
  add_contact: 'Add contact',
  add_deliverable: 'Add deliverable',
  export_call_sheet: 'Export call sheet',
  export_brief: 'Export production brief',
  share_gear_list: 'Share gear list',
  library_delete: 'Delete from Library',
  search_palette: 'Open ⌘K search',
};

export default function UsageWidget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<string>('7');

  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];

  const load = useCallback(async () => {
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - range.days + 1);
      since.setHours(0, 0, 0, 0);

      const [evRes, roleRes] = await Promise.all([
        supabase
          .from('usage_events')
          .select('*')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase.from('user_roles').select('id, email'),
      ]);

      if (evRes.error) throw evRes.error;
      setRows((evRes.data || []) as Row[]);
      setNames(Object.fromEntries(((roleRes.data as any[]) || []).map(u => [u.id, u.email])));
    } catch (err: any) {
      console.error('Usage load failed:', err);
      // An empty result and a permission failure look identical without this.
      setError(
        err?.message?.includes('permission') || err?.code === '42501'
          ? 'Usage is admin-only. Your account can record activity but not read it.'
          : err?.message || 'Could not load usage.'
      );
    } finally {
      setLoading(false);
    }
  }, [range.days]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const stats = useMemo(() => {
    const bySurface = new Map<string, number>();
    const byAction = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byPerson = new Map<string, number>();
    let mobile = 0, desktop = 0;

    for (const r of rows) {
      if (r.kind === 'view') bySurface.set(r.surface, (bySurface.get(r.surface) || 0) + 1);
      if (r.kind === 'action' && r.label) byAction.set(r.label, (byAction.get(r.label) || 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
      if (r.user_id) byPerson.set(r.user_id, (byPerson.get(r.user_id) || 0) + 1);
      if (r.viewport === 'mobile') mobile++; else if (r.viewport === 'desktop') desktop++;
    }

    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

    // A run of days with a bar each, so a quiet stretch is visible as a gap
    // rather than missing from the list entirely.
    const days: { date: string; count: number }[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - range.days + 1);
    for (let i = 0; i < range.days; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      days.push({ date: key, count: byDay.get(key) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      surfaces: sorted(bySurface),
      actions: sorted(byAction),
      people: sorted(byPerson),
      days,
      peak: Math.max(1, ...days.map(d => d.count)),
      mobile, desktop,
    };
  }, [rows, range.days]);

  const clearAll = async () => {
    const ok = await confirmAction({
      title: 'Clear the usage log?',
      message: `Deletes all ${rows.length} recorded events. Useful between test rounds. This cannot be undone.`,
      confirmLabel: 'Clear',
      danger: true,
    });
    if (!ok) return;
    // No filter would be rejected by PostgREST, so match every real row.
    const { error: delErr } = await supabase.from('usage_events').delete().gte('created_at', '1970-01-01');
    if (delErr) { toast(`Could not clear: ${delErr.message}`); return; }
    toast('Usage log cleared.');
    void load();
  };

  const bar = (n: number, max: number) => `${Math.max(2, Math.round((n / max) * 100))}%`;
  const topSurface = stats.surfaces[0]?.[1] || 1;
  const topAction = stats.actions[0]?.[1] || 1;

  return (
    <div className="h-full flex flex-col bg-black text-white">
      <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Usage</h2>
          <p className="text-[10px] text-white/30 mt-0.5">Surfaces opened and actions taken. Never what was typed.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                r.key === rangeKey
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh"
            title="Refresh"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
        ) : error ? (
          <div className="py-20 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400/70 mx-auto" />
            <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center space-y-1">
            <p className="text-[11px] text-white/40">Nothing recorded in this period.</p>
            <p className="text-[10px] text-white/25">Open a few tabs and refresh.</p>
          </div>
        ) : (
          <>
            {/* Headline counts */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'Events', v: rows.length },
                { k: 'Desktop', v: stats.desktop, icon: Monitor },
                { k: 'Mobile', v: stats.mobile, icon: Smartphone },
              ].map(s => (
                <div key={s.k} className="bg-white/5 border border-white/5 rounded-xl p-3">
                  <div className="text-lg font-semibold tabular-nums">{s.v}</div>
                  <div className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/35 flex items-center gap-1">
                    {s.icon && <s.icon className="w-3 h-3" />}{s.k}
                  </div>
                </div>
              ))}
            </div>

            {/* Per day */}
            <section className="space-y-2">
              <h3 className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Per day</h3>
              <div className="flex items-end gap-1 h-20">
                {stats.days.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col justify-end items-center gap-1 group" title={`${formatLocalDate(d.date, { month: 'short', day: 'numeric' }, d.date)} · ${d.count}`}>
                    <div
                      className={`w-full rounded-t ${d.count ? 'bg-accent/60 group-hover:bg-accent' : 'bg-white/5'} transition-colors`}
                      style={{ height: bar(d.count, stats.peak) }}
                    />
                    {d.date === todayLocalISO() && <span className="w-1 h-1 rounded-full bg-accent" />}
                  </div>
                ))}
              </div>
            </section>

            {/* Surfaces */}
            <section className="space-y-2">
              <h3 className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Most opened</h3>
              {stats.surfaces.length === 0 ? (
                <p className="text-[11px] text-white/30">No surface views recorded.</p>
              ) : stats.surfaces.map(([surface, n]) => (
                <div key={surface} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="capitalize text-white/80">{surface}</span>
                    <span className="text-white/35 tabular-nums">{n}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent/70 rounded-full" style={{ width: bar(n, topSurface) }} />
                  </div>
                </div>
              ))}
            </section>

            {/* Actions */}
            {stats.actions.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Actions taken</h3>
                {stats.actions.map(([label, n]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/80">{LABEL_TEXT[label] || label}</span>
                      <span className="text-white/35 tabular-nums">{n}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: bar(n, topAction) }} />
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Who */}
            <section className="space-y-2">
              <h3 className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/35">By person</h3>
              {stats.people.map(([id, n]) => (
                <div key={id} className="flex justify-between text-[11px] py-1 border-b border-white/5">
                  <span className="text-white/70 truncate">{names[id] || 'Unknown account'}</span>
                  <span className="text-white/35 tabular-nums shrink-0 ml-3">{n}</span>
                </div>
              ))}
            </section>

            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear log
            </button>
          </>
        )}
      </div>
    </div>
  );
}
