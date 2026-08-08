'use client';

import React from 'react';
import { Monitor, Sun, CloudSun, Moon } from 'lucide-react';
import { useStudioTheme, type ThemeChoice } from './ThemeProvider';

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ElementType; hint: string }[] = [
  { value: 'system', label: 'System', icon: Monitor, hint: 'Match your device' },
  { value: 'light', label: 'Light', icon: Sun, hint: 'Bright & clean' },
  { value: 'dim', label: 'Dim', icon: CloudSun, hint: 'Soft charcoal' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Pure black' },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useStudioTheme();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon, hint }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border text-center transition-all cursor-pointer ${
              active
                ? 'border-accent/40 bg-accent/10 text-white shadow-md shadow-accent/5'
                : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-accent' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            <span className="text-[11px] md:text-[8px] font-bold uppercase tracking-wider text-white/30">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}
