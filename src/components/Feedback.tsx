'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, AlertTriangle } from 'lucide-react';

// Layering: these sit above everything, including the portalled modals in
// components/workspace/Overlay.tsx (z-9000). Feedback is almost always a
// response to an action taken *inside* something else — saving in a modal,
// confirming a delete from a dropdown — so anything it can't cover, it can't
// be seen through. At z-400 the "New project" prompt opened underneath the
// production modal and only appeared once that modal closed, which read as the
// button doing nothing; every toast raised from inside a modal was invisible
// for the same reason. Keep this above the Overlay tier.
//
// App-wide replacement for window.alert / window.confirm. Browser dialogs
// block the page and look broken on phones; these render as toasts and a
// styled confirm modal instead. Imperative API so deep components can call
// `toast('Saved')` / `await confirmAction({...})` without prop-drilling —
// a single <FeedbackHost /> in the root layout renders everything.

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red for destructive actions. */
  danger?: boolean;
}

interface PromptOptions {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };
type PromptRequest = PromptOptions & { resolve: (value: string | null) => void };

let pushToast: ((t: Omit<ToastItem, 'id'>) => void) | null = null;
let pushConfirm: ((r: ConfirmRequest) => void) | null = null;
let pushPrompt: ((r: PromptRequest) => void) | null = null;

/** Show a transient toast. Type defaults to error when the message reads like a failure. */
export function toast(message: string, type?: ToastType) {
  const resolved: ToastType =
    type ?? (/fail|error|could not|couldn't|unable|denied|invalid|missing/i.test(message) ? 'error' : 'success');
  if (pushToast) pushToast({ message, type: resolved });
  else if (typeof window !== 'undefined') window.alert(message); // host not mounted — never swallow feedback
}

/** Styled, promise-based confirm. Drop-in for `if (!confirm(...)) return`. */
export function confirmAction(opts: ConfirmOptions | string): Promise<boolean> {
  const options: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
  if (!pushConfirm) {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(options.message) : false);
  }
  return new Promise(resolve => pushConfirm!({ ...options, resolve }));
}

/** Styled, promise-based text prompt. Drop-in for `window.prompt`. Resolves
 *  null when cancelled, and never resolves an empty string. */
export function promptAction(opts: PromptOptions | string): Promise<string | null> {
  const options: PromptOptions = typeof opts === 'string' ? { message: opts } : opts;
  if (!pushPrompt) {
    const fallback = typeof window !== 'undefined'
      ? window.prompt(options.message || options.title || '', options.defaultValue || '')
      : null;
    return Promise.resolve(fallback?.trim() || null);
  }
  return new Promise(resolve => pushPrompt!({ ...options, resolve }));
}

const TOAST_MS = 3500;

export default function FeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const idRef = useRef(0);

  useEffect(() => {
    pushToast = (t) => {
      const id = ++idRef.current;
      setToasts(prev => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), TOAST_MS);
    };
    pushConfirm = (r) => setConfirmReq(prev => {
      // A second confirm while one is open auto-cancels the newcomer rather
      // than silently replacing the visible question.
      if (prev) { r.resolve(false); return prev; }
      return r;
    });
    pushPrompt = (r) => setPromptReq(prev => {
      if (prev) { r.resolve(null); return prev; }
      setPromptValue(r.defaultValue || '');
      return r;
    });
    return () => { pushToast = null; pushConfirm = null; pushPrompt = null; };
  }, []);

  const settlePrompt = useCallback((value: string | null) => {
    setPromptReq(prev => {
      prev?.resolve(value && value.trim() ? value.trim() : null);
      return null;
    });
    setPromptValue('');
  }, []);

  const settle = useCallback((ok: boolean) => {
    setConfirmReq(prev => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  // Escape cancels the confirm.
  useEffect(() => {
    if (!confirmReq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmReq, settle]);

  const toastStyle: Record<ToastType, { icon: React.ReactNode; classes: string }> = {
    success: { icon: <Check className="w-4 h-4 shrink-0" />, classes: 'bg-emerald-600/90 border-emerald-400/30' },
    error: { icon: <AlertCircle className="w-4 h-4 shrink-0" />, classes: 'bg-red-600/90 border-red-400/30' },
    info: { icon: <AlertCircle className="w-4 h-4 shrink-0" />, classes: 'bg-zinc-800/95 border-white/15' },
  };

  return (
    <>
      {/* Toast stack */}
      <div className="fixed bottom-6 inset-x-0 z-[9500] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className={`pointer-events-auto max-w-md w-fit flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur text-white text-xs font-semibold tracking-wide ${toastStyle[t.type].classes}`}
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            >
              {toastStyle[t.type].icon}
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Prompt modal */}
      <AnimatePresence>
        {promptReq && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => settlePrompt(null)}
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              onClick={e => e.stopPropagation()}
              onSubmit={(e) => { e.preventDefault(); settlePrompt(promptValue); }}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">{promptReq.title || 'Enter a value'}</h3>
                {promptReq.message && (
                  <p className="text-xs text-white/50 leading-relaxed">{promptReq.message}</p>
                )}
                <div className="space-y-1.5">
                  {promptReq.label && (
                    <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">{promptReq.label}</label>
                  )}
                  <input
                    autoFocus
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') settlePrompt(null); }}
                    placeholder={promptReq.placeholder}
                    className="w-full bg-black/50 border border-white/10 px-3 py-2.5 rounded-xl outline-none focus:border-accent text-sm font-semibold text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={() => settlePrompt(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/70 hover:text-white transition-all"
                >
                  {promptReq.cancelLabel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!promptValue.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-accent hover:opacity-90 transition-all disabled:opacity-30"
                >
                  {promptReq.confirmLabel || 'Create'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmReq && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => settle(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${confirmReq.danger ? 'bg-red-500/15 text-red-400' : 'bg-accent/15 text-accent'}`}>
                    <AlertTriangle className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-white">
                      {confirmReq.title || 'Are you sure?'}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed mt-1.5">{confirmReq.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => settle(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/70 hover:text-white transition-all"
                >
                  {confirmReq.cancelLabel || 'Cancel'}
                </button>
                <button
                  autoFocus
                  onClick={() => settle(true)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all ${confirmReq.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-accent hover:opacity-90'}`}
                >
                  {confirmReq.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
