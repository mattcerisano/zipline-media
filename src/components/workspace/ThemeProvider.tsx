'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * Studio OS theming.
 *
 * The whole app is built dark-first using Tailwind's `white` as "foreground"
 * and `black` as "background". Tailwind v4 compiles those utilities to
 * `var(--color-white)` / `var(--color-black)`, so we can flip the entire UI by
 * overriding a handful of color variables on the `.studio-os` wrapper (see
 * globals.css) instead of editing a thousand class names. This provider just
 * decides *which* theme is active and writes it to `data-theme` on that wrapper.
 */

export type ThemeChoice = 'system' | 'light' | 'dim' | 'dark';
export type ResolvedTheme = 'light' | 'dim' | 'dark';

const STORAGE_KEY = 'studio-os-theme';

interface ThemeContextValue {
  /** The user's stored preference (may be "system"). */
  theme: ThemeChoice;
  /** The concrete theme currently applied to the DOM. */
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useStudioTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useStudioTheme must be used within <ThemeProvider>');
  }
  return ctx;
}

function prefersLight(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  );
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return prefersLight() ? 'light' : 'dark';
  return choice;
}

// Applies the saved theme before first paint so light-mode users don't flash
// the default dark theme. Runs as a following sibling of the wrapper, so the
// element already exists in the DOM when it executes.
const NO_FLASH_SCRIPT = `(function(){try{var c=localStorage.getItem('${STORAGE_KEY}')||'system';var r=c;if(c==='system'){r=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var el=document.getElementById('studio-os-root');if(el){el.setAttribute('data-theme',r);}}catch(e){}})();`;

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  const apply = useCallback((choice: ThemeChoice) => {
    const r = resolve(choice);
    setResolvedTheme(r);
    rootRef.current?.setAttribute('data-theme', r);
  }, []);

  // Hydrate the stored preference and apply it before the browser paints.
  useLayoutEffect(() => {
    let stored: ThemeChoice = 'system';
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as ThemeChoice) || 'system';
    } catch {
      /* localStorage unavailable — fall back to system */
    }
    setThemeState(stored);
    apply(stored);
  }, [apply]);

  // While following the OS, react to the user flipping their system appearance.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback(
    (t: ThemeChoice) => {
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
      setThemeState(t);
      apply(t);
    },
    [apply],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      <div id="studio-os-root" className="studio-os" ref={rootRef} suppressHydrationWarning>
        {children}
      </div>
      <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
    </ThemeContext.Provider>
  );
}
