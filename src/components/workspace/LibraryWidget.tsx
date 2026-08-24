'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, Loader2, FolderKanban, Building2, Package, Clapperboard, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast, confirmAction, promptAction } from '@/components/Feedback';
import { useRealtime } from '@/lib/useRealtime';
import { pushJobToGoogleCalendar, removeJobFromGoogleCalendar } from '@/lib/calendar-push';
import { formatLocalDate } from '@/lib/date';

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

type EntityKey = 'projects' | 'clients' | 'inventory' | 'jobs';

interface Row {
  id: string;
  type: EntityKey;
  name: string;
  /** Secondary line: client name, category, whatever identifies the row. */
  detail?: string;
  /** How many productions point at this row. Undefined when not applicable. */
  usage?: number;
  /** Right-hand number and its unit — shoots for projects/clients, qty for gear. */
  count?: number;
  countUnit?: string;
  /** Bucket a category sort groups by. */
  group?: string;
  /** Right-aligned text for rows that have no meaningful count (a shoot date). */
  trailing?: string;
  /** Clients only: looks like a Rolodex contact that became a client by accident. */
  stray?: boolean;
  raw: Record<string, any>;
}

/**
 * Sort options per entity.
 *
 * `group: true` turns the list into sections headed by the sort value — the
 * point of sorting a 250-item gear catalog by category is to see the lenses
 * together, which a flat ordered list makes you infer from adjacency.
 */
interface SortOption {
  key: string;
  label: string;
  compare: (a: Row, b: Row) => number;
  group?: boolean;
}

const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
/** Blank sorts last: an uncategorised item is noise at the top of a list. */
const byText = (get: (r: Row) => string) => (a: Row, b: Row) => {
  const x = get(a).trim(), y = get(b).trim();
  if (!x && !y) return byName(a, b);
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y, undefined, { sensitivity: 'base' }) || byName(a, b);
};
const byCount = (a: Row, b: Row) => (b.count ?? -1) - (a.count ?? -1) || byName(a, b);

/** Newest shoot first; undated last rather than pretending to be oldest. */
const byShootDate = (a: Row, b: Row) => {
  const x = String(a.raw.shoot_date || ''), y = String(b.raw.shoot_date || '');
  if (!x && !y) return byName(a, b);
  if (!x) return 1;
  if (!y) return -1;
  return y.localeCompare(x);
};

const SORTS: Record<EntityKey, SortOption[]> = {
  projects: [
    { key: 'name', label: 'Name', compare: byName },
    { key: 'client', label: 'Client', compare: byText(r => r.detail || ''), group: true },
    { key: 'usage', label: 'Most shoots', compare: byCount },
  ],
  clients: [
    { key: 'name', label: 'Name', compare: byName },
    { key: 'usage', label: 'Most shoots', compare: byCount },
  ],
  jobs: [
    { key: 'date', label: 'Date (newest)', compare: byShootDate },
    { key: 'client', label: 'Client', compare: byText(r => r.detail || ''), group: true },
    { key: 'status', label: 'Status', group: true, compare: (a, b) => {
      const ai = STATUS_ORDER.indexOf(String(a.raw.job_status || ''));
      const bi = STATUS_ORDER.indexOf(String(b.raw.job_status || ''));
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || byShootDate(a, b);
    } },
    { key: 'name', label: 'Title', compare: byName },
  ],
  inventory: [
    { key: 'name', label: 'Name', compare: byName },
    { key: 'category', label: 'Category', compare: byText(r => r.group || ''), group: true },
    { key: 'owner', label: 'Owner', compare: byText(r => String(r.raw.owner || '')), group: true },
    { key: 'qty', label: 'Quantity', compare: byCount },
  ],
};

