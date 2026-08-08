'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Briefcase, Users, Building2, Loader2, Sparkles, X, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { APP_FEATURES } from '@/lib/feature-registry';
import {
  ensureModel,
  getSemanticStatus,
  semanticRank,
  keywordScore,
  combinedScore,
  type SearchDoc,
  type SemanticStatus,
} from '@/lib/semantic-search';

// Global smart search (Cmd/Ctrl+K). Understands meaning, not just keywords:
// "beverage shoot with the crane" finds the soda job that never says
// "beverage". Runs a small embedding model fully in the browser; degrades to
// plain keyword search when the model can't load.

interface Hit {
  key: string;
  type: 'job' | 'contact' | 'client' | 'feature';
  title: string;
  subtitle: string;
  id: string;
  score: number;
}

interface Corpus {
  docs: SearchDoc[];
  meta: Map<string, Omit<Hit, 'score'>>;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenJob: (jobId: string) => void;
  onOpenContacts: () => void;
  /** Navigate to a Command Center tab (feature results). */
  onNavigate?: (tabId: string) => void;
  /** Tab ids visible to this user — feature results outside this set are hidden. */
  availableTabs?: string[];
}

export default function SearchPalette({ open, onClose, onOpenJob, onOpenContacts, onNavigate, availableTabs }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [semStatus, setSemStatus] = useState<SemanticStatus>('idle');
  const [modelPct, setModelPct] = useState(0);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  // Load the corpus + kick off the model download when first opened.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    if (!corpus) {
      (async () => {
        try {
          const [jobsRes, contactsRes, clientsRes] = await Promise.all([
            supabase.from('jobs').select('id, title, client_name, production_company, location_name, location_address, notes_general, shoot_date, job_status').order('shoot_date', { ascending: false }).limit(500),
            supabase.from('contacts').select('id, name, primary_role, company_name, tags, notes_general, location_city').limit(1000),
            supabase.from('clients').select('id, name, notes').limit(300),
          ]);
          const docs: SearchDoc[] = [];
          const meta = new Map<string, Omit<Hit, 'score'>>();

          for (const j of jobsRes.data || []) {
            const key = `job:${j.id}`;
            docs.push({ key, text: [j.title, j.client_name, j.production_company, j.location_name, j.location_address, j.notes_general, j.shoot_date, j.job_status].filter(Boolean).join(' · ') });
            meta.set(key, { key, type: 'job', id: j.id, title: j.title || 'Untitled', subtitle: [j.client_name, j.shoot_date].filter(Boolean).join(' · ') || 'Production' });
          }
          for (const c of contactsRes.data || []) {
            const key = `contact:${c.id}`;
            docs.push({ key, text: [c.name, c.primary_role, c.company_name, c.tags, c.notes_general, c.location_city].filter(Boolean).join(' · ') });
            meta.set(key, { key, type: 'contact', id: c.id, title: c.name || 'Unnamed', subtitle: [c.primary_role, c.company_name].filter(Boolean).join(' · ') || 'Contact' });
          }
          for (const cl of clientsRes.data || []) {
            const key = `client:${cl.id}`;
            docs.push({ key, text: [cl.name, cl.notes].filter(Boolean).join(' · ') });
            meta.set(key, { key, type: 'client', id: cl.id, title: cl.name || 'Unnamed', subtitle: 'Client' });
          }
          // App capabilities: "export a call sheet" should find the feature
          // even when no data matches. Hidden for tabs this user can't see.
          for (const f of APP_FEATURES) {
            if (availableTabs && !availableTabs.includes(f.tab)) continue;
            const key = `feature:${f.id}`;
            docs.push({ key, text: [f.title, f.description, f.keywords].join(' · ') });
            meta.set(key, { key, type: 'feature', id: f.tab, title: f.title, subtitle: f.description });
          }
          setCorpus({ docs, meta });
        } catch (err) {
          console.error('Search corpus load failed:', err);
          setCorpus({ docs: [], meta: new Map() });
        }
      })();
    }

    // Mirror the embedding model's load state, which lives in the
    // semantic-search module rather than in React. Reading an external store on
    // open is what the rule's own guidance calls the legitimate case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSemStatus(getSemanticStatus());
    ensureModel((pct) => setModelPct(pct)).then(() => setSemStatus(getSemanticStatus()));
  }, [open, corpus]);

  // Rank on every keystroke: keyword instantly, semantic layered on when ready.
  const runSearch = useCallback(async (q: string) => {
    if (!corpus) return;
    const seq = ++searchSeq.current;
    if (!q.trim()) {
      setHits([]);
      return;
    }

    const kwScores = new Map<string, number>();
    for (const d of corpus.docs) kwScores.set(d.key, keywordScore(q, d.text));

    const build = (sem: Map<string, number> | null): Hit[] =>
      corpus.docs
        .map(d => {
          const m = corpus.meta.get(d.key)!;
          return { ...m, score: combinedScore(kwScores.get(d.key) || 0, sem?.get(d.key)) };
        })
        .filter(h => h.score > 0.28)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);

    // Instant keyword pass…
    setHits(build(null));
    setSelected(0);

    // …then semantic re-rank, dropped if a newer keystroke superseded it.
    const sem = await semanticRank(q, corpus.docs).catch(() => null);
    if (sem && seq === searchSeq.current) setHits(build(sem));
  }, [corpus]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 120);
    return () => clearTimeout(t);
  }, [query, runSearch, semStatus]);

  const openHit = useCallback((hit: Hit) => {
    onClose();
    if (hit.type === 'job') onOpenJob(hit.id);
    else if (hit.type === 'feature') onNavigate?.(hit.id);
    else onOpenContacts();
  }, [onClose, onOpenJob, onOpenContacts, onNavigate]);

  // Keyboard: arrows to move, enter to open, esc to close.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && hits[selected]) { e.preventDefault(); openHit(hits[selected]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const typeIcon = { job: Briefcase, contact: Users, client: Building2, feature: Zap };
  const typeLabel = { job: 'Production', contact: 'Contact', client: 'Client', feature: 'Feature' };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex justify-center bg-black/80 backdrop-blur-sm p-4 pt-[12vh] overflow-y-auto cursor-pointer"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl h-fit bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden cursor-default"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
              <Search className="w-4 h-4 text-white/40 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search productions, contacts, clients, or features…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/25"
              />
              <button aria-label="Close" title="Close" onClick={onClose} className="p-1 text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {query.trim() === '' ? (
                <p className="px-4 py-8 text-center text-[11px] text-white/30">
                  Try &ldquo;the beverage shoot with the crane&rdquo; — or ask for a feature, like &ldquo;export a call sheet&rdquo;.
                </p>
              ) : hits.length === 0 ? (
                <p className="px-4 py-8 text-center text-[11px] text-white/30">No matches.</p>
              ) : (
                hits.map((hit, i) => {
                  const Icon = typeIcon[hit.type];
                  return (
                    <button
                      key={hit.key}
                      onClick={() => openHit(hit)}
                      onMouseEnter={() => setSelected(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        i === selected ? 'bg-accent/15' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === selected ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/40'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{hit.title}</p>
                        <p className="text-[10px] text-white/40 truncate">{hit.subtitle}</p>
                      </div>
                      <span className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/25 shrink-0">{typeLabel[hit.type]}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Status footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-black/30">
              <span className="text-[11px] md:text-[9px] text-white/25 tracking-wide">↑↓ navigate · Enter to open · Esc to close</span>
              <span className="flex items-center gap-1.5 text-[11px] md:text-[9px] font-bold uppercase tracking-widest">
                {semStatus === 'ready' ? (
                  <><Sparkles className="w-3 h-3 text-accent" /><span className="text-accent">Smart search on</span></>
                ) : semStatus === 'loading' ? (
                  <><Loader2 className="w-3 h-3 animate-spin text-white/40" /><span className="text-white/40">Loading model{modelPct > 0 ? ` ${modelPct}%` : ''}…</span></>
                ) : semStatus === 'unavailable' ? (
                  <span className="text-white/30">Keyword search</span>
                ) : null}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
