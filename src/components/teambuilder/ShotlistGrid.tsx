'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Plus, Trash2, Film, Camera, GripVertical, Link2, Image as ImageIcon,
  ChevronDown, ChevronRight, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { JobShot, JobScene } from '@/components/gearbuilder/types';
import { sanitizeUrl } from '@/lib/sanitize';
import { confirmAction } from '@/components/Feedback';

// Common option hints for the free-text dropdowns (matching the producer's sheet)
const MOVEMENT_OPTS = ['Static', 'Handheld', 'Steadicam', 'Drone', 'Gimbal', 'Slider', 'Dolly', 'Pan', 'Tilt', 'Multi'];
const EQUIPMENT_OPTS = ['Sticks / Tripod', 'Steadicam', 'Drone', 'Gimbal', 'Slider', 'Handheld', 'Dolly', 'Crane'];
const LENS_OPTS = ['24-70mm', '70-200mm', '16-35mm', '35mm', '50mm', '85mm', '24mm', 'TBD'];

/* ------------------------------------------------------------------ */
/* Editable cell — keeps local state so autosave never steals focus    */
/* ------------------------------------------------------------------ */
function Cell({
  value, onCommit, placeholder, options, multiline, className = '', mono,
}: {
  value?: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  options?: string[];
  multiline?: boolean;
  className?: string;
  mono?: boolean;
}) {
  const [local, setLocal] = useState(value ?? '');
  // Re-sync local state when the committed value changes externally, during
  // render (React's recommended pattern — avoids setState-in-effect).
  const [seen, setSeen] = useState(value ?? '');
  if ((value ?? '') !== seen) {
    setSeen(value ?? '');
    setLocal(value ?? '');
  }
  const listId = useId();

  const commit = () => { if (local !== (value ?? '')) onCommit(local); };

  const base = `w-full bg-transparent outline-none text-[11px] text-white/90 placeholder:text-white/20 px-2 py-1.5 focus:bg-accent/5 ${mono ? 'font-mono' : ''} ${className}`;

  if (multiline) {
    return (
      <textarea
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        rows={2}
        className={`${base} resize-none leading-snug`}
      />
    );
  }

  return (
    <>
      <input
        value={local}
        placeholder={placeholder}
        list={options ? listId : undefined}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={base}
      />
      {options && (
        <datalist id={listId}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </>
  );
}

const COLS: { key: keyof JobShot; label: string; w: string; opts?: string[]; multi?: boolean }[] = [
  { key: 'timing', label: 'Timing', w: 'min-w-[90px]' },
  { key: 'shot_number', label: 'Shot #', w: 'min-w-[64px]' },
  { key: 'subject', label: 'Subject', w: 'min-w-[120px]' },
  { key: 'description', label: 'Description', w: 'min-w-[180px]', multi: true },
  { key: 'movement', label: 'Movement', w: 'min-w-[110px]', opts: MOVEMENT_OPTS },
  { key: 'equipment', label: 'Equipment', w: 'min-w-[120px]', opts: EQUIPMENT_OPTS },
  { key: 'lens', label: 'Lens', w: 'min-w-[90px]', opts: LENS_OPTS },
  { key: 'timecode', label: 'Timecode', w: 'min-w-[100px]' },
  { key: 'lyrics', label: 'Lyrics', w: 'min-w-[150px]', multi: true },
  { key: 'notes', label: 'Notes', w: 'min-w-[200px]', multi: true },
  { key: 'take_best', label: 'Take (best)', w: 'min-w-[90px]' },
  { key: 'est_takes', label: 'Est. #', w: 'min-w-[60px]' },
];

export default function ShotlistGrid({ jobId }: { jobId: string }) {
  const [scenes, setScenes] = useState<JobScene[]>([]);
  const [shots, setShots] = useState<JobShot[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /* -------------------- load + one-time backfill -------------------- */
  const load = useCallback(async () => {
    if (!jobId) { setScenes([]); setShots([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: sc }, { data: sh }] = await Promise.all([
        supabase.from('job_scenes').select('*').eq('job_id', jobId).order('sort_order'),
        supabase.from('job_shotlist').select('*').eq('job_id', jobId).order('sort_order'),
      ]);

      let sceneRows = (sc || []) as JobScene[];
      const shotRows = (sh || []) as JobShot[];

      // Backfill: if a job has shots but no scene rows yet, create scenes from
      // the legacy scene_group text and link the shots. Runs once per job.
      if (sceneRows.length === 0) {
        const groups = Array.from(new Set(shotRows.map((s) => s.scene_group || 'Scene 1')));
        if (groups.length === 0) groups.push('Scene 1');
        const inserts = groups.map((g, i) => ({ job_id: jobId, setup_number: String(i + 1), name: g, sort_order: i }));
        const { data: created } = await supabase.from('job_scenes').insert(inserts).select();
        sceneRows = (created || []) as JobScene[];
        // Link existing shots to their scene by matching name
        for (const shot of shotRows) {
          const match = sceneRows.find((sc2) => sc2.name === (shot.scene_group || 'Scene 1'));
          if (match) {
            await supabase.from('job_shotlist').update({ scene_id: match.id }).eq('id', shot.id);
            shot.scene_id = match.id;
          }
        }
      }

      setScenes(sceneRows);
      setShots(shotRows);
    } catch (err) {
      console.error('[ShotlistGrid] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  /* -------------------- shot mutations -------------------- */
  const patchShot = async (id: string, patch: Partial<JobShot>) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('job_shotlist').update(patch).eq('id', id);
    if (error) console.error('[ShotlistGrid] patchShot failed:', error);
  };

  const addShot = async (sceneId: string) => {
    const sceneShots = shots.filter((s) => s.scene_id === sceneId);
    const scene = scenes.find((s) => s.id === sceneId);
    const row = {
      job_id: jobId,
      scene_id: sceneId,
      scene_group: scene?.name || 'Scene 1',
      description: '',
      priority: 'must',
      sort_order: shots.length,
    };
    const { data, error } = await supabase.from('job_shotlist').insert([row]).select().single();
    if (error) { console.error('[ShotlistGrid] addShot failed:', error); return; }
    // Keep new row visually within its scene by inserting after the scene's last shot
    setShots((prev) => {
      const next = [...prev];
      const lastIdx = sceneShots.length ? next.indexOf(sceneShots[sceneShots.length - 1]) : -1;
      next.splice(lastIdx + 1, 0, data as JobShot);
      return next;
    });
  };

  const deleteShot = async (id: string) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('job_shotlist').delete().eq('id', id);
  };

  /* -------------------- scene mutations -------------------- */
  const patchScene = async (id: string, patch: Partial<JobScene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('job_scenes').update(patch).eq('id', id);
    if (error) console.error('[ShotlistGrid] patchScene failed:', error);
  };

  const addScene = async () => {
    const row = { job_id: jobId, setup_number: String(scenes.length + 1), name: `Scene ${scenes.length + 1}`, sort_order: scenes.length };
    const { data, error } = await supabase.from('job_scenes').insert([row]).select().single();
    if (error) { console.error('[ShotlistGrid] addScene failed:', error); return; }
    setScenes((prev) => [...prev, data as JobScene]);
  };

  const deleteScene = async (id: string) => {
    if (!(await confirmAction({ message: 'Delete this scene and all of its shots?', danger: true, confirmLabel: 'Delete' }))) return;
    setScenes((prev) => prev.filter((s) => s.id !== id));
    setShots((prev) => prev.filter((s) => s.scene_id !== id));
    await supabase.from('job_shotlist').delete().eq('scene_id', id);
    await supabase.from('job_scenes').delete().eq('id', id);
  };

  /* -------------------- render -------------------- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!jobId) {
    return (
      <div className="py-24 text-center opacity-30 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center min-h-[300px]">
        <Film className="w-10 h-10 mb-4 text-accent" />
        <p className="text-xs font-black uppercase tracking-widest">Select a production to build its shotlist.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-8">
      {scenes.map((scene) => {
        const sceneShots = shots.filter((s) => s.scene_id === scene.id);
        const isCollapsed = collapsed[scene.id];
        return (
          <div key={scene.id} className="border border-white/10 rounded-2xl overflow-hidden bg-zinc-950/40">
            {/* Scene header */}
            <div className="bg-white/[0.03] border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [scene.id]: !c[scene.id] }))}
                  className="p-1 hover:bg-white/10 rounded text-white/50 cursor-pointer shrink-0"
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <span className="text-[9px] font-black uppercase tracking-widest text-accent/70 shrink-0">Setup</span>
                <div className="w-12 shrink-0 border border-white/10 rounded">
                  <Cell value={scene.setup_number} onCommit={(v) => patchScene(scene.id, { setup_number: v })} placeholder="#" className="text-center font-black text-accent" />
                </div>
                <div className="min-w-[140px] flex-1 border border-white/10 rounded">
                  <Cell value={scene.name} onCommit={(v) => patchScene(scene.id, { name: v })} placeholder="SCENE NAME" className="font-black uppercase tracking-wide" />
                </div>
                <div className="w-32 shrink-0 border border-white/10 rounded">
                  <Cell value={scene.timecode} onCommit={(v) => patchScene(scene.id, { timecode: v })} placeholder="TIMECODE" mono />
                </div>
                <div className="min-w-[180px] flex-[2] border border-white/10 rounded">
                  <Cell value={scene.description} onCommit={(v) => patchScene(scene.id, { description: v })} placeholder="DESCRIPTION" />
                </div>
                <div className="flex items-center gap-1 shrink-0 border border-white/10 rounded px-1">
                  <span className="text-[8px] font-black uppercase text-white/30 pl-1">Est.</span>
                  <div className="w-14">
                    <Cell value={scene.est_minutes} onCommit={(v) => patchScene(scene.id, { est_minutes: v })} placeholder="45 min" className="text-center" />
                  </div>
                </div>
                <button
                  onClick={() => deleteScene(scene.id)}
                  className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-white/30 cursor-pointer shrink-0"
                  title="Delete scene"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-black/30">
                      <th className="w-8" />
                      <th className="px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 text-center w-12">Pri</th>
                      {COLS.map((c) => (
                        <th key={c.key as string} className={`px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 ${c.w}`}>{c.label}</th>
                      ))}
                      <th className="px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 min-w-[120px]">Animation</th>
                      <th className="px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 text-center w-14">Img</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sceneShots.map((shot) => (
                      <tr key={shot.id} className="border-t border-white/5 hover:bg-white/[0.015] align-top group">
                        <td className="text-center text-white/15"><GripVertical className="w-3.5 h-3.5 mx-auto" /></td>
                        <td className="text-center">
                          <button
                            onClick={() => patchShot(shot.id, { priority: shot.priority === 'nice' ? 'must' : 'nice' })}
                            title={shot.priority === 'nice' ? 'Nice-to-have' : 'Must-get'}
                            className="p-1 cursor-pointer"
                          >
                            <Star className={`w-3.5 h-3.5 mx-auto ${shot.priority === 'nice' ? 'text-white/20' : 'text-amber-400 fill-amber-400'}`} />
                          </button>
                        </td>
                        {COLS.map((c) => (
                          <td key={c.key as string} className={`border-l border-white/5 ${c.w}`}>
                            <Cell
                              value={(shot[c.key] as string) || ''}
                              onCommit={(v) => patchShot(shot.id, { [c.key]: v } as Partial<JobShot>)}
                              options={c.opts}
                              multiline={c.multi}
                            />
                          </td>
                        ))}
                        {/* Animation link (label + url) */}
                        <td className="border-l border-white/5 min-w-[120px]">
                          <Cell value={shot.animation_label} onCommit={(v) => patchShot(shot.id, { animation_label: v })} placeholder="Label" />
                          <div className="flex items-center gap-1 px-1 pb-1">
                            <Link2 className="w-3 h-3 text-white/20 shrink-0" />
                            <Cell value={shot.animation_link} onCommit={(v) => patchShot(shot.id, { animation_link: v })} placeholder="https://…" className="text-[10px] text-accent/80" />
                          </div>
                          {shot.animation_link && sanitizeUrl(shot.animation_link) && (
                            <a href={sanitizeUrl(shot.animation_link)} target="_blank" rel="noopener noreferrer" className="text-[8px] text-accent/60 hover:text-accent underline px-2">open ↗</a>
                          )}
                        </td>
                        {/* Optional thumbnail */}
                        <td className="border-l border-white/5 text-center px-1 py-1">
                          {shot.image_url ? (
                            <img src={shot.image_url} alt="" className="w-12 h-8 object-cover rounded mx-auto border border-white/10" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                          ) : null}
                          <button
                            onClick={() => {
                              const url = prompt('Storyboard image URL (optional):', shot.image_url || '');
                              if (url !== null) patchShot(shot.id, { image_url: url });
                            }}
                            className="text-[8px] text-white/30 hover:text-accent flex items-center gap-0.5 mx-auto mt-0.5 cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" /> {shot.image_url ? 'edit' : 'add'}
                          </button>
                        </td>
                        <td className="text-center">
                          <button onClick={() => deleteShot(shot.id)} className="p-1 text-white/15 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer" title="Delete shot">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Scene footer: add row + scene notes */}
                <div className="flex items-stretch gap-3 px-3 py-2 border-t border-white/10 bg-black/20">
                  <button onClick={() => addShot(scene.id)} className="px-3 py-1.5 bg-white/5 hover:bg-accent/15 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-white/70 hover:text-accent flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Plus className="w-3 h-3" /> Add Shot
                  </button>
                  <div className="flex-1 flex items-center gap-2 border border-white/10 rounded-lg">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30 pl-2 shrink-0">Scene Notes</span>
                    <Cell value={scene.notes} onCommit={(v) => patchScene(scene.id, { notes: v })} placeholder="Notes for this scene…" />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addScene} className="w-full py-3 border border-dashed border-white/15 hover:border-accent/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-accent flex items-center justify-center gap-2 cursor-pointer transition-colors">
        <Plus className="w-4 h-4" /> Add Scene / Setup
      </button>

      {scenes.length === 0 && (
        <div className="py-16 text-center opacity-30 flex flex-col items-center">
          <Camera className="w-10 h-10 mb-3 text-accent" />
          <p className="text-xs font-black uppercase tracking-widest">No scenes yet — add one to start your shotlist.</p>
        </div>
      )}
    </div>
  );
}