const ENTITIES: {
  key: EntityKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Column the free-text rename writes to. */
  nameField: string;
  addLabel: string;
  /** Shown under the confirm when rows are removed. */
  unlinkNote?: string;
  /**
   * True when deleting destroys child records rather than unlinking them.
   * Shoots cascade into schedule, shot list, to-dos and budget items; the other
   * tables are all ON DELETE SET NULL. The copy has to tell the truth per tab.
   */
  destructive?: boolean;
}[] = [
  { key: 'projects', label: 'Projects', icon: FolderKanban, nameField: 'name', addLabel: 'Add project', unlinkNote: 'Productions in these projects stay — they just lose the project tag.' },
  { key: 'clients', label: 'Clients', icon: Building2, nameField: 'name', addLabel: 'Add client', unlinkNote: 'Productions for these clients stay — they just lose the client link.' },
  { key: 'inventory', label: 'Inventory', icon: Package, nameField: 'name', addLabel: 'Add gear item' },
  { key: 'jobs', label: 'Shoots', icon: Clapperboard, nameField: 'title', addLabel: 'Add shoot', destructive: true },
];

const STATUS_ORDER = ['Booked', 'Planning', 'Hold', 'Wrapped', 'Cancelled'];

const inputClass =
  'w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 outline-none focus:border-accent text-xs text-white placeholder:text-white/25';

