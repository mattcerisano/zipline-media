'use client';

import { useEffect } from 'react';

// Registers the PWA service worker on the client. Rendered once from the root layout.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Only register in production to avoid caching dev/HMR assets.
    if (process.env.NODE_ENV !== 'production') return;

    // The worker caches production data read from Supabase, but it can't read
    // NEXT_PUBLIC_* itself — env vars are inlined into the app bundle, not the
    // worker. Pass the project origin through the registration URL so the
    // worker knows which cross-origin host holds our data. (Changing this query
    // string is also what prompts browsers to pick up a new worker build.)
    const dataOrigin = (() => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        return url ? new URL(url).origin : '';
      } catch {
        return '';
      }
    })();

    const register = () => {
      const swUrl = dataOrigin
        ? `/sw.js?data=${encodeURIComponent(dataOrigin)}`
        : '/sw.js';
      navigator.serviceWorker.register(swUrl).catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    };

    // Waiting on the `load` event alone silently never registered: effects run
    // after hydration, which is after `load` has already fired, so the listener
    // was attached to an event that had come and gone. Registration is deferred
    // only when the page genuinely hasn't finished loading yet.
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
