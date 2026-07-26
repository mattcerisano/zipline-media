'use client';

import { useSyncExternalStore } from 'react';

// Tracks whether the production data on screen came off the network or out of
// the service worker's cache.
//
// This deliberately does not key off `navigator.onLine`. That flag reports
// whether an interface is up, not whether anything is reachable — a venue wifi
// that needs a captive-portal login, or a phone showing one bar of LTE in a
// basement, both report `onLine === true` while every request times out. Those
// are exactly the conditions this feature exists for. So the state here is
// driven by what actually happened to real requests: the service worker
// broadcasts whether it answered from the network or from cache, and this
// module just records the verdict.

export interface OfflineState {
  /** The most recent production-data read was served from cache, not network. */
  stale: boolean;
  /** When that cached copy was stored (ISO), or null if nothing was cached. */
  cachedAt: string | null;
  /** Last time a production-data read succeeded over the network (ISO). */
  lastSync: string | null;
}

const LAST_SYNC_KEY = 'zipline:last-data-sync';

// A cached copy is only worth reusing for so long. Past this the UI stops
// saying "a few minutes ago" and starts warning the data is from another day.
export const STALE_WARN_MS = 12 * 60 * 60 * 1000;

const SERVER_STATE: OfflineState = { stale: false, cachedAt: null, lastSync: null };

let state: OfflineState = SERVER_STATE;
let listeners: Array<() => void> = [];
let started = false;

function emit() {
  for (const l of listeners) l();
}

function setState(next: OfflineState) {
  state = next;
  emit();
}

function readStoredSync(): string | null {
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null; // private mode / storage disabled — the banner just loses its timestamp
  }
}

function writeStoredSync(at: string) {
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, at);
  } catch {
    /* non-fatal */
  }
}

function onFresh(at: string) {
  // Every successful read broadcasts, which on a busy panel is dozens per
  // minute. Only wake React when the offline flag actually flips or the
  // timestamp has moved enough to change what the UI would render.
  const movedEnough =
    !state.lastSync || new Date(at).getTime() - new Date(state.lastSync).getTime() > 60_000;

  writeStoredSync(at);
  if (!state.stale && !movedEnough) {
    state = { ...state, lastSync: at }; // record silently, no re-render
    return;
  }
  setState({ stale: false, cachedAt: null, lastSync: at });
}

function onStale(cachedAt: string | null) {
  if (state.stale && state.cachedAt === cachedAt) return;
  setState({ ...state, stale: true, cachedAt });
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;

  state = { ...state, lastSync: readStoredSync() };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'zipline-data-fresh' && typeof data.at === 'string') onFresh(data.at);
      else if (data.type === 'zipline-data-stale') onStale(data.cachedAt ?? null);
    });
  }

  // `offline` is a reliable negative — the interface really is down — so it can
  // flip the banner on immediately. `online` is only a hint that it's worth
  // retrying, never proof of reachability, so recovery waits for a read to
  // actually succeed.
  window.addEventListener('offline', () => onStale(state.cachedAt));
}

function subscribe(listener: () => void) {
  start();
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_STATE;
}

/** Live offline/staleness state for the production data on screen. */
export function useOfflineStatus(): OfflineState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// A shared 30-second clock, exposed as a subscribable store so relative
// timestamps ("saved 12m ago") actually advance while they're on screen.
// Reading the clock during render would be impure and would freeze the label at
// whatever it said when the component last happened to re-render.
let clockNow = 0;
let clockListeners: Array<() => void> = [];
let clockTimer: ReturnType<typeof setInterval> | null = null;

function clockSubscribe(listener: () => void) {
  clockListeners.push(listener);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const l of clockListeners) l();
    }, 30_000);
  }
  return () => {
    clockListeners = clockListeners.filter((l) => l !== listener);
    // Last subscriber left — stop waking the device up.
    if (clockListeners.length === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/**
 * Current time, refreshed every 30s, for components rendering relative times.
 * Returns 0 before the first tick (server render and the very first frame).
 */
export function useSlowClock(): number {
  return useSyncExternalStore(
    clockSubscribe,
    () => clockNow,
    () => 0
  );
}

/**
 * Drops every cached production record. Call on sign-out so the next person to
 * use a shared device can't pull the previous user's jobs out of the cache.
 */
export function clearOfflineData() {
  try {
    window.localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    /* non-fatal */
  }
  state = { stale: false, cachedAt: null, lastSync: null };
  emit();
  navigator.serviceWorker?.controller?.postMessage({ type: 'zipline-clear-data' });
}