export default function LibraryWidget() {
  const [entity, setEntity] = useState<EntityKey>('projects');
  const [rows, setRows] = useState<Record<EntityKey, Row[]>>({ projects: [], clients: [], inventory: [], jobs: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const defaultSortFor = (k: EntityKey) => (k === 'jobs' ? 'date' : 'name');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /** The record open in the detail pane. Distinct from `selected`, which arms
   *  rows for deletion — clicking a row to read it must never stage a delete. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Inventory rows with no primary key — listed but not editable. */
  const [unkeyed, setUnkeyed] = useState(0);

  /**
   * QuickBooks customers, for linking a client by hand.
   *
   * Matching is otherwise by display name alone, and it fails silently: a
   * client called "Acme Films" and a customer called "Acme Films LLC" simply
   * show no billing, which is indistinguishable from a client who owes
   * nothing. This is the manual override for that.
   */
  const [qbCustomers, setQbCustomers] = useState<{ id: string; name: string }[] | null>(null);
  const [qbNote, setQbNote] = useState<string | null>(null);
  const [qbBusy, setQbBusy] = useState(false);

  useEffect(() => {
    // Only when the Clients tab is actually open — nobody else needs the
    // round trip, and QuickBooks may not be connected at all.
    if (entity !== 'clients' || qbCustomers !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/integrations/quickbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'customers' }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.connected) {
          setQbCustomers([]);
          setQbNote(data.message || 'QuickBooks isn’t connected.');
          return;
        }
        setQbCustomers(data.customers || []);
      } catch {
        if (!cancelled) { setQbCustomers([]); setQbNote('Could not reach QuickBooks.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [entity, qbCustomers]);

  /** Pin a client to a QuickBooks customer, or clear the link. */
  const linkQuickBooks = async (clientId: string, customerId: string | null) => {
    setQbBusy(true);
    const { error } = await supabase
      .from('clients')
      .update({ quickbooks_customer_id: customerId })
      .eq('id', clientId);
    setQbBusy(false);
    if (error) { toast(`Could not save the link: ${error.message}`); return; }
    toast(customerId ? 'Linked to QuickBooks.' : 'QuickBooks link cleared.');
    void load();
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // Jobs come along so each row can show what depends on it. Without that
      // number, deleting is a guess about what you're about to unpick.
      // Contacts come along for one purpose: telling a real client from a
      // Rolodex contact that became one by accident (see strayClient below).
      const [projRes, cliRes, invRes, jobRes, conRes] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('inventory').select('*').order('name'),
        supabase.from('jobs').select('id, title, shoot_date, job_status, client_name, client_id, project_id, google_event_id, gear_manifest'),
        supabase.from('contacts').select('name').limit(2000),
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

      // A project on a client counts as a use of it just as much as a shoot.
      const projectsPerClient = new Map<string, number>();
      for (const p of (projRes.data || []) as any[]) {
        if (p.client_id) projectsPerClient.set(p.client_id, (projectsPerClient.get(p.client_id) || 0) + 1);
      }

      const contactNames = new Set(
        ((conRes.data || []) as any[])
          .map(c => String(c.name || '').trim().toLowerCase())
          .filter(Boolean),
      );

      /**
       * Spot a client the app invented rather than one anybody added.
       *
       * Until the picker landed, the gear list's "Generated For" box and the
       * production form's client box both inserted whatever was typed as a
       * client on save. Type a crew member's name into either and they became
       * a client for good. The residue has a shape: no contact details of its
       * own, nothing pointing at it, and a Rolodex contact by the same name.
       *
       * Deliberately narrow. It flags candidates to look at; it never deletes,
       * and a client with a single shoot or an email on file is left alone.
       */
      const strayClient = (c: any) =>
        contactNames.has(String(c.name || '').trim().toLowerCase()) &&
        (byClient.get(c.id) || 0) === 0 &&
        (projectsPerClient.get(c.id) || 0) === 0 &&
        !c.email && !c.phone && !c.address && !c.notes && !c.quickbooks_customer_id;

      // Gear lists key items by NAME, not id (see Rentals: manifest[item.name]),
      // so renaming or deleting a catalog item silently orphans it in every
      // saved manifest. Count the references so both actions can say so.
      const gearRefs = new Map<string, number>();
      for (const j of jobs as any[]) {
        const manifest = (j.gear_manifest || {}) as Record<string, number>;
        for (const [itemName, qty] of Object.entries(manifest)) {
          if (!qty) continue;
          const k = itemName.trim().toLowerCase();
          gearRefs.set(k, (gearRefs.get(k) || 0) + 1);
        }
      }

      const clientName = new Map((cliRes.data || []).map((c: any) => [c.id, c.name]));
      const unkeyedInventory = (invRes.data || []).filter((i: any) => !i.id).length;
      setUnkeyed(unkeyedInventory);

      setRows({
        projects: (projRes.data || []).map((p: any) => ({
          id: p.id,
          type: 'projects' as const,
          name: p.name || '',
          detail: p.client_id ? clientName.get(p.client_id) || '' : '',
          usage: byProject.get(p.id) || 0,
          count: byProject.get(p.id) || 0,
          countUnit: 'shoot',
          group: p.client_id ? clientName.get(p.client_id) || '' : '',
          raw: p,
        })),
        clients: (cliRes.data || []).map((c: any) => ({
          id: c.id,
          type: 'clients' as const,
          name: c.name || '',
          detail: c.email || '',
          usage: byClient.get(c.id) || 0,
          count: byClient.get(c.id) || 0,
          countUnit: 'shoot',
          stray: strayClient(c),
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
            type: 'inventory' as const,
            name: i.name || '',
            detail: [i.category, i.owner].filter(Boolean).join(' · '),
            usage: gearRefs.get(String(i.name || '').trim().toLowerCase()) || 0,
            count: typeof i.qty === 'number' ? i.qty : undefined,
            countUnit: 'in kit',
            group: i.category || '',
            raw: i,
          })),
        jobs: (jobs as any[]).map((j: any) => ({
          id: j.id,
          type: 'jobs' as const,
          name: j.title || '',
          // client_id is the real link; client_name is the free-text fallback
          // for shoots booked before a client record existed.
          detail: (j.client_id ? clientName.get(j.client_id) : '') || j.client_name || '',
          group: (j.client_id ? clientName.get(j.client_id) : '') || j.client_name || '',
          trailing: j.shoot_date ? formatLocalDate(j.shoot_date, { month: 'short', day: 'numeric', year: 'numeric' }, '') : 'No date',
          raw: j,
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
    // Sort keys are per-entity — "category" means nothing on the client list,
    // and a stale key would fall through to no sort at all.
    setSortKey(defaultSortFor(key));
  };

  const meta = ENTITIES.find(e => e.key === entity)!;
  const current = rows[entity];

  const sorts = SORTS[entity];
  const activeSort = sorts.find(s => s.key === sortKey) || sorts[0];

  const searching = search.trim().length > 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...current].sort(activeSort.compare);
    // Search spans every type. "Hudson" should surface the Hudson Theatre
    // client and the Hudson Gala shoot together rather than asking which tab.
    const pool = ENTITIES.flatMap(e => rows[e.key]);
    return pool
      .filter(r => r.name.toLowerCase().includes(q) || (r.detail || '').toLowerCase().includes(q))
      .sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
  }, [current, rows, search, activeSort]);

  /** Rows interleaved with section headings when the sort groups. */
  const sections = useMemo(() => {
    // Cross-type results group by type, so each hit says what it is.
    if (searching) {
      const out: { heading: string | null; items: Row[] }[] = [];
      for (const row of visible) {
        const heading = ENTITIES.find(e => e.key === row.type)!.label;
        const last = out[out.length - 1];
        if (last && last.heading === heading) last.items.push(row);
        else out.push({ heading, items: [row] });
      }
      return out;
    }
    if (!activeSort.group) return [{ heading: null as string | null, items: visible }];
    const out: { heading: string | null; items: Row[] }[] = [];
    for (const row of visible) {
      const heading = (activeSort.key === 'owner' ? String(row.raw.owner || '') : row.group || '').trim() || 'Uncategorised';
      const last = out[out.length - 1];
      if (last && last.heading === heading) last.items.push(row);
      else out.push({ heading, items: [row] });
    }
    return out;
  }, [visible, activeSort, searching]);

  /** The record shown on the right, resolved across every type. */
  const activeRow = useMemo(
    () => ENTITIES.flatMap(e => rows[e.key]).find(r => r.id === activeId) || null,
    [rows, activeId],
  );

  /** What this record connects to, in the order you'd walk it. */
  const relatedFor = useCallback((row: Row): Row[] => {
    if (row.type === 'clients') {
      return [
        ...rows.projects.filter(p => p.raw.client_id === row.id),
        ...rows.jobs.filter(j => j.raw.client_id === row.id),
      ];
    }
    if (row.type === 'projects') {
      const client = rows.clients.find(c => c.id === row.raw.client_id);
      return [...(client ? [client] : []), ...rows.jobs.filter(j => j.raw.project_id === row.id)];
    }
    if (row.type === 'jobs') {
      const client = rows.clients.find(c => c.id === row.raw.client_id);
      const project = rows.projects.find(p => p.id === row.raw.project_id);
      return [...(client ? [client] : []), ...(project ? [project] : [])];
    }
    return [];
  }, [rows]);

  const openRecord = (row: Row) => {
    setActiveId(row.id);
    // Following a link out of the detail pane has to move the list with it, or
    // the selected record sits in a list that isn't showing it.
    if (row.type !== entity) { setEntity(row.type); setSortKey(defaultSortFor(row.type)); setSelected(new Set()); }
    setSearch('');
  };

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

  /** Clients that look auto-created, and the button that arms them for review. */
  const strays = useMemo(() => rows.clients.filter(r => r.stray), [rows.clients]);
  const selectStrays = () => {
    setSelected(new Set(strays.map(r => r.id)));
    setActiveId(strays[0]?.id ?? null);
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
      // jobs has no `name` column — the title is the display field, and a new
      // shoot starts in Planning like one created from Slate.
      if (entity === 'jobs') { delete payload.name; payload.title = name.trim(); payload.job_status = 'Planning'; payload.type = 'production'; }
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

    // Saved gear lists point at catalog items by name, so a rename doesn't
    // follow — the old name becomes a one-off custom item on every list using
    // it. Worth a question when it would actually happen.
    if (entity === 'inventory' && (row.usage || 0) > 0) {
      const ok = await confirmAction({
        title: 'Rename this gear item?',
        message: `${row.usage} saved gear ${row.usage === 1 ? 'list references' : 'lists reference'} “${row.name}” by name. They won't follow the rename — the old name stays on them as a custom item.`,
        confirmLabel: 'Rename anyway',
      });
      if (!ok) { void load(); return; }
    }
    setRows(prev => ({ ...prev, [entity]: prev[entity].map(r => (r.id === row.id ? { ...r, name: next } : r)) }));
    const { error } = await supabase.from(entity).update({ [meta.nameField]: next }).eq('id', row.id);
    if (error) {
      toast(`Rename failed: ${error.message}`);
      void load();
      return;
    }

    // The shoot's title is the Google event's summary. Without this push the
    // calendar keeps the old name and the two quietly disagree.
    if (entity === 'jobs' && row.raw.google_event_id) {
      const res = await pushJobToGoogleCalendar(row.id);
      if (!res.ok) toast(`Renamed here, but Google Calendar still shows the old title. ${res.message}`);
    }
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    const picked = current.filter(r => ids.includes(r.id));
    const linked = picked.reduce((sum, r) => sum + (r.usage || 0), 0);

    const ok = await confirmAction({
      title: `Delete ${ids.length} ${ids.length === 1 ? meta.label.replace(/s$/, '') : meta.label}?`.toLowerCase(),
      message: meta.destructive
        // Shoots are the one tab where delete destroys rather than unlinks.
        ? `Crew, schedule, shot list, to-dos and budget items go with ${ids.length === 1 ? 'it' : 'them'} permanently, and ${ids.length === 1 ? 'the shoot is' : 'the shoots are'} removed from Google Calendar. This cannot be undone.`
        : linked === 0
        ? 'Nothing references these. This cannot be undone.'
        : entity === 'inventory'
          ? `${linked} saved gear ${linked === 1 ? 'list references' : 'lists reference'} ${ids.length === 1 ? 'this item' : 'these items'} by name. Those lists keep the item as a one-off custom entry; only the catalog entry goes.`
          : `${linked} production${linked === 1 ? '' : 's'} reference ${ids.length === 1 ? 'this' : 'these'}. ${meta.unlinkNote || ''}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      if (entity === 'jobs') {
        // Google has to go first: once the row is deleted its google_event_id
        // goes with it, and the orphaned event is re-imported as a new job on
        // the next sync. Same order Slate's own delete uses.
        const withEvents = picked.filter(r => r.raw.google_event_id);
        const results = await Promise.all(
          withEvents.map(r => removeJobFromGoogleCalendar(r.raw.google_event_id)),
        );
        const failed = results.filter(r => !r.ok).length;
        if (failed > 0) {
          toast(`${failed} Google Calendar ${failed === 1 ? 'event' : 'events'} could not be removed — delete cancelled so they don't come back on the next sync.`);
          setBusy(false);
          return;
        }
      }

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

  /** Fields worth showing per type, in the order they matter on the day. */
  function detailFields(row: Row): { k: string; v: string; mono?: boolean }[] {
    const d = row.raw;
    if (row.type === 'jobs') return [
      { k: 'Date', v: d.shoot_date ? formatLocalDate(d.shoot_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, 'No date') : 'No date', mono: true },
      { k: 'Status', v: d.job_status || 'Planning' },
      { k: 'Client', v: row.detail || 'Unassigned' },
      { k: 'On Google', v: d.google_event_id ? 'Synced' : 'Not synced' },
    ];
    if (row.type === 'projects') return [
      { k: 'Client', v: row.detail || 'Unassigned' },
      { k: 'Status', v: d.status || 'Active' },
      { k: 'Shoots', v: String(row.count ?? 0), mono: true },
    ];
    if (row.type === 'clients') {
      const linked = d.quickbooks_customer_id
        ? (qbCustomers?.find(c => c.id === d.quickbooks_customer_id)?.name || 'Linked (name unavailable)')
        : 'Not linked';
      return [
        { k: 'Email', v: d.email || '—' },
        { k: 'Phone', v: d.phone || '—', mono: true },
        { k: 'Shoots', v: String(row.count ?? 0), mono: true },
        { k: 'QuickBooks', v: linked },
        ...(row.stray ? [{ k: 'Looks like', v: 'A Rolodex contact, not a client' }] : []),
      ];
    }
    return [
      { k: 'Category', v: d.category || 'Uncategorised' },
      { k: 'Owner', v: d.owner || 'Zipline Media' },
      { k: 'Quantity', v: String(d.qty ?? 0), mono: true },
      { k: 'Replacement', v: typeof d.replacement === 'number' ? `$${d.replacement.toLocaleString('en-US')}` : '—', mono: true },
      { k: 'On gear lists', v: String(row.usage ?? 0), mono: true },
    ];
  }

  const typeLabel = (k: EntityKey) => ({ jobs: 'Shoot', projects: 'Project', clients: 'Client', inventory: 'Gear item' }[k]);

  return (
    <div className="h-full flex flex-col bg-black text-white">
      {/* Header: type rail + one search across everything */}
      <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Library</h2>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shoots, clients, projects and gear…"
              aria-label="Search the library"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap items-center">
          {ENTITIES.map(e => {
            const Icon = e.icon;
            const active = e.key === entity && !searching;
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

          {!searching && (
            <label className="ml-auto flex items-center gap-1.5 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/30">
              Sort
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value)}
                aria-label={`Sort ${meta.label}`}
                className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 outline-none focus:border-accent text-[10px] font-bold text-white/80 cursor-pointer normal-case tracking-normal"
              >
                {sorts.map(s => (
                  <option key={s.key} value={s.key} className="bg-zinc-900">{s.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={visible.length === 0 || searching}
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

      {/* One-time cleanup prompt for the clients two forms used to invent. */}
      {entity === 'clients' && !searching && !loading && strays.length > 0 && (
        <div className="px-4 py-2.5 border-b border-white/5 flex items-start gap-2.5 bg-amber-500/[0.07] shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/60 leading-relaxed flex-1 min-w-0">
            {strays.length} {strays.length === 1 ? 'client shares a name' : 'clients share a name'} with a Rolodex
            contact and {strays.length === 1 ? 'has' : 'have'} no shoots, projects or details of their own — the
            shape of a name typed into a client box back when that created a client on save. Worth a look before
            deleting: productions keep their client name either way.
          </p>
          <button
            type="button"
            onClick={selectStrays}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-white/5 border border-white/15 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Select {strays.length}
          </button>
        </div>
      )}

      {/* List | detail. Stacks on narrow screens rather than squeezing both. */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overflow-y-auto custom-scrollbar lg:border-r border-white/5">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
          ) : loadError ? (
            <div className="py-20 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-400/70 mx-auto" />
              <p className="text-xs text-white/70">{loadError}</p>
            </div>
          ) : entity === 'inventory' && !searching && unkeyed > 0 && visible.length === 0 ? (
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
                {searching ? `Nothing matches “${search}”.` : `No ${meta.label.toLowerCase()} yet.`}
              </p>
              {searching && (
                <button type="button" onClick={() => setSearch('')} className="text-[10px] text-accent hover:underline uppercase tracking-widest font-bold">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {sections.map(section => (
                <React.Fragment key={section.heading ?? '__all__'}>
                  {section.heading && (
                    <li className="px-4 py-1.5 bg-white/[0.04] sticky top-0 z-10 flex items-center justify-between">
                      <span className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-accent/80">{section.heading}</span>
                      <span className="text-[11px] md:text-[9px] text-white/25">{section.items.length}</span>
                    </li>
                  )}
                  {section.items.map(row => (
                    <li
                      key={`${row.type}-${row.id}`}
                      className={`flex items-center gap-3 px-4 hover:bg-white/[0.03] ${row.id === activeId ? 'bg-accent/10 shadow-[inset_2px_0_0_var(--accent)]' : ''}`}
                    >
                      {!searching && (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${row.name || 'untitled'}`}
                          className="accent-[var(--accent)] shrink-0"
                        />
                      )}

                      {/* The row reads the record; it no longer edits it. Renaming
                          moved to the detail pane, where the field is labelled and
                          the consequences are visible next to it. */}
                      <button
                        type="button"
                        onClick={() => openRecord(row)}
                        className="flex-1 min-w-0 text-left py-2.5 flex items-center gap-3"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="block text-xs text-white/90 truncate">{row.name || 'Untitled'}</span>
                            {row.stray && (
                              <span
                                title="Shares a name with a Rolodex contact and has nothing linked to it"
                                className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-amber-400/80"
                              >
                                In Rolodex
                              </span>
                            )}
                          </span>
                          {row.detail && <span className="block text-[10px] text-white/35 truncate">{row.detail}</span>}
                        </span>

                        {row.count === undefined && row.trailing && (
                          <span className="text-[10px] text-white/30 shrink-0 tabular-nums">{row.trailing}</span>
                        )}
                        {row.count !== undefined && (
                          <span className="text-[10px] text-white/25 shrink-0 tabular-nums">
                            {row.count} {row.countUnit === 'shoot' ? (row.count === 1 ? 'shoot' : 'shoots') : row.countUnit}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </React.Fragment>
              ))}
            </ul>
          )}
        </div>

        {/* Detail — shaped by what kind of record is open. */}
        <div className="overflow-y-auto custom-scrollbar border-t lg:border-t-0 border-white/5">
          {!activeRow ? (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-[11px] text-white/25 text-center max-w-[22ch] leading-relaxed">
                Pick a record to see its details and what it&rsquo;s linked to.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <p className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{typeLabel(activeRow.type)}</p>
                <label className="block space-y-1">
                  <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/30">
                    {activeRow.type === 'jobs' ? 'Title' : 'Name'}
                  </span>
                  <input
                    key={`${activeRow.id}-${activeRow.name}`}
                    defaultValue={activeRow.name}
                    onBlur={e => rename(activeRow, e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {detailFields(activeRow).map(f => (
                  <div key={f.k} className="min-w-0">
                    <dt className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/30">{f.k}</dt>
                    <dd className={`text-xs text-white/80 truncate ${f.mono ? 'tabular-nums' : ''}`}>{f.v}</dd>
                  </div>
                ))}
              </dl>

              {/* Consequences sit next to the record, before you act on it —
                  not inside a confirm dialog after you already decided. */}
              {/* QuickBooks link. Auto-matching is by display name only and
                  fails silently — an unmatched client looks exactly like one
                  with no invoices. This is where you say which is which. */}
              {activeRow.type === 'clients' && qbCustomers !== null && (
                qbCustomers.length === 0 ? (
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    {qbNote || 'No QuickBooks customers found.'}
                  </p>
                ) : (
                  <label className="block space-y-1">
                    <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/30">
                      QuickBooks customer
                    </span>
                    <select
                      value={activeRow.raw.quickbooks_customer_id || ''}
                      disabled={qbBusy}
                      onChange={e => linkQuickBooks(activeRow.id, e.target.value || null)}
                      className={`${inputClass} cursor-pointer disabled:opacity-50`}
                    >
                      <option value="">Not linked</option>
                      {qbCustomers.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                      ))}
                    </select>
                    <span className="block text-[11px] md:text-[9px] text-white/25 leading-relaxed">
                      {activeRow.raw.quickbooks_customer_id
                        ? 'Invoiced and quoted totals for this client come from here.'
                        : 'Names are matched automatically when they’re identical. Pick one here when they aren’t.'}
                    </span>
                  </label>
                )
              )}

              {activeRow.type === 'inventory' && (activeRow.usage || 0) > 0 && (
                <p className="flex gap-2 text-[10px] text-amber-300/80 bg-amber-400/5 border border-amber-400/20 rounded-lg p-2.5 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    {activeRow.usage} saved gear {activeRow.usage === 1 ? 'list references' : 'lists reference'} this by name.
                    Renaming won&rsquo;t follow — they keep the old name as a custom item.
                  </span>
                </p>
              )}
              {activeRow.type === 'jobs' && (
                <p className="flex gap-2 text-[10px] text-amber-300/80 bg-amber-400/5 border border-amber-400/20 rounded-lg p-2.5 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>Deleting this shoot also deletes its crew, schedule, shot list and budget, and clears it from Google Calendar.</span>
                </p>
              )}

              {relatedFor(activeRow).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/30">Related</p>
                  {relatedFor(activeRow).map(rel => (
                    <button
                      key={`${rel.type}-${rel.id}`}
                      type="button"
                      onClick={() => openRecord(rel)}
                      className="w-full flex items-center gap-2.5 bg-white/[0.04] border border-white/5 rounded-lg px-2.5 py-2 text-left hover:border-accent/40 hover:text-accent transition-colors"
                    >
                      <span className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/30 w-14 shrink-0">{typeLabel(rel.type)}</span>
                      <span className="flex-1 min-w-0 text-[11px] truncate">{rel.name || 'Untitled'}</span>
                      {rel.trailing && <span className="text-[10px] text-white/25 shrink-0 tabular-nums">{rel.trailing}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
