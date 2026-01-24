'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, User, AlertCircle 
} from 'lucide-react';
import { Job, STORAGE_KEY_JOBS } from './types';

export default function ProductionCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);

  // Load jobs from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_JOBS);
    if (saved) {
      setJobs(JSON.parse(saved));
    }
  }, []);

  // Calendar Helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    const days = [];
    
    // Padding for previous month
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Actual days
    for (let i = 1; i <= daysCount; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayJobs = jobs.filter(j => j.shoot_date === dateStr);
      days.push({ day: i, date: dateStr, jobs: dayJobs });
    }
    
    return days;
  }, [currentDate, jobs]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const goToToday = () => setCurrentDate(new Date());

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Booked': return 'bg-green-500';
      case 'Hold': return 'bg-yellow-500';
      case 'Planning': return 'bg-blue-500';
      default: return 'bg-white/20';
    }
  };

  return (
    <div className="bg-neutral-900/30 border border-white/10 rounded-2xl p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-accent" />
          {monthYear}
        </h2>
        
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToToday} className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 rounded-md transition-colors border-x border-white/5">
            Today
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 mb-2 border-b border-white/5 pb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest opacity-30">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
        {calendarDays.map((d, i) => {
          const isToday = d.date === new Date().toISOString().split('T')[0];
          
          return (
            <div 
              key={i} 
              className={`min-h-[100px] md:min-h-[140px] bg-black/40 p-2 transition-colors hover:bg-black/60 relative group ${!d.day ? 'opacity-20' : ''}`}
            >
              {d.day && (
                <>
                  <span className={`text-xs font-black mb-2 block ${isToday ? 'text-accent' : 'opacity-40'}`}>
                    {d.day}
                  </span>
                  
                  <div className="space-y-1">
                    {d.jobs?.map(job => (
                      <motion.div 
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={job.id}
                        className="p-1.5 rounded bg-white/5 border-l-2 border-accent group/job hover:bg-white/10 cursor-pointer overflow-hidden transition-all"
                        style={{ borderLeftColor: `var(--accent)` }}
                      >
                        <p className="text-[9px] font-black uppercase leading-tight truncate">{job.title}</p>
                        <div className="flex items-center gap-1 mt-0.5 opacity-40">
                           <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(job.job_status)}`} />
                           <p className="text-[7px] font-bold uppercase tracking-tighter truncate">{job.client_name || 'No Client'}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-6 border-t border-white/5 pt-6 opacity-40">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Booked
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <div className="w-2 h-2 rounded-full bg-yellow-500" /> Hold
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Planning
        </div>
      </div>
    </div>
  );
}
