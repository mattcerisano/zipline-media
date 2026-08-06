'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, Loader2, FolderKanban, Building2, Package, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast, confirmAction, promptAction } from '@/components/Feedback';
import { useRealtime } from '@/lib/useRealtime';

/**
 * Library — the reference data behind everything else.
 *
 * Projects, clients and the gear catalog were all created as side effects of
 * other screens and then stranded there: a project could only be made from
 * inside the production form and never renamed or removed, and the inventory
 * that the whole Gear Builder reads had no editor at all, so adding a lens
 * meant opening Supabase.
 *
 * Deletes here are safe by construction: every foreign key pointing at these
 * tables is ON DELETE SET NULL, so removing a client unlinks its shoots rather
 * than deleting them. The confirm still says how many rows it will unlink,
 * because "safe" is not the same as "expected".
 */

type EntityKey = 'projects' | 'clients' | 'inventory';

interface Row {
  id: string;
  name: string;
  /** Secondary line: client name, category, whatever identifies the row. */
  detail?: string;
  /** How many productions point at this row. Undefined when not applicable. */
  usage?: number;
  raw: Record<string, any>;
}

const ENTITIES: {
  key: EntityKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Column the free-text rename writes to. */
  nameField: string;
  addLabel: string;
  /** Shown under the confirm when rows are removed. */
  unlinkNote?: string;
}[] = [
  { key: 'projects', label: 'Projects', icon: FolderKanban, nameField: 'name', addLabel: 'Add project', unlinkNote: 'Productions in these projects stay — they just lose the project tag.' },
  { key: 'clients', label: 'Clients', icon: Building2, nameField: 'name', addLabel: 'Add client', unlinkNote: 'Productions for these clients stay — they just lose the client link.' },
  { key: 'inventory', label: 'Inventory', icon: Package, nameField: 'name', addLabel: 'Add gear item' },
];

const inputClass =
  'w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 outline-none focus:border-accent text-xs text-white placeholder:text-white/25';

