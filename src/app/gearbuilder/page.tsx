'use client';

import React, { useState, useEffect } from 'react';
import Rentals from '@/components/gearbuilder/Rentals';
import { Lock } from 'lucide-react';

const PASSWORD = 'zipline2026';

export default function GearBuilderPage() {
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zipline_gb_auth') === 'true';
    }
    return false;
  });
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      localStorage.setItem('zipline_gb_auth', 'true');
    } else {
      setError('Incorrect password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Gear Builder Access</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mt-1">Zipline Media Internal Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full bg-black/50 border border-white/10 p-4 outline-none focus:border-accent transition-colors text-center text-xl font-bold rounded-xl"
              />
            </div>
            {error && (
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>
            )}
            <button 
              type="submit"
              className="w-full bg-accent text-white py-4 font-black tracking-widest uppercase text-xs hover:bg-white hover:text-black transition-all rounded-xl shadow-lg shadow-accent/20"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 md:px-8 lg:px-12 pt-24 md:pt-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-accent">Active Manifest</p>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">Gear Builder</h1>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem('zipline_gb_auth');
              setIsAuthenticated(false);
            }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 hover:opacity-100 hover:text-red-500 transition-all border border-white/10 px-4 py-2 rounded-lg"
          >
            Lock Session
          </button>
        </div>

        <Rentals />
      </div>
    </main>
  );
}
