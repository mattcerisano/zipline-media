'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { INVENTORY, ALL_CATEGORIES } from '@/data/inventory';
import { motion, AnimatePresence } from 'framer-motion';

// Optimized Tooltip Component - Isolates mouse tracking re-renders
const ImageTooltip = ({ src }: { src: string }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{ 
        position: 'fixed', 
        left: pos.x + 20, 
        top: pos.y - 140,
        zIndex: 100 
      }}
      className="pointer-events-none hidden md:block"
    >
      <div className="w-64 h-64 bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 p-2 backdrop-blur-xl">
        <div className="w-full h-full bg-white rounded-xl overflow-hidden relative">
          <Image 
            src={src} 
            alt="Gear Preview" 
            fill
            sizes="256px"
            className="object-contain p-2"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default function GearPage() {
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  const groupedInventory = ALL_CATEGORIES.reduce((acc, category) => {
    const items = INVENTORY.filter(item => item.category === category);
    if (items.length > 0) {
      acc[category] = items; // Preserves manual sort order from inventory.ts
    }
    return acc;
  }, {} as Record<string, typeof INVENTORY>);

  const totalValue = INVENTORY.reduce((sum, item) => sum + (item.replacement * item.qty), 0);

  return (
    <main className="min-h-screen bg-neutral-950 text-white selection:bg-accent selection:text-white py-20 px-6 md:px-12 lg:px-32 cursor-default">
      
      <AnimatePresence>
        {hoveredImage && <ImageTooltip src={hoveredImage} />}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-16">
        {Object.entries(groupedInventory).map(([category, items]) => (
          <section key={category} className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent pl-2 opacity-60 border-b border-white/5 pb-2 sticky top-0 bg-neutral-950/90 backdrop-blur z-10">
              {category}
            </h2>
            
            <div className="space-y-0.5">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className="group relative flex items-center justify-between py-2 px-2 hover:bg-white/5 transition-colors rounded-md border-b border-white/[0.02]"
                >
                  <div className="flex items-baseline gap-2 cursor-help"
                    onMouseEnter={() => item.image && setHoveredImage(item.image)}
                    onMouseLeave={() => setHoveredImage(null)}
                  >
                    {item.qty > 1 && (
                      <span className="text-xs font-black text-neutral-400 shrink-0">
                        {item.qty}x —
                      </span>
                    )}
                    <h3 className="text-xs md:text-sm font-bold tracking-tight text-neutral-400 group-hover:text-white transition-colors">
                      {item.name}
                    </h3>
                  </div>

                  <div className="hidden md:block opacity-0 group-hover:opacity-30 transition-opacity">
                     <span className="text-[9px] font-bold tracking-widest text-neutral-400 tabular-nums uppercase">
                        Ref: ${item.replacement.toLocaleString()}
                     </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="max-w-4xl mx-auto mt-32 pt-8 border-t border-white/5 flex justify-end opacity-20 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-black tracking-[0.3em] uppercase">
          Total Value: <span className="text-white ml-2">${totalValue.toLocaleString()}</span>
        </span>
      </div>

    </main>
  );
}