export default function LibraryWidget() {
  const [entity, setEntity] = useState<EntityKey>('projects');
  const [rows, setRows] = useState<Record<EntityKey, Row[]>>({ projects: [], clients: [], inventory: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /** Inventory rows with no primary key — listed but not editable. */
  const [unkeyed, setUnkeyed] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // Jobs come along so each row can show what depends on it. Without that
      // number, deleting is a guess about what you're about to unpick.
      const [projRes, cliRes, invRes, jobRes] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('inventory').select('*').order('name'),
        supabase.from('jobs').select('id, client_id, project_id'),
      ]);

      if (projRes.error) throw projRes.error;
      if (cliRes.error) throw cliRes.error;
      if (invRes.error) throw invRes.error;

      const jobs = jobRes.data || [];
      const byProject = new Map<string, number>();
      const byClient = new Map<string, number>();
      for (const j of jobs as any[]) {
        if (j.project_id) byProject.set(j.project_id, (byProject.get(j.project_id) || 0) + 1);
        if (j.client_id) byClient.set(j.client_id, (byClient.get(j.client_id) || 0) + 1);
      }

      const clientName = new Map((cliRes.data || []).map((c: any) => [c.id, c.name]));
      const unkeyedInventory = (invRes.data || []).filter((i: any) => !i.id).length;
      setUnkeyed(unkeyedInventory);

      setRows({
        projects: (projRes.data || []).map((p: any) => ({
          id: p.id,
          name: p.name || '',
          detail: p.client_id ? clientName.get(p.client_id) || '' : '',
          usage: byProject.get(p.id) || 0,
          raw: p,
        })),
        clients: (cliRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name || '',
          detail: c.email || '',
          usage: byClient.get(c.id) || 0,
          raw: c,
        })),
        // The inventory table predates the migrations and was created by hand,
        // so an id column isn't guaranteed. Rename and delete both address rows
        // by id; a row without one can't be edited safely, so it's dropped here
        // and counted rather than rendered as a control that silently no-ops.
        inventory: (invRes.data || [])
          .filter((i: any) => !!i.id)
          .map((i: any) => ({
            id: i.id as string,
            name: i.name || '',
            detail: [i.category, i.owner].filter(Boolean).join(' · '),
            raw: i,
          })),
      });
    } catch (err: any) {
      console.error('Library load failed:', err);
      setLoadError(err?.message || 'Could not load the library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtime(['projects', 'clients', 'inventory', 'jobs'], load);

  // Switching tabs must drop the selection: ids from the previous table would
  // otherwise still be armed for the next delete.
  const switchEntity = (key: EntityKey) => {
    setEntity(key);
    setSelected(new Set());
    setSearch('');
  };

  const meta = ENTITIES.find(e => e.key === entity)!;
  const current = rows[entity];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return current;
    return current.filter(r =>
      r.name.toLowerCase().includes(q) || (r.detail || '').toLowerCase().includes(q)
    );
  }, [current, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Select-all applies to what's on screen, not the whole table — ticking the
  // box while a search is active must never arm rows you can't see.
  const allVisibleSelected = visible.length > 0 && visible.every(r => selected.has(r.id));
  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach(r => next.delete(r.id));
      else visible.forEach(r => next.add(r.id));
      return next;
    });
  };

  const add = async () => {
    const name = await promptAction({
      title: meta.addLabel,
      message: entity === 'inventory'
        ? 'Added to the gear catalog. Category and quantity can be set after.'
        : undefined,
      label: 'Name',
      placeholder: entity === 'inventory' ? 'e.g. Canon C400' : 'e.g. Moulin Rouge Campaign',
    });
    if (!name?.trim()) return;

    setBusy(true);
    try {
      const payload: Record<string, any> = { name: name.trim() };
      // inventory.qty is NOT NULL in the catalog the Gear Builder reads, so a
      // bare {name} insert would be rejected.
      if (entity === 'inventory') { payload.category = 'Specialty'; payload.qty = 1; payload.replacement = 0; }
      const { error } = await supabase.from(entity).insert([payload]);
      if (error) throw error;
      await load();
    } catch (err: any) {
      toast(`Could not add: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (row: Row, value: string) => {
    const next = value.trim();
    if (!next || next === row.name) return;
    setRows(prev => ({ ...prev, [entity]: prev[entity].map(r => (r.id === row.id ? { ...r, name: next } : r)) }));
    const { error } = await supabase.from(entity).update({ [meta.nameField]: next }).eq('id', row.id);
    if (error) {
      toast(`Rename failed: ${error.message}`);
      void load();
    }
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    const picked = current.filter(r => ids.includes(r.id));
    const linked = picked.reduce((sum, r) => sum + (r.usage || 0), 0);

    const ok = await confirmAction({
      title: `Delete ${ids.length} ${ids.length === 1 ? meta.label.replace(/s$/, '') : meta.label}?`.toLowerCase(),
      message: linked > 0
        ? `${linked} production${linked === 1 ? '' : 's'} reference ${ids.length === 1 ? 'this' : 'these'}. ${meta.unlinkNote || ''}`
        : 'Nothing references these. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const { error } = await supabase.from(entity).delete().in('id', ids);
      if (error) throw error;
      setSelected(new Set());
      await load();
      toast(`Deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}.`);
    } catch (err: any) {
      toast(`Delete failed: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black text-white">
      {/* Header: entity tabs + search */}
      <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Library</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${meta.label.toLowerCase()}…`}
              aria-label={`Search ${meta.label}`}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ENTITIES.map(e => {
            const Icon = e.icon;
            const active = e.key === entity;
            return (
              <button
                key={e.key}
                type="button"
                onClick={() => switchEntity(e.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                  active
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {e.label}
                <span className="opacity-50">{rows[e.key].length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={visible.length === 0}
            className="accent-[var(--accent)]"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={removeSelected}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size}
            </button>
          )}
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[10px] font-black uppercase tracking-widest hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> {meta.addLabel}
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
        ) : loadError ? (
          <div className="py-20 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-400/70 mx-auto" />
            <p className="text-xs text-white/70">{loadError}</p>
          </div>
        ) : entity === 'inventory' && unkeyed > 0 && visible.length === 0 ? (
          <div className="py-20 text-center space-y-2 px-6">
            <AlertCircle className="w-8 h-8 text-amber-400/70 mx-auto" />
            <p className="text-[11px] text-white/60 leading-relaxed max-w-sm mx-auto">
              {unkeyed} gear {unkeyed === 1 ? 'item has' : 'items have'} no id column, so they can&rsquo;t be edited here.
              The inventory table needs a primary key before the Library can manage it.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-[11px] text-white/40">
              {search
                ? `Nothing in ${meta.label.toLowerCase()} matches “${search}”.`
                : `No ${meta.label.toLowerCase()} yet.`}
            </p>
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-[10px] text-accent hover:underline uppercase tracking-widest font-bold">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {visible.map(row => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] group">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={`Select ${row.name || 'untitled'}`}
                  className="accent-[var(--accent)] shrink-0"
                />

                <input
                  defaultValue={row.name}
                  key={`${row.id}-${row.name}`}
                  aria-label="Name"
                  onBlur={e => rename(row, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/90 rounded px-1.5 py-1 focus:bg-white/10"
                />

                {row.detail && (
                  <span className="text-[10px] text-white/35 truncate max-w-[30%] shrink-0">{row.detail}</span>
                )}

                {row.usage !== undefined && (
                  <span className="text-[10px] text-white/25 shrink-0 tabular-nums w-20 text-right">
                    {row.usage} {row.usage === 1 ? 'shoot' : 'shoots'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta.unlinkNote && (
        <p className="px-4 py-2 text-[9px] text-white/25 border-t border-white/5 shrink-0">
          Deleting never removes productions — they only lose the link.
        </p>
      )}
    </div>
  );
}
