'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Megaphone, Film, Link2, Plus, Trash2, X, Check, Copy,
  ChevronLeft, ChevronRight, ExternalLink, Quote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DELIVERABLE_FORMATS,
  nextDeliverableStatus,
  deliverableStatusLabel,
  deliverableStatusTone,
} from '@/lib/deliverables';
import { sanitizeUrl } from '@/lib/sanitize';
import { confirmAction } from '@/components/Feedback';

/* ------------------------------------------------------------------ */
/* Shared constants                                                    */
/* ------------------------------------------------------------------ */
const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', dot: 'bg-pink-500', text: 'text-pink-400', ring: 'border-pink-500/40' },
  { key: 'tiktok', label: 'TikTok', dot: 'bg-cyan-400', text: 'text-cyan-300', ring: 'border-cyan-400/40' },
  { key: 'youtube', label: 'YouTube', dot: 'bg-red-500', text: 'text-red-400', ring: 'border-red-500/40' },
  { key: 'facebook', label: 'Facebook', dot: 'bg-blue-500', text: 'text-blue-400', ring: 'border-blue-500/40' },
  { key: 'x', label: 'X / Twitter', dot: 'bg-white', text: 'text-white/80', ring: 'border-white/40' },
  { key: 'other', label: 'Other', dot: 'bg-zinc-400', text: 'text-zinc-300', ring: 'border-zinc-400/40' },
];
const platform = (k?: string) => PLATFORMS.find((p) => p.key === k) || PLATFORMS[5];

const POST_STATUS = ['idea', 'draft', 'scheduled', 'posted'];
const PHASES = [
  { key: 'teaser', label: 'Teaser / Pre' },
  { key: 'release', label: 'Release Day' },
  { key: 'post', label: 'Post-Release' },
];

type Client = { id: string; name: string };

const inputCls =
  'w-full bg-black/50 border border-white/10 py-2 px-3 rounded-lg outline-none focus:border-accent text-xs text-white placeholder:text-white/25';
const labelCls = 'text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40 mb-1 block';

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */
export default function SocialMedia() {
  const [section, setSection] = useState<'calendar' | 'rollouts' | 'deliverables' | 'links'>('calendar');
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients((data || []) as Client[]));
  }, []);

  const tabs = [
    { key: 'calendar', label: 'Content Calendar', icon: CalendarDays },
    { key: 'rollouts', label: 'Rollout Tracker', icon: Megaphone },
    { key: 'deliverables', label: 'Deliverables', icon: Film },
    { key: 'links', label: 'Links & Captions', icon: Link2 },
  ] as const;

  return (
    <div className="h-full flex flex-col p-5 text-white">
      {/* Section nav */}
      <div className="flex items-center gap-2 mb-5 flex-wrap shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = section === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer border ${
                active ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
        {section === 'calendar' && <ContentCalendar clients={clients} />}
        {section === 'rollouts' && <RolloutTracker clients={clients} />}
        {section === 'deliverables' && <Deliverables clients={clients} />}
        {section === 'links' && <LinkHub clients={clients} />}
      </div>
    </div>
  );
}

/* ================================================================== */
/* 1) Content Calendar                                                 */
/* ================================================================== */
type Post = {
  id: string; client_id?: string | null; title?: string; caption?: string;
  platform?: string; status?: string; scheduled_at?: string | null; link_url?: string; asset_url?: string;
};

