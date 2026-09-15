'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL_CATEGORIES, INVENTORY, type InventoryItem } from '@/data/inventory';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';

export default function EquipmentPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  // This page shows the exact same catalog the Gear Builder and the Library
  // write to, so gear added in the Command Center appears here. The bundled
  // inventory file is only a fallback for when the database is unreachable.
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY);
  const [isLoading, setIsLoading] = useState(true);

  const loadInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      if (data && data.length > 0) setInventory(data as InventoryItem[]);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Live-update when a teammate adds or edits gear in the Command Center.
  useRealtime(['inventory'], loadInventory);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Standard category order first, then any custom categories added in the
  // Command Center, so new gear never gets filtered out of this page.
  const orderedCategories = useMemo(() => {
    const present = new Set(inventory.map(item => item.category).filter(Boolean));
    const extras = [...present]
      .filter(cat => !ALL_CATEGORIES.includes(cat))
      .sort((a, b) => a.localeCompare(b));
    return [...ALL_CATEGORIES.filter(cat => present.has(cat)), ...extras];
  }, [inventory]);

  const categories = ['All', ...orderedCategories];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group items by category for the list view
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  Object.values(groupedInventory).forEach(items =>
    items.sort((a, b) => a.name.localeCompare(b.name))
  );

  const sortedCategories = activeCategory === 'All' 
    ? Object.keys(groupedInventory).sort((a, b) => {
        const ai = orderedCategories.indexOf(a);
        const bi = orderedCategories.indexOf(b);
        return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
      })
    : [activeCategory].filter(cat => groupedInventory[cat]);

  return (
    <main className="min-h-screen bg-black text-white pt-20 md:pt-24 pb-24 px-4 md:px-8 lg:px-12 selection:bg-accent selection:text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 mb-8 md:mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            /* Stepped down at the small and medium stops: "EQUIPMENT" in the
               real LuloClean is wide enough that 48px overran a phone and 96px
               overran a tablet. Full size returns at lg, where there's room. */
            className="text-4xl md:text-6xl lg:text-8xl font-black uppercase tracking-tighter leading-none"
          >
            Equipment
          </motion.h1>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-400">
            {isLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing inventory
              </>
            ) : (
              <>{inventory.length} items in house</>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-12">
          
          {/* Sidebar Filters */}
          <aside className="space-y-4 lg:space-y-8 lg:sticky lg:top-32 h-fit">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-accent transition-colors" />
              <input 
                type="text"
                placeholder="Search equipment..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-xs font-bold tracking-widest uppercase focus:outline-none focus:border-accent transition-all font-mono"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Below lg the categories are one swipeable row of chips, so the gear
                itself is on screen immediately instead of a screen-tall stack of
                13 buttons. The row bleeds to the screen edges to scroll cleanly. */}
            <nav
              aria-label="Equipment categories"
              className="flex gap-2 overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:pb-0 lg:flex-col lg:gap-1 lg:overflow-visible"
            >
              <span className="hidden lg:block text-[11px] font-bold tracking-[0.3em] uppercase opacity-60 mb-4 px-2">Categories</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={activeCategory === cat}
                  className={`group shrink-0 whitespace-nowrap flex items-center justify-between min-h-11 px-4 py-2.5 rounded-full border lg:shrink lg:whitespace-normal lg:min-h-0 lg:py-3 lg:rounded-xl lg:border-0 text-[11px] font-bold tracking-[0.2em] uppercase transition-all ${
                    activeCategory === cat 
                    ? 'bg-accent border-accent text-white' 
                    : 'border-white/10 hover:bg-white/5 text-zinc-400 lg:text-zinc-500 hover:text-white'
                  }`}
                >
                  {cat}
                  <ChevronRight className={`hidden lg:block w-3 h-3 transition-transform ${activeCategory === cat ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </button>
              ))}
            </nav>
          </aside>

          {/* Gear List */}
          <div className="space-y-16">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeCategory + searchQuery}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-16"
              >
                {sortedCategories.length > 0 ? (
                  sortedCategories.map((category) => (
                    <div key={category} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-accent whitespace-nowrap">
                          {category}
                        </h2>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>
                      
                      <ul className="grid grid-cols-1 gap-1">
                        {groupedInventory[category].map((item, idx) => (
                          <motion.li
                            key={item.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="group flex items-center justify-between py-3 px-4 rounded-lg hover:bg-white/5 transition-colors border-b border-white/[0.03]"
                          >
                            <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                              {item.name}
                            </span>
                            {item.qty > 1 && (
                              <span className="text-[11px] font-black text-accent tracking-widest ml-4 px-2 py-0.5 border border-accent/20 rounded">
                                {item.qty}X
                              </span>
                            )}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div className="py-32 text-center">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em]">No equipment found matching your search</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                      className="mt-4 text-accent text-[11px] font-black uppercase tracking-widest hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="pt-12 border-t border-white/5 flex justify-end">
              <button 
                onClick={scrollToTop}
                className="inline-flex items-center min-h-11 px-2 -mr-2 text-[11px] font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Back to Top ↑
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
