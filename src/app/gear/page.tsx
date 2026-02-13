'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { INVENTORY } from '@/data/inventory';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GearPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInventory = INVENTORY.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalValue = INVENTORY.reduce((sum, item) => sum + (item.replacement * item.qty), 0);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-300 pt-32 pb-12 px-4 md:px-8 lg:px-12 font-mono text-xs">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-white/10 pb-8">
          <div className="space-y-4">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity mb-4"
            >
              ← Back to site
            </Link>
            <div>
              <h1 className="text-white text-3xl font-black tracking-tighter uppercase mb-2">Internal Gear Manifest</h1>
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

        {/* Table Section */}
        <div className="relative px-4 md:px-0">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase text-left border-b border-white/10">
                <th className="pb-4 font-black w-16">Preview</th>
                <th className="pb-4 font-black w-12 text-center">Qty</th>
                <th className="pb-4 font-black pl-4">Item Description</th>
                <th className="pb-4 font-black hidden sm:table-cell">Category</th>
                <th className="pb-4 font-black text-right hidden md:table-cell">Replacement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredInventory.map((item, idx) => (
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
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-700 font-mono">NO IMG</div>
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
                    {/* Category visible on small screens since column is hidden */}
                    <div className="sm:hidden text-[8px] uppercase tracking-widest text-zinc-600 mt-1">
                      {item.category}
                    </div>
                  </td>
                  <td className="py-3 hidden sm:table-cell">
                    <span className="text-[9px] px-2 py-1 bg-white/5 rounded-full tracking-widest uppercase font-bold text-zinc-500">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 text-right hidden md:table-cell font-mono">
                    <span className="text-[10px] tabular-nums font-medium text-zinc-500 group-hover:text-zinc-300">
                      ${item.replacement.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      </div>
    </main>
  );
}