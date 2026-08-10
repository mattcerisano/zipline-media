'use client';

import React, { useState } from 'react';
import { ALL_CATEGORIES, INVENTORY } from '@/data/inventory';
import { Search, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EquipmentPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredInventory = INVENTORY.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...ALL_CATEGORIES];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group items by category for the list view
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof INVENTORY>);

  const sortedCategories = activeCategory === 'All' 
    ? ALL_CATEGORIES.filter(cat => groupedInventory[cat])
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-12">
          
          {/* Sidebar Filters */}
          <aside className="space-y-8 lg:sticky lg:top-32 h-fit">
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

            <nav className="flex flex-col gap-1">
              <span className="text-[11px] md:text-[8px] font-bold tracking-[0.3em] uppercase opacity-30 mb-4 px-2">Categories</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${
                    activeCategory === cat 
                    ? 'bg-accent text-white' 
                    : 'hover:bg-white/5 text-zinc-500 hover:text-white'
                  }`}
                >
                  {cat}
                  <ChevronRight className={`w-3 h-3 transition-transform ${activeCategory === cat ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
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
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent whitespace-nowrap">
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
                              <span className="text-[10px] font-black text-accent tracking-widest ml-4 px-2 py-0.5 border border-accent/20 rounded">
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
                      className="mt-4 text-accent text-[10px] font-black uppercase tracking-widest hover:underline"
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
                className="inline-flex items-center min-h-11 px-2 -mr-2 text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
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