function ContentCalendar({ clients }: { clients: Client[] }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editing, setEditing] = useState<Post | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('social_posts').select('*').order('scheduled_at');
    setPosts((data || []) as Post[]);
  }, []);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });

  const postsForDay = (day: number) =>
    posts.filter((p) => {
      if (!p.scheduled_at) return false;
      const d = new Date(p.scheduled_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const newPost = (day?: number) => {
    const base: Post = { id: '', platform: 'instagram', status: 'idea' };
    if (day) base.scheduled_at = new Date(year, month, day, 12, 0).toISOString();
    setEditing(base);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-black uppercase tracking-wider min-w-[180px] text-center">{monthLabel}</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            {PLATFORMS.slice(0, 5).map((p) => (
              <span key={p.key} className="flex items-center gap-1 text-[11px] md:text-[8px] font-bold uppercase text-white/40"><span className={`w-2 h-2 rounded-full ${p.dot}`} />{p.label}</span>
            ))}
          </div>
          <button onClick={() => newPost()} className="px-3 py-2 bg-accent/15 border border-accent/40 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Post</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/30 py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-[88px] rounded-lg border p-1.5 ${day ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-transparent'}`}
            onDoubleClick={() => day && newPost(day)}
          >
            {day && (
              <>
                <div className="text-[11px] md:text-[9px] font-bold text-white/40 mb-1">{day}</div>
                <div className="space-y-1">
                  {postsForDay(day).map((p) => {
                    const pl = platform(p.platform);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditing(p)}
                        className={`w-full text-left px-1.5 py-1 rounded bg-black/40 border ${pl.ring} hover:bg-black/70 cursor-pointer`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${pl.dot} shrink-0`} />
                          <span className="text-[11px] md:text-[9px] font-bold truncate text-white/80">{p.title || p.caption || '(untitled)'}</span>
                        </div>
                        <span className={`text-[11px] md:text-[7px] font-black uppercase tracking-wider ${p.status === 'posted' ? 'text-emerald-400' : 'text-white/30'}`}>{p.status}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <PostModal post={editing} clients={clients} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function PostModal({ post, clients, onClose, onSaved }: { post: Post; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Post>(post);
  const dateValue = draft.scheduled_at ? new Date(draft.scheduled_at).toISOString().slice(0, 16) : '';

  const save = async () => {
    const payload = {
      client_id: draft.client_id || null,
      title: draft.title || '',
      caption: draft.caption || '',
      platform: draft.platform || 'instagram',
      status: draft.status || 'idea',
      scheduled_at: draft.scheduled_at || null,
      link_url: draft.link_url || '',
    };
    if (draft.id) await supabase.from('social_posts').update(payload).eq('id', draft.id);
    else await supabase.from('social_posts').insert([payload]);
    onSaved();
  };
  const remove = async () => { if (draft.id && (await confirmAction({ message: 'Delete this post?', danger: true, confirmLabel: 'Delete' }))) { await supabase.from('social_posts').delete().eq('id', draft.id); onSaved(); } };

  return (
    <ModalShell title={draft.id ? 'Edit Post' : 'New Post'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Single teaser clip" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Platform</label>
            <select className={inputCls} value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })}>
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              {POST_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Client / Artist</label>
            <select className={inputCls} value={draft.client_id || ''} onChange={(e) => setDraft({ ...draft, client_id: e.target.value || null })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Scheduled</label>
            <input type="datetime-local" className={inputCls} value={dateValue} onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Caption</label>
          <textarea rows={3} className={`${inputCls} resize-none`} value={draft.caption || ''} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="Caption / hashtags…" />
        </div>
        <div>
          <label className={labelCls}>Link (smart link / presave)</label>
          <input className={inputCls} value={draft.link_url || ''} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://…" />
        </div>
        <div className="flex items-center justify-between pt-2">
          {draft.id ? <button onClick={remove} className="text-[10px] font-black uppercase tracking-widest text-red-400/70 hover:text-red-400 flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Delete</button> : <span />}
          <button onClick={save} className="px-6 py-2.5 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all cursor-pointer">Save</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* 2) Rollout Tracker                                                  */
/* ================================================================== */
type Campaign = { id: string; client_id?: string | null; name: string; release_date?: string | null; status?: string; notes?: string };
type CTask = { id: string; campaign_id: string; phase: string; task: string; owner?: string; due_date?: string | null; is_done?: boolean };

function RolloutTracker({ clients }: { clients: Client[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [tasks, setTasks] = useState<CTask[]>([]);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase.from('social_campaigns').select('*').order('created_at', { ascending: false });
    const list = (data || []) as Campaign[];
    setCampaigns(list);
    setActiveId((cur) => cur || (list[0]?.id ?? ''));
  }, []);
  useEffect(() => { void (async () => { await loadCampaigns(); })(); }, [loadCampaigns]);

  const loadTasks = useCallback(async () => {
    if (!activeId) { setTasks([]); return; }
    const { data } = await supabase.from('social_campaign_tasks').select('*').eq('campaign_id', activeId).order('sort_order');
    setTasks((data || []) as CTask[]);
  }, [activeId]);
  useEffect(() => { void (async () => { await loadTasks(); })(); }, [loadTasks]);

  const addCampaign = async () => {
    const name = prompt('Campaign / release name (e.g. "If I Believed — Single"):');
    if (!name) return;
    const { data } = await supabase.from('social_campaigns').insert([{ name }]).select().single();
    if (data) { setCampaigns((c) => [data as Campaign, ...c]); setActiveId((data as Campaign).id); }
  };
  const patchCampaign = async (patch: Partial<Campaign>) => {
    if (!activeId) return;
    setCampaigns((cs) => cs.map((c) => (c.id === activeId ? { ...c, ...patch } : c)));
    await supabase.from('social_campaigns').update(patch).eq('id', activeId);
  };
  const deleteCampaign = async () => {
    if (!activeId || !(await confirmAction({ message: 'Delete this campaign and its tasks?', danger: true, confirmLabel: 'Delete' }))) return;
    await supabase.from('social_campaigns').delete().eq('id', activeId);
    setCampaigns((cs) => cs.filter((c) => c.id !== activeId));
    setActiveId('');
  };

  const addTask = async (phase: string) => {
    const { data } = await supabase.from('social_campaign_tasks').insert([{ campaign_id: activeId, phase, task: '', sort_order: tasks.length }]).select().single();
    if (data) setTasks((t) => [...t, data as CTask]);
  };
  const patchTask = async (id: string, patch: Partial<CTask>) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from('social_campaign_tasks').update(patch).eq('id', id);
  };
  const delTask = async (id: string) => { setTasks((ts) => ts.filter((t) => t.id !== id)); await supabase.from('social_campaign_tasks').delete().eq('id', id); };

  const active = campaigns.find((c) => c.id === activeId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select className={`${inputCls} max-w-xs`} value={activeId} onChange={(e) => setActiveId(e.target.value)}>
          <option value="">— Select campaign —</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={addCampaign} className="px-3 py-2 bg-accent/15 border border-accent/40 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Campaign</button>
        {active && <button aria-label="Delete campaign" title="Delete campaign" onClick={deleteCampaign} className="px-3 py-2 bg-white/5 border border-white/10 text-red-400/70 hover:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>

      {!active ? (
        <Empty icon={Megaphone} text="Create a campaign to map its teaser → release → post-release rollout." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div>
              <label className={labelCls}>Client / Artist</label>
              <select className={inputCls} value={active.client_id || ''} onChange={(e) => patchCampaign({ client_id: e.target.value || null })}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Release Date</label>
              <input type="date" className={inputCls} value={active.release_date || ''} onChange={(e) => patchCampaign({ release_date: e.target.value || null })} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <input className={inputCls} value={active.status || ''} onChange={(e) => patchCampaign({ status: e.target.value })} placeholder="planning / live / wrapped" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PHASES.map((ph) => {
              const phaseTasks = tasks.filter((t) => t.phase === ph.key);
              return (
                <div key={ph.key} className="bg-white/[0.02] border border-white/10 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">{ph.label}</span>
                    <button onClick={() => addTask(ph.key)} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-accent cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="space-y-2">
                    {phaseTasks.map((t) => (
                      <div key={t.id} className="bg-black/30 border border-white/5 rounded-lg p-2 group">
                        <div className="flex items-start gap-2">
                          <button onClick={() => patchTask(t.id, { is_done: !t.is_done })} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${t.is_done ? 'bg-emerald-500/80 border-emerald-400' : 'border-white/20'}`}>
                            {t.is_done && <Check className="w-3 h-3 text-black" />}
                          </button>
                          <input
                            className={`flex-1 bg-transparent outline-none text-[11px] ${t.is_done ? 'line-through text-white/40' : 'text-white/90'}`}
                            value={t.task}
                            placeholder="Task…"
                            onChange={(e) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, task: e.target.value } : x)))}
                            onBlur={(e) => patchTask(t.id, { task: e.target.value })}
                          />
                          <button onClick={() => delTask(t.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 pl-6">
                          <input className="bg-transparent border-b border-white/10 outline-none text-[11px] md:text-[9px] text-white/50 w-20 focus:border-accent" value={t.owner || ''} placeholder="owner" onChange={(e) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, owner: e.target.value } : x)))} onBlur={(e) => patchTask(t.id, { owner: e.target.value })} />
                          <input type="date" className="bg-transparent outline-none text-[11px] md:text-[9px] text-white/50 focus:text-white" value={t.due_date || ''} onChange={(e) => patchTask(t.id, { due_date: e.target.value || null })} />
                        </div>
                      </div>
                    ))}
                    {phaseTasks.length === 0 && <p className="text-[11px] md:text-[9px] text-white/20 text-center py-3 uppercase tracking-widest font-bold">No tasks</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* 3) Deliverables                                                     */
