'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  Lock,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  ExternalLink,
  Briefcase,
  User as UserIcon,
  Mail,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Rentals from '@/components/gearbuilder/Rentals';
import TeamBuilder from '@/components/teambuilder/TeamBuilder';
import Rolodex from '@/components/teambuilder/Rolodex';
import Slate from '@/components/teambuilder/Slate';
import EditTracker from '@/components/teambuilder/EditTracker';
import ProductionCalendar from '@/components/gearbuilder/ProductionCalendar';

type Tab = 'dashboard' | 'slate' | 'gear' | 'edits' | 'rolodex';

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setIsLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-10 shadow-2xl relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20">
              <Lock className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Studio OS</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 mt-2">Zipline Media Internal Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 ml-1 text-white flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="PRODUCTIONS@ZIPLINE.MEDIA"
                required
                className="w-full bg-black/50 border border-white/10 p-4 outline-none focus:border-accent transition-all text-sm font-bold rounded-xl text-white placeholder:opacity-20 uppercase"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 ml-1 text-white flex items-center gap-2">
                <Lock className="w-3 h-3" /> Password
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-black/50 border border-white/10 p-4 outline-none focus:border-accent transition-all text-sm font-bold rounded-xl text-white placeholder:opacity-20"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl"
              >
                <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isLoginLoading}
              className="w-full bg-accent text-white py-5 font-black tracking-widest uppercase text-xs hover:bg-white hover:text-black transition-all rounded-xl shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isLoginLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Unlock Command Center'}
            </button>
            
            <p className="text-center text-[8px] font-bold uppercase tracking-widest text-white/20">
              Authorized access only. all sessions are logged.
            </p>
          </form>
        </div>
      </div>
    );
  }

  const NavItem = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === id 
          ? 'bg-accent text-white shadow-lg shadow-accent/20' 
          : 'text-white/40 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className={`font-bold uppercase tracking-widest text-[10px] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white flex overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-neutral-900/50 border-r border-white/10 flex flex-col relative z-50 shrink-0"
      >
        <div className="p-6 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-black text-xs">Z</div>
            <span className="font-black uppercase tracking-tighter text-lg">Studio</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="slate" label="Slate" icon={Briefcase} />
          <NavItem id="edits" label="Edit Tracker" icon={Scissors} />
          <NavItem id="gear" label="Gear Builder" icon={Package} />
          <NavItem id="rolodex" label="Rolodex" icon={Settings} />
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className={`mb-4 px-4 flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
             <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                <UserIcon className="w-3 h-3 text-white/40" />
             </div>
             <p className="text-[8px] font-black uppercase tracking-widest text-white/40 truncate">
               {session.user.email}
             </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/20 hover:text-red-500 transition-colors rounded-xl group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span className={`font-bold uppercase tracking-widest text-[10px] ${!isSidebarOpen && 'hidden'}`}>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <header className="sticky top-0 z-40 bg-black/50 backdrop-blur-md border-b border-white/5 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.5em] text-accent mb-1">
              {activeTab === 'dashboard' ? 'Studio Overview' : activeTab === 'slate' ? 'Production Schedule' : activeTab === 'edits' ? 'Post-Production Pipeline' : activeTab === 'gear' ? 'Inventory & Manifests' : 'Contacts & Clients'}
            </h2>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-white">
              {activeTab === 'dashboard' ? 'Command Center' : activeTab === 'slate' ? 'Slate' : activeTab === 'edits' ? 'Edit Tracker' : activeTab === 'gear' ? 'Gear Builder' : 'Rolodex'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Live Database Sync</span>
             </div>
          </div>
        </header>

        <div className="p-6 md:p-8 lg:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardOverview 
                  onSwitchTab={setActiveTab} 
                  onOpenCalendar={() => setIsCalendarOpen(true)} 
                />
              )}
              {activeTab === 'slate' && <Slate />}
              {activeTab === 'edits' && <EditTracker />}
              {activeTab === 'gear' && <Rentals />}
              {activeTab === 'rolodex' && <Rolodex />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Calendar Modal */}
        <AnimatePresence>
          {isCalendarOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-md">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="w-full max-w-6xl bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
               >
                 <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter text-white">Production Calendar</h2>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-40 text-white">Live Studio Schedule</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => window.open('https://calendar.google.com', '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-white"
                      >
                        Open Google Calendar <ExternalLink className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => setIsCalendarOpen(false)}
                        className="p-3 hover:bg-white/5 rounded-full transition-colors text-white"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-black/10">
                    <ProductionCalendar 
                      onSelectJob={(job) => {
                        setActiveTab('gear');
                        setIsCalendarOpen(false);
                      }}
                    />
                 </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function DashboardOverview({ 
  onSwitchTab, 
  onOpenCalendar 
}: { 
  onSwitchTab: (tab: Tab) => void, 
  onOpenCalendar: () => void 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard 
        title="Active Jobs" 
        value="12" 
        trend="+2 this week"
        icon={LayoutDashboard}
      />
      <StatCard 
        title="Gear in Field" 
        value="45 items" 
        trend="85% utilization"
        icon={Package}
      />
      <StatCard 
        title="Total Contacts" 
        value="128" 
        trend="3 new today"
        icon={Users}
      />

      <div className="md:col-span-2 lg:col-span-3 mt-8">
        <h3 className="text-lg font-black uppercase tracking-tighter mb-6 text-white">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton 
            label="Production Slate" 
            onClick={() => onSwitchTab('slate')}
            icon={Briefcase}
          />
          <ActionButton 
            label="Build Gear List" 
            onClick={() => onSwitchTab('gear')}
            icon={Package}
          />
          <ActionButton 
            label="Assemble Crew" 
            onClick={() => onSwitchTab('slate')}
            icon={Users}
          />
          <ActionButton 
            label="View Calendar" 
            onClick={onOpenCalendar}
            icon={LayoutDashboard}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon }: { title: string, value: string, trend: string, icon: any }) {
  return (
    <div className="bg-neutral-900/40 border border-white/10 p-6 rounded-2xl hover:border-accent/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-accent/10 transition-colors">
          <Icon className="w-5 h-5 text-white/40 group-hover:text-accent transition-colors" />
        </div>
        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{trend}</span>
      </div>
      <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-1">{title}</h3>
      <p className="text-3xl font-black tracking-tighter text-white">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick, icon: Icon }: { label: string, onClick: () => void, icon: any }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-8 bg-neutral-900/40 border border-white/10 rounded-2xl hover:bg-accent hover:border-accent transition-all group"
    >
      <Icon className="w-8 h-8 mb-4 text-accent group-hover:text-white transition-colors" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center text-white">{label}</span>
    </button>
  );
}
