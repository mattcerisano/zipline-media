'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Clock, Calendar as CalendarIcon, 
  MessageSquare, Video, Film, CheckCircle2,
  TrendingUp, Users, AlertCircle, ExternalLink
} from 'lucide-react';
import { STORAGE_KEY_JOBS, STORAGE_KEY_MEETINGS } from './types';

const ExternalCard = ({ icon: Icon, title, desc, link, color }: any) => (
  <a href={link} target="_blank" rel="noreferrer" className="group block">
      <div className={`h-full bg-neutral-900/50 border border-white/5 p-6 rounded-2xl hover:bg-white/5 transition-all flex flex-col justify-between relative overflow-hidden`}>
          <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity ${color}`}>
              <Icon className="w-12 h-12" />
          </div>
          <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-1 group-hover:text-white transition-colors text-white/70">{title}</h3>
              <p className="text-xs opacity-40">{desc}</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">
              Open App <ExternalLink className="w-3 h-3" />
          </div>
      </div>
  </a>
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeJobs: 0,
    upcomingShoots: 0,
    pendingReviews: 0,
    meetingsToday: 0
  });

  useEffect(() => {
    // Mock data loading (replace with real data/Supabase later)
    if (typeof window !== 'undefined') {
        const jobs = JSON.parse(localStorage.getItem(STORAGE_KEY_JOBS) || '[]');
        const meetings = JSON.parse(localStorage.getItem(STORAGE_KEY_MEETINGS) || '[]');
        
        const today = new Date().toISOString().split('T')[0];
        
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStats({
            activeJobs: jobs.filter((j: any) => ['queue', 'editing', 'review'].includes(j.status)).length,
            upcomingShoots: jobs.filter((j: any) => j.shoot_date && j.shoot_date >= today).length,
            pendingReviews: jobs.filter((j: any) => j.status === 'review').length,
            meetingsToday: meetings.filter((m: any) => m.date === today).length
        });
    }
  }, []);

  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar p-2">
        <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Command Center</h1>
                    <p className="text-sm font-bold uppercase tracking-widest opacity-40">Zipline Media OS • v1.0</p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-3xl font-mono font-bold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">{new Date().toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</p>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-black">{stats.activeJobs}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Active Jobs</p>
                    </div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl text-purple-500">
                        <Video className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-black">{stats.upcomingShoots}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Upcoming Shoots</p>
                    </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-500">
                        <Eye className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-black">{stats.pendingReviews}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pending Review</p>
                    </div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-green-500/20 rounded-xl text-green-500">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-black">{stats.meetingsToday}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Meetings Today</p>
                    </div>
                </div>
            </div>

            {/* Integrations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* External Tools */}
                <div className="space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Integrations
                    </h2>
                    <div className="grid grid-cols-1 gap-4 h-full">
                        <ExternalCard 
                            icon={MessageSquare} 
                            title="Discord" 
                            desc="Team Comms & Alerts" 
                            link="https://discord.com/app"
                            color="text-indigo-500"
                        />
                        <ExternalCard 
                            icon={Video} 
                            title="Frame.io" 
                            desc="Review & Approval" 
                            link="https://frame.io"
                            color="text-purple-500"
                        />
                        <ExternalCard 
                            icon={Film} 
                            title="Vimeo" 
                            desc="Hosting & Analytics" 
                            link="https://vimeo.com/manage/videos"
                            color="text-blue-400"
                        />
                    </div>
                </div>

                {/* Recent Activity / Feed */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Production Feed
                    </h2>
                    <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-1 overflow-hidden min-h-[300px]">
                        {/* Mock Feed Items */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors cursor-default">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold">New Meeting Logged</p>
                                    <p className="text-xs opacity-40 uppercase tracking-wider">Strategy Sync • 10:00 AM</p>
                                </div>
                                <span className="text-[10px] font-mono opacity-30">Just now</span>
                            </div>
                            <div className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors cursor-default">
                                <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold">Rental Confirmed</p>
                                    <p className="text-xs opacity-40 uppercase tracking-wider">Red Komodo Package • Client B</p>
                                </div>
                                <span className="text-[10px] font-mono opacity-30">2h ago</span>
                            </div>
                            <div className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors cursor-default">
                                <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold">Status Update: Review</p>
                                    <p className="text-xs opacity-40 uppercase tracking-wider">Spring Campaign 2026</p>
                                </div>
                                <span className="text-[10px] font-mono opacity-30">5h ago</span>
                            </div>
                            {/* Empty State / Future Real Data */}
                            <div className="p-8 text-center opacity-20">
                                <p className="text-[10px] uppercase tracking-widest">Connect Supabase to see real-time activity</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}

// Icon Helper for mock
import { Eye } from 'lucide-react';