/* ================================================================== */
type Deliv = { id: string; client_id?: string | null; label?: string; format?: string; duration?: string; platform?: string; status?: string };

function Deliverables({ clients }: { clients: Client[] }) {
  const [rows, setRows] = useState<Deliv[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('social_deliverables').select('*').order('created_at', { ascending: false });
    setRows((data || []) as Deliv[]);
  }, []);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  const add = async () => {
    const { data } = await supabase.from('social_deliverables').insert([{ label: '', format: '9:16', platform: 'instagram', status: 'todo' }]).select().single();
    if (data) setRows((r) => [data as Deliv, ...r]);
  };
  const patch = async (id: string, p: Partial<Deliv>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r))); await supabase.from('social_deliverables').update(p).eq('id', id); };
  const del = async (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); await supabase.from('social_deliverables').delete().eq('id', id); };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Cutdowns &amp; platform versions</p>
        <button onClick={add} className="px-3 py-2 bg-accent/15 border border-accent/40 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Deliverable</button>
      </div>
      {rows.length === 0 ? (
        <Empty icon={Film} text="Track each cutdown (9:16 Reel, 1:1, 16:9 YouTube…) and its delivery status." />
      ) : (
        <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/[0.03]">
              <tr>{['Label', 'Client', 'Format', 'Duration', 'Platform', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 group">
                  <td className="px-2 py-1 min-w-[160px]"><input className="w-full bg-transparent outline-none text-[11px] text-white/90 px-1 py-1 focus:bg-accent/5" value={r.label || ''} placeholder="e.g. Hook clip" onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))} onBlur={(e) => patch(r.id, { label: e.target.value })} /></td>
                  <td className="px-2 py-1">
                    <select className="bg-transparent outline-none text-[11px] text-white/70 cursor-pointer" value={r.client_id || ''} onChange={(e) => patch(r.id, { client_id: e.target.value || null })}>
                      <option value="" className="bg-zinc-900">—</option>
                      {clients.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1"><select className="bg-transparent outline-none text-[11px] text-white/70 cursor-pointer" value={r.format} onChange={(e) => patch(r.id, { format: e.target.value })}>{DELIVERABLE_FORMATS.map((f) => <option key={f} value={f} className="bg-zinc-900">{f}</option>)}</select></td>
                  <td className="px-2 py-1 min-w-[80px]"><input className="w-16 bg-transparent outline-none text-[11px] text-white/70 px-1 focus:bg-accent/5" value={r.duration || ''} placeholder="30s" onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, duration: e.target.value } : x)))} onBlur={(e) => patch(r.id, { duration: e.target.value })} /></td>
                  <td className="px-2 py-1"><select className="bg-transparent outline-none text-[11px] text-white/70 cursor-pointer" value={r.platform} onChange={(e) => patch(r.id, { platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p.key} value={p.key} className="bg-zinc-900">{p.label}</option>)}</select></td>
                  <td className="px-2 py-1"><button onClick={() => patch(r.id, { status: nextDeliverableStatus(r.status) })} className={`px-2 py-1 rounded border text-[11px] md:text-[8px] font-black uppercase tracking-widest cursor-pointer ${deliverableStatusTone(r.status)}`}>{deliverableStatusLabel(r.status)}</button></td>
                  <td className="px-2 py-1 text-right"><button onClick={() => del(r.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* 4) Link Hub + Caption Library                                       */
/* ================================================================== */
type SLink = { id: string; client_id?: string | null; kind?: string; label?: string; url?: string; body?: string; tags?: string };

function LinkHub({ clients }: { clients: Client[] }) {
  const [items, setItems] = useState<SLink[]>([]);
  const [copied, setCopied] = useState<string>('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('social_links').select('*').order('created_at', { ascending: false });
    setItems((data || []) as SLink[]);
  }, []);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  const add = async (kind: 'link' | 'caption') => {
    const { data } = await supabase.from('social_links').insert([{ kind, label: '' }]).select().single();
    if (data) setItems((i) => [data as SLink, ...i]);
  };
  const patch = async (id: string, p: Partial<SLink>) => { setItems((is) => is.map((x) => (x.id === id ? { ...x, ...p } : x))); await supabase.from('social_links').update(p).eq('id', id); };
  const del = async (id: string) => { setItems((is) => is.filter((x) => x.id !== id)); await supabase.from('social_links').delete().eq('id', id); };
  const copy = (id: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 1200); };
  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name;

  const links = items.filter((i) => (i.kind || 'link') === 'link');
  const captions = items.filter((i) => i.kind === 'caption');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Links */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Link Hub</span>
          <button onClick={() => add('link')} className="p-1.5 rounded-lg bg-white/5 hover:bg-accent/15 text-white/50 hover:text-accent cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-2">
          {links.length === 0 && <Empty icon={Link2} text="Presave links, smart links, link-in-bio URLs per client." />}
          {links.map((l) => (
            <div key={l.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 group">
              <div className="flex items-center gap-2 mb-1.5">
                <input className="flex-1 bg-transparent outline-none text-xs font-bold text-white/90" value={l.label || ''} placeholder="Label" onChange={(e) => setItems((is) => is.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} onBlur={(e) => patch(l.id, { label: e.target.value })} />
                <ClientSelect value={l.client_id} clients={clients} onChange={(v) => patch(l.id, { client_id: v })} />
                <button onClick={() => del(l.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-1.5">
                <input className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-accent/80 outline-none focus:border-accent" value={l.url || ''} placeholder="https://…" onChange={(e) => setItems((is) => is.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} onBlur={(e) => patch(l.id, { url: e.target.value })} />
                {l.url && sanitizeUrl(l.url) && <a href={sanitizeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-white/40 hover:text-accent cursor-pointer"><ExternalLink className="w-3.5 h-3.5" /></a>}
                <button onClick={() => copy(l.id, l.url || '')} className="p-1.5 text-white/40 hover:text-accent cursor-pointer">{copied === l.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
              </div>
              {clientName(l.client_id) && <span className="text-[11px] md:text-[8px] font-bold uppercase tracking-widest text-white/30 mt-1 block">{clientName(l.client_id)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Captions */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5"><Quote className="w-3.5 h-3.5" /> Caption Library</span>
          <button onClick={() => add('caption')} className="p-1.5 rounded-lg bg-white/5 hover:bg-accent/15 text-white/50 hover:text-accent cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-2">
          {captions.length === 0 && <Empty icon={Quote} text="Reusable captions &amp; hashtag blocks per client." />}
          {captions.map((c) => (
            <div key={c.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 group">
              <div className="flex items-center gap-2 mb-1.5">
                <input className="flex-1 bg-transparent outline-none text-xs font-bold text-white/90" value={c.label || ''} placeholder="Label" onChange={(e) => setItems((is) => is.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))} onBlur={(e) => patch(c.id, { label: e.target.value })} />
                <ClientSelect value={c.client_id} clients={clients} onChange={(v) => patch(c.id, { client_id: v })} />
                <button onClick={() => copy(c.id, c.body || '')} className="text-white/40 hover:text-accent cursor-pointer">{copied === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <textarea rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-accent resize-none" value={c.body || ''} placeholder="Caption / hashtags…" onChange={(e) => setItems((is) => is.map((x) => (x.id === c.id ? { ...x, body: e.target.value } : x)))} onBlur={(e) => patch(c.id, { body: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */
function ClientSelect({ value, clients, onChange }: { value?: string | null; clients: Client[]; onChange: (v: string | null) => void }) {
  return (
    <select className="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[11px] md:text-[9px] text-white/60 outline-none cursor-pointer max-w-[110px]" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="" className="bg-zinc-900">No client</option>
      {clients.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
    </select>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-12 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center">
      <Icon className="w-8 h-8 mb-3 text-accent" />
      <p className="text-[10px] font-black uppercase tracking-widest max-w-xs">{text}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
          <h2 className="text-lg font-black uppercase tracking-tighter text-white">{title}</h2>
          <button aria-label="Close" title="Close" onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
