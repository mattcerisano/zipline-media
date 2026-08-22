'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Play, Square, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { authHeader } from '@/lib/api-client';
import { toast } from '@/components/Feedback';
import {
  AUTO_CLOSE_HOURS,
  entrySeconds,
  formatClock,
  formatDuration,
  parseManualMinutes,
  totalSeconds,
  type TimeEntry,
} from '@/lib/edit-time';

// ----------------------------------------------------------------------
// COMPONENT: CardTimeTracker — hours logged against one edit card.
//
// Everything here goes through /api/edits/time. The component never writes to
// the database and never sends a timestamp: it asks the server to start or stop,
// and the server records the time from the database's clock. So a stopwatch
// that kept running because a laptop slept, a browser with the wrong system
// time, and a tab left open overnight all produce the same answer as the
// server's — this is a display of the record, not the record itself.
//
// The elapsed figure on a running timer is counted locally purely so it ticks;
// nothing is saved from it. The moment it stops, the number comes back from
// the server and replaces it.
// ----------------------------------------------------------------------

interface Props {
  jobId: string;
  /** False for a read-only viewer (a client account, or an unassigned card). */
  canLog: boolean;
  /** Lets the card face show a total without fetching it a second time. */
  onTotalChange?: (seconds: number) => void;
}

export default function CardTimeTracker({ jobId, canLog, onTotalChange }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [tick, setTick] = useState(() => Date.now());

  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/edits/time?jobId=${encodeURIComponent(jobId)}`, {
        headers: await authHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled.current) return;
      if (res.ok) {
        setEntries(data.entries || []);
        setRunning(data.running || null);
      }
    } catch {
      // Offline or a blip. The log stays as it was rather than emptying.
    } finally {
      if (!cancelled.current) setLoaded(true);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // One second of state while something is running, and none at all when it
  // isn't, so an open modal on a stopped card costs nothing.
  const runningHere = running && running.job_id === jobId ? running : null;
  useEffect(() => {
    if (!runningHere) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [runningHere]);

  const total = useMemo(() => totalSeconds(entries, tick), [entries, tick]);

  // The card face is told the settled figure — what has actually been recorded
  // — rather than the live one. A running timer would otherwise re-render the
  // whole board once a second to move a badge nobody is looking at.
  const settled = useMemo(
    () => totalSeconds(entries.filter(entry => !!entry.ended_at), tick),
    [entries, tick]
  );
  useEffect(() => { onTotalChange?.(settled); }, [settled, onTotalChange]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/edits/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || 'That did not go through.');
        return false;
      }
      await load();
      return true;
    } catch {
      toast('Could not reach the server — nothing was logged.');
      return false;
    } finally {
      if (!cancelled.current) setBusy(false);
    }
  };

  const start = () => post({ action: 'start', jobId });
  const stop = () => post({ action: 'stop' });

  const logManual = async () => {
    const minutes = parseManualMinutes(manualAmount);
    if (minutes === null) {
      toast('Enter an amount like 45m, 1h 30m, or 90.');
      return;
    }
    const ok = await post({ action: 'manual', jobId, minutes, note: manualNote.trim() || undefined });
    if (ok) {
      setManualAmount('');
      setManualNote('');
      setShowManual(false);
    }
  };

  const remove = async (entry: TimeEntry) => {
    setBusy(true);
    try {
      const res = await fetch('/api/edits/time', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ entryId: entry.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || 'Could not remove that entry.');
        return;
      }
      await load();
    } catch {
      toast('Could not reach the server.');
    } finally {
      if (!cancelled.current) setBusy(false);
    }
  };

  if (!loaded) return null;

  const runningElsewhere = running && running.job_id !== jobId;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          <Clock className="w-4 h-4 text-white/40" /> Time
        </h3>
        {total > 0 && (
          <span className="text-[10px] font-bold text-white/40 tabular-nums">
            {formatDuration(total)} logged
          </span>
        )}
      </div>

      {canLog && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {runningHere ? (
            <button
              onClick={stop}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              <span className="text-xs font-bold">Stop</span>
              <span className="text-sm font-black tabular-nums">
                {formatClock(entrySeconds(runningHere, tick))}
              </span>
            </button>
          ) : (
            <button
              onClick={start}
              disabled={busy || !!runningElsewhere}
              title={runningElsewhere ? 'A timer is already running on another card' : undefined}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 border border-accent/40 text-white hover:bg-accent/25 transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span className="text-xs font-bold">Start timer</span>
            </button>
          )}

          <button
            onClick={() => setShowManual(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">Add time</span>
          </button>
        </div>
      )}

      {runningElsewhere && canLog && (
        <p className="flex items-center gap-1.5 text-[11px] text-yellow-400/80 mb-3">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          A timer is already running on another card — stop it there first. Only one runs at a time.
        </p>
      )}

      {showManual && canLog && (
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') logManual(); }}
            placeholder="45m · 1h 30m · 90"
            className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent transition-colors"
          />
          <input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') logManual(); }}
            placeholder="What was it? (optional)"
            maxLength={500}
            className="flex-1 min-w-[10rem] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={logManual}
            disabled={busy || !manualAmount.trim()}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors disabled:opacity-40"
          >
            Log
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-[11px] text-white/30">
          {canLog ? 'No time logged yet.' : 'No time logged on this card.'}
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <TimeRow key={entry.id} entry={entry} now={tick} onRemove={canLog ? remove : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimeRow({
  entry,
  now,
  onRemove,
}: {
  entry: TimeEntry;
  now: number;
  onRemove?: (entry: TimeEntry) => void;
}) {
  const seconds = entrySeconds(entry, now);
  const when = new Date(entry.started_at);
  const day = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const clock = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      <span className="w-16 text-xs font-black text-white tabular-nums">{formatDuration(seconds)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70 truncate">
          {day} · {clock}
          {entry.note ? <span className="text-white/40"> — {entry.note}</span> : null}
        </p>
        <p className="text-[10px] text-white/30 truncate">
          {entry.user_email || 'Unknown account'}
          {entry.source === 'manual' && ' · added by hand'}
          {!entry.ended_at && ' · running'}
          {entry.auto_closed && ` · auto-stopped at ${AUTO_CLOSE_HOURS}h`}
        </p>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(entry)}
          title="Remove this entry"
          className="p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
