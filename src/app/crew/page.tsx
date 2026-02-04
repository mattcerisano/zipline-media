'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Calendar as CalendarIcon, Users, Briefcase, LogOut, FileText, Coffee, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

import Rentals from '@/components/crew/Rentals';
import Jobs from '@/components/crew/Jobs';
import SlateJobs from '@/components/crew/SlateJobs';
import Rolodex from '@/components/crew/Rolodex';
import ProductionCalendar from '@/components/crew/ProductionCalendar';
import Meetings from '@/components/crew/Meetings';
import Dashboard from '@/components/crew/Dashboard';

type TabId = 'jobs' | 'rolodex' | 'calendar' | 'gear' | 'slate' | 'meetings' | 'dashboard';

interface TabItem {
  id: TabId;
  label: string;
  icon: any;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jobs', label: 'Production', icon: Briefcase },
  { id: 'slate', label: 'Shoots', icon: FileText },
  { id: 'rolodex', label: 'Rolodex', icon: Users },
  { id: 'meetings', label: 'Meetings', icon: Coffee },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'gear', label: 'Gear Builder', icon: Camera },
];

function SortableTab({ tab, isActive, onClick }: { tab: TabItem; isActive: boolean; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = tab.icon;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-xs font-bold tracking-[0.2em] uppercase transition-colors duration-200 shrink-0 cursor-grab active:cursor-grabbing
        ${isActive ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}
      `}
    >
      <Icon className={`w-3 h-3 ${isActive ? 'text-accent' : ''}`} />
      {tab.label}
    </button>
  );
}

export default function CrewPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [tabs, setTabs] = useState<TabItem[]>(DEFAULT_TABS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedOrder = localStorage.getItem('zipline_crew_tab_order');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder) as TabId[];
        // Reconstruct tab array based on saved ID order
        const reorderedTabs = orderIds
          .map(id => DEFAULT_TABS.find(t => t.id === id))
          .filter((t): t is TabItem => !!t);
        
        // If we found valid tabs, use them. 
        // Also check if any new default tabs are missing and append them (future proofing)
        if (reorderedTabs.length > 0) {
            const missing = DEFAULT_TABS.filter(dt => !orderIds.includes(dt.id));
            setTabs([...reorderedTabs, ...missing]);
        }
      } catch (e) {
        console.error("Failed to parse tab order", e);
      }
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Save to local storage
        localStorage.setItem('zipline_crew_tab_order', JSON.stringify(newOrder.map(t => t.id)));
        
        return newOrder;
      });
    }
  };

  if (!mounted) return null; // Prevent hydration mismatch

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
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
          >
            <SortableContext 
              items={tabs.map(t => t.id)} 
              strategy={horizontalListSortingStrategy}
            >
              {tabs.map((tab) => (
                <SortableTab 
                  key={tab.id} 
                  tab={tab} 
                  isActive={activeTab === tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                />
              ))}
            </SortableContext>
          </DndContext>
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
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'jobs' && <Jobs />}
          {activeTab === 'slate' && <SlateJobs />}
          {activeTab === 'rolodex' && <Rolodex />}
          {activeTab === 'meetings' && <Meetings />}
          {activeTab === 'calendar' && <ProductionCalendar />}
          {activeTab === 'gear' && <Rentals />}
        </motion.div>
      </main>
    </div>
  );
}