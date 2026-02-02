'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Calendar as CalendarIcon, Users, Briefcase, LogOut, FileText } from 'lucide-react';
import Link from 'next/link';
import Rentals from '@/components/crew/Rentals';
import Jobs from '@/components/crew/Jobs';
import SlateJobs from '@/components/crew/SlateJobs';
import Rolodex from '@/components/crew/Rolodex';
import ProductionCalendar from '@/components/crew/ProductionCalendar';

type Tab = 'jobs' | 'rolodex' | 'calendar' | 'gear' | 'slate';

export default function CrewPage() {
  const [activeTab, setActiveTab] = useState<Tab>('gear');

  const tabs = [
    { id: 'jobs', label: 'Production', icon: Briefcase },
    { id: 'slate', label: 'Call Sheets', icon: FileText },
    { id: 'rolodex', label: 'Rolodex', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'gear', label: 'Gear Builder', icon: Camera },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/5 h-20 flex items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="hover:opacity-70 transition-opacity">
            <img src="/Zipline Logo 10x10_Black Text Blue.png" alt="ZIPLINE" className="h-8 w-auto" />
          </Link>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          <h1 className="text-sm font-black tracking-[0.2em] uppercase hidden md:block">Crew Portal</h1>
        </div>

        <nav className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5 overflow-x-auto md:max-w-none no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`
                  relative flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 shrink-0
                  ${isActive ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}
                `}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-accent' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <Link 
          href="/"
          className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 hover:opacity-100 hover:text-red-500 transition-all shrink-0"
        >
          <LogOut className="w-3 h-3" />
          <span className="hidden md:inline">Exit</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 px-4 md:px-6 pb-20 max-w-[1600px] mx-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'jobs' && <Jobs />}
          {activeTab === 'slate' && <SlateJobs />}
          {activeTab === 'rolodex' && <Rolodex />}
          {activeTab === 'calendar' && <ProductionCalendar />}
          {activeTab === 'gear' && <Rentals />}
        </motion.div>
      </main>
    </div>
  );
}