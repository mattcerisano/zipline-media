'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_CATEGORIES, type InventoryItem } from '@/data/inventory';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function GearPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // A failed load used to leave the page blank below the header — no spinner,
  // no message, nothing. This is a public page, so "blank" reads as "broken"
  // to anyone evaluating the studio.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) throw error;
        setInventory((data || []) as InventoryItem[]);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group items by category for the manifest layout
  const groupedInventory = ALL_CATEGORIES.reduce((acc, category) => {
    const items = filteredInventory.filter(item => item.category === category);
    if (items.length > 0) acc[category] = items;
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const totalValue = inventory.reduce((sum, item) => sum + (item.replacement * item.qty), 0);

  const scrollToCategory = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 160; // Adjust for sticky header and nav
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-300 pt-32 pb-12 px-4 md:px-8 lg:px-12 font-mono text-xs">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-4">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity mb-4"
            >
              ← Back to site
            </Link>
            <div>
              <h1 className="text-white text-3xl font-black tracking-tighter uppercase mb-2">Internal Equipment List</h1>
              <p className="text-[10px] text-zinc-500 tracking-widest uppercase">Zipline Media Production Assets // Inventory Control</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="FILTER BY NAME OR CATEGORY..."
              className="w-full bg-white/5 border border-white/10 rounded-sm py-3 pl-10 pr-4 text-[10px] tracking-widest uppercase focus:outline-none focus:border-accent transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Loading State or Inventory UI */}
        {isLoading ? (
          <div className="flex justify-center items-center py-32">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : loadFailed ? (
          <div className="py-32 text-center space-y-3">
            <p className="text-sm text-white font-bold uppercase tracking-widest">Equipment list unavailable</p>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto leading-relaxed">
              We couldn&apos;t load the inventory just now. Refresh in a moment, or{' '}
              <Link href="/#contact" className="text-accent hover:underline">get in touch</Link>{' '}
              and we&apos;ll send the list over directly.
            </p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="py-32 text-center">
            <p className="text-[11px] text-zinc-400 tracking-widest uppercase">
              The equipment list is being updated — check back shortly.
            </p>
          </div>
        ) : filteredInventory.length === 0 ? (
          // Searching is the common case for arriving here, and a silent blank
          // makes it look like the filter broke rather than simply missing.
          <div className="py-32 text-center space-y-3">
            <p className="text-[11px] text-zinc-400 tracking-widest uppercase">
              No gear matches &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-accent hover:underline uppercase tracking-widest font-bold"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <>
            {/* Quick Nav Tabs */}
            <div className="sticky top-20 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-y border-white/5 py-4 mb-12 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {Object.keys(groupedInventory).map((category) => (
                  <button
                    key={category}
                    onClick={() => scrollToCategory(category.replace(/\s+/g, '-'))}
                    className="px-3 py-1.5 rounded-full border border-white/10 text-[11px] md:text-[9px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Manifest Sections */}
            <div className="space-y-20">
              {Object.entries(groupedInventory).map(([category, items]) => (
                <section key={category} id={category.replace(/\s+/g, '-')} className="scroll-mt-40">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-6 flex items-center gap-4">
                    <span>{category}</span>
                    <div className="h-px bg-accent/20 flex-1" />
                  </h2>

                  <div className="relative">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase text-left border-b border-white/10">
                          <th className="pb-4 font-black w-16">Preview</th>
                          <th className="pb-4 font-black w-12 text-center">Qty</th>
                          <th className="pb-4 font-black pl-4">Item Description</th>
                          <th className="pb-4 font-black text-right hidden md:table-cell">Replacement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {items.map((item, idx) => (
                          <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="py-3">
                              <motion.div 
                                whileHover={{ 
                                  scale: 4.5, 
                                  x: 20,
                                  zIndex: 50, 
                                  boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.8)" 
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                style={{ originX: 0, originY: 0.5 }}
                                className="relative w-12 h-12 bg-white rounded-sm overflow-hidden border border-white/10"
                              >
                                {item.image ? (
                                  <Image 
                                    src={item.image}
                                    alt=""
                                    fill
                                    sizes="120px"
                                    className="object-contain p-1"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[11px] md:text-[8px] text-zinc-700 font-mono">NO IMG</div>
                                )}
                              </motion.div>
                            </td>
                            <td className="py-3 text-center font-mono">
                              <span className={`text-xs font-bold ${item.qty > 1 ? 'text-accent' : 'text-zinc-500'}`}>
                                {item.qty}x
                              </span>
                            </td>
                            <td className="py-3 pl-4">
                              <div className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                                {item.name}
                              </div>
                            </td>
                            <td className="py-3 text-right hidden md:table-cell font-mono text-zinc-500 group-hover:text-zinc-300">
                              ${item.replacement.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            {/* Footer Summary */}
            <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 opacity-50 text-[10px] tracking-widest uppercase">
              <div>
                Total Line Items: {filteredInventory.length}
              </div>
              <div className="font-black text-zinc-300">
                Estimated Total Replacement Value: <span className="text-white ml-2 text-sm">${totalValue.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}