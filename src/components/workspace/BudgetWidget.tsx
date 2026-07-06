'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';

// Production budget tracker. Line items live in the budget_items table
// (see supabase/migrations/20260706000000_budget_items.sql) scoped to a
// production or to the "General" bucket. All data stays in the org's own
// Supabase database — nothing is sent to any third-party service.

interface BudgetItem {
  id: string;
  job_id: string | null;
  category: string;
  description: string;
  estimated: number;
  actual: number;
  sort_order: number;
}

interface JobOption {
  id: string;
  title: string;
  client_name?: string;
}

const CATEGORIES = ['Crew', 'Gear Rental', 'Locations', 'Talent', 'Post-Production', 'Travel', 'Meals', 'Insurance', 'Misc'];

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function BudgetWidget() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [scope, setScope] = useState<string>('general'); // 'general' | job id
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  // New row form
  const [newCategory, setNewCategory] = useState('Crew');
  const [newDesc, setNewDesc] = useState('');
  const [newEstimated, setNewEstimated] = useState('');
  const [newActual, setNewActual] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      let query = supabase.from('budget_items').select('*').order('sort_order').order('created_at');
      query = scope === 'general' ? query.is('job_id', null) : query.eq('job_id', scope);
      const { data, error } = await query;
      if (error) {
        // Table not created yet (migration not run) — degrade with guidance.
        setTableMissing(true);
        setItems([]);
      } else {
        setTableMissing(false);
        setItems((data as BudgetItem[]) || []);
      }
    } catch {
      setTableMissing(true);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const loadJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, client_name, job_status')
        .neq('job_status', 'Cancelled')
        .order('shoot_date', { ascending: false })
        .limit(200);
      setJobs((data as JobOption[]) || []);
    };
    loadJobs();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  // Live sync with teammates editing the same budget.
  useRealtime(['budget_items'], fetchItems);

  const addItem = async () => {
    if (!newDesc.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('budget_items').insert([{
        job_id: scope === 'general' ? null : scope,
        category: newCategory,
        description: newDesc.trim(),
        estimated: parseFloat(newEstimated) || 0,
        actual: parseFloat(newActual) || 0,
        sort_order: items.length,
      }]);
      if (error) throw error;
      setNewDesc('');
      setNewEstimated('');
      setNewActual('');
      fetchItems();
    } catch (err) {
      console.error('Failed to add budget item:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (id: string, patch: Partial<BudgetItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await supabase.from('budget_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    } catch (err) {
      console.error('Failed to update budget item:', err);
    }
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await supabase.from('budget_items').delete().eq('id', id);
    } catch (err) {
      console.error('Failed to delete budget item:', err);
    }
  };

  const totals = useMemo(() => {
    const estimated = items.reduce((s, i) => s + (Number(i.estimated) || 0), 0);
    const actual = items.reduce((s, i) => s + (Number(i.actual) || 0), 0);
    return { estimated, actual, variance: estimated - actual };
  }, [items]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, BudgetItem[]>();
    for (const item of items) {
      const cat = item.category || 'Misc';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return Array.from(groups.entries());
  }, [items]);

  const inputClass = 'bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-accent transition-colors';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-5 space-y-4">
      {/* Scope picker + totals */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-accent appearance-none cursor-pointer min-w-[180px]"
        >
          <option value="general">General / Overhead</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.title}{j.client_name ? ` — ${j.client_name}` : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Estimated</p>
            <p className="text-sm font-bold text-white">{money(totals.estimated)}</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Actual</p>
            <p className="text-sm font-bold text-white">{money(totals.actual)}</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Variance</p>
            <p className={`text-sm font-bold ${totals.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {money(totals.variance)}
            </p>
          </div>
        </div>
      </div>

      {tableMissing ? (
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-300">Budget storage not set up yet</p>
            <p className="text-[10px] text-white/50 leading-relaxed mt-1">
              Run the included database migration
              (<span className="font-mono">supabase/migrations/20260706000000_budget_items.sql</span>)
              against your Supabase project, then reload. Budgets stay entirely in your own database.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Line items grouped by category */}
          {items.length === 0 ? (
            <div className="py-16 text-center opacity-30">
              <DollarSign className="w-12 h-12 mx-auto mb-3" />
              <p className="text-xs font-semibold text-white/50">No line items yet — add the first one below.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byCategory.map(([cat, rows]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{cat}</p>
                    <p className="text-[9px] font-bold text-white/30">
                      {money(rows.reduce((s, r) => s + (Number(r.actual) || 0), 0))} spent
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map(item => (
                      <div key={item.id} className="group grid grid-cols-[1fr_90px_90px_28px] gap-2 items-center bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
                        <input
                          className="bg-transparent text-xs text-white outline-none min-w-0"
                          value={item.description}
                          onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                          onBlur={(e) => updateItem(item.id, { description: e.target.value })}
                        />
                        <input
                          type="number"
                          className="bg-black/30 border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white/70 outline-none focus:border-accent text-right"
                          value={item.estimated}
                          title="Estimated"
                          onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, estimated: parseFloat(e.target.value) || 0 } : i))}
                          onBlur={(e) => updateItem(item.id, { estimated: parseFloat(e.target.value) || 0 })}
                        />
                        <input
                          type="number"
                          className="bg-black/30 border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-accent text-right"
                          value={item.actual}
                          title="Actual"
                          onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, actual: parseFloat(e.target.value) || 0 } : i))}
                          onBlur={(e) => updateItem(item.id, { actual: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-white/10 group-hover:text-white/30 hover:!text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_90px_90px_28px] gap-2 px-3 text-[8px] font-black uppercase tracking-widest text-white/25">
                <span>Description</span><span className="text-right">Est.</span><span className="text-right">Actual</span><span />
              </div>
            </div>
          )}

          {/* Add row */}
          <div className="flex flex-wrap gap-2 items-center bg-black/30 border border-white/10 rounded-2xl p-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className={`${inputClass} appearance-none cursor-pointer`}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className={`${inputClass} flex-1 min-w-[140px]`}
              placeholder="Line item — e.g. Gaffer day rate"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
            />
            <input
              type="number"
              className={`${inputClass} w-24 text-right`}
              placeholder="Est. $"
              value={newEstimated}
              onChange={(e) => setNewEstimated(e.target.value)}
            />
            <input
              type="number"
              className={`${inputClass} w-24 text-right`}
              placeholder="Actual $"
              value={newActual}
              onChange={(e) => setNewActual(e.target.value)}
            />
            <button
              onClick={addItem}
              disabled={saving || !newDesc.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
