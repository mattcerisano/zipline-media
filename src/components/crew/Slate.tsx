'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Calendar as CalendarIcon } from 'lucide-react';
import Rolodex from '@/components/crew/Rolodex';
import SlateJobs from '@/components/crew/SlateJobs';

// Placeholder Calendar Component
const CalendarPlaceholder = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center opacity-50 space-y-4">
    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
      <CalendarIcon className="w-8 h-8" />
    </div>
    <div>
      <h2 className="text-xl font-black uppercase tracking-widest">Production Calendar</h2>
      <p className="text-xs font-bold tracking-[0.2em] mt-2 opacity-60">Coming Soon</p>
    </div>
  </div>
);

type SubTab = 'jobs' | 'rolodex' | 'calendar';

export default function Slate() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('jobs');

  const tabs = [
    { id: 'jobs', label: 'Call Sheets', icon: FileText },
    { id: 'rolodex', label: 'Rolodex', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-neutral-900/80 p-1 rounded-full border border-white/10 backdrop-blur-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as SubTab)}
                className={`
                  relative flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300
                  ${isActive ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}
                `}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-accent' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeSubTab === 'jobs' && <SlateJobs />}
        {activeSubTab === 'rolodex' && <Rolodex />}
        {activeSubTab === 'calendar' && <CalendarPlaceholder />}
      </motion.div>
    </div>
  );
}
