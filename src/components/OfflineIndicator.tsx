'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, AlertTriangle } from 'lucide-react';
import { useOfflineStatus, useSlowClock, STALE_WARN_MS } from '@/lib/offline-status';
import { timeAgo } from '@/lib/date';

// Tells the crew that what they're looking at came out of the cache rather than
// off the network, and how old it is.
//
// This matters more than the caching itself. A gear list that silently shows
// yesterday's numbers is worse than one that fails to load — the failure is
// obvious, the stale list isn't. So the banner is unmissable, always carries a
// timestamp, and escalates once the data is old enough that someone could
// reasonably have changed it since.

export default function OfflineIndicator() {
  const { stale, cachedAt, lastSync } = useOfflineStatus();

  // The banner body is a separate component so its 30s clock only runs while
  // something is actually on screen — no timer waking a phone up all day when
  // the signal is fine.
  return (
    <AnimatePresence>
      {stale && <OfflineBanner cachedAt={cachedAt} lastSync={lastSync} />}
    </AnimatePresence>
  );
}

function OfflineBanner({
  cachedAt,
  lastSync,
}: {
  cachedAt: string | null;
  lastSync: string | null;
}) {
  const now = useSlowClock();

  // `cachedAt` is when this particular response was stored; `lastSync` is the
  // last time anything reached the network. The first is more precise, so it
  // wins when present.
  const asOf = cachedAt || lastSync;
  const age = asOf && now ? now - new Date(asOf).getTime() : null;
  const veryStale = age !== null && age > STALE_WARN_MS;
  const nothingCached = !asOf;

  // No cached copy at all, or one old enough to mislead, gets the louder red
  // treatment. A recent copy is amber: usable, just not live.
  const severe = nothingCached || veryStale;

  const message = nothingCached
    ? 'Offline — this data was never saved for offline use'
    : !now
      ? 'Offline — showing saved data' // first frame, before the clock ticks
      : veryStale
        ? `Offline — data is from ${new Date(asOf).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}. Confirm before relying on it.`
        : `Offline — showing data saved ${timeAgo(asOf, now)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 backdrop-blur-md shadow-lg ${
          severe
            ? 'bg-red-950/90 border-red-500/40 text-red-200'
            : 'bg-amber-950/90 border-amber-500/40 text-amber-100'
        }`}
      >
        {severe ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <CloudOff className="w-4 h-4 shrink-0" />
        )}
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest leading-snug">
          {message}
        </span>
      </div>
    </motion.div>
  );
}
