'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Portal } from './Overlay';

/**
 * A walk through the real interface: the screen dims, the control being
 * explained is cut out of the dimming with a ring around it, and a small card
 * beside it points at it with an arrow and says one sentence. Steps can switch
 * tabs, open the phone drawer, or open a menu or card first, so the tour shows
 * where things are rather than describing them.
 *
 * Targets are `data-tour="…"` markers in the app. A step whose tab this
 * account can't open, or whose target never appears (an empty board, a button
 * hidden on phones), is skipped rather than shown pointing at nothing.
 */

export interface TourStep {
  id: string;
  title: string;
  /** One sentence. The card is a hint, not a manual. */
  body: string;
  /** `data-tour` marker to spotlight. Omitted: a centred card. */
  target?: string;
  /** Command Center tab to switch to first. */
  tab?: string;
  /** The target is in the sidebar, which on a phone is a drawer. */
  inSidebar?: boolean;
  /**
   * Something to open first: `click` is clicked, and `container` is the
   * marker of what it opens. Consecutive steps with the same container share
   * it; the tour closes it when it moves on.
   */
  opens?: { click: string; container: string };
}

export interface TourHost {
  /** Switch tabs. False when this account can't open that tab. */
  goToTab: (tabId: string) => boolean;
  /** Open or close the sidebar drawer (phones). */
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
  /** The tab the tour started on, restored when it ends. */
  activeTab: string;
}

const PAD = 8;           // space between the target and the spotlight edge
const GAP = 14;          // space between the spotlight and the card
const EDGE = 16;         // minimum distance from the window edge
const ARROW = 12;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The first marker with that name that's actually on screen. */
function findVisible(marker: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${marker}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

/** Fully on screen (or as much of it as can be, for something taller than the window). */
function inView(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.height >= vh - 16) return r.top <= 8 && r.top >= -r.height + vh / 2;
  return r.top >= 8 && r.bottom <= vh - 8 && r.left >= 0 && r.right <= window.innerWidth;
}

async function waitFor(marker: string, ms: number, alive: () => boolean): Promise<HTMLElement | null> {
  const until = Date.now() + ms;
  while (alive()) {
    const el = findVisible(marker);
    if (el) return el;
    if (Date.now() > until) return null;
    await sleep(100);
  }
  return null;
}

type Side = 'top' | 'bottom' | 'left' | 'right' | null;
interface Placement { top: number; left: number; side: Side; arrow: number }

/** Where the card goes: below, above, then beside the target; else pinned low. */
function place(rect: DOMRect | null, w: number, h: number, mobile: boolean): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - h - EDGE);
  if (!rect) return { top: clampY(vh / 2 - h / 2), left: clampX(vw / 2 - w / 2), side: null, arrow: 0 };

  const spot = { top: rect.top - PAD, bottom: rect.bottom + PAD, left: rect.left - PAD, right: rect.right + PAD };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (spot.bottom + GAP + h <= vh - EDGE) {
    const left = clampX(cx - w / 2);
    return { top: spot.bottom + GAP, left, side: 'top', arrow: cx - left };
  }
  if (spot.top - GAP - h >= EDGE) {
    const left = clampX(cx - w / 2);
    return { top: spot.top - GAP - h, left, side: 'bottom', arrow: cx - left };
  }
  if (!mobile && spot.right + GAP + w <= vw - EDGE) {
    const top = clampY(cy - h / 2);
    return { top, left: spot.right + GAP, side: 'left', arrow: cy - top };
  }
  if (!mobile && spot.left - GAP - w >= EDGE) {
    const top = clampY(cy - h / 2);
    return { top, left: spot.left - GAP - w, side: 'right', arrow: cy - top };
  }
  // The target fills most of the screen (a whole board column, a card
  // section on a phone): sit at the bottom, over it, without an arrow.
  return { top: vh - h - EDGE, left: clampX(vw / 2 - w / 2), side: null, arrow: 0 };
}

export default function GuidedTour({ steps, host, onClose }: {
  steps: TourStep[];
  host: TourHost;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // The step that has finished arriving. Tied to the index, not a flag: on
  // the render where the step changes, a boolean was still true from the last
  // step and flashed the new text over the old spotlight.
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const ready = readyAt === index;
  const [cardSize, setCardSize] = useState({ w: 320, h: 160 });
  const [, setViewport] = useState(0); // re-place the card on resize

  const hostRef = useRef(host);
  useEffect(() => { hostRef.current = host; });
  const startTab = useRef(host.activeTab);
  const targetEl = useRef<HTMLElement | null>(null);
  const openContainer = useRef<string | null>(null);
  const run = useRef(0);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  // True while the tour sends its own Escape to close a menu or card it
  // opened, so its Escape handler lets that one through.
  const closing = useRef(false);

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  /** Close whatever the tour opened (a menu, a card), if it's still open. */
  const closeOpened = useCallback(async () => {
    const container = openContainer.current;
    openContainer.current = null;
    if (!container) return;
    closing.current = true;
    try {
      for (let i = 0; i < 3 && findVisible(container); i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(180);
      }
    } finally {
      closing.current = false;
    }
  }, []);

  const finish = useCallback(async () => {
    run.current++;
    await closeOpened();
    const h = hostRef.current;
    if (h.isMobile) h.setSidebarOpen(false);
    if (startTab.current) h.goToTab(startTab.current);
    onClose();
  }, [closeOpened, onClose]);

  const go = useCallback((next: number) => {
    direction.current = next >= index ? 1 : -1;
    if (next >= steps.length) { void finish(); return; }
    setIndex(Math.max(0, next));
  }, [index, steps.length, finish]);

  // Arrive at a step: switch tab, open what it needs, find and frame the target.
  useEffect(() => {
    const id = ++run.current;
    const alive = () => run.current === id;
    const h = hostRef.current;
    setRect(null);
    targetEl.current = null;

    const skip = () => {
      if (!alive()) return;
      const next = index + direction.current;
      if (next < 0) setIndex(0);
      else if (next >= steps.length) void finish();
      else setIndex(next);
    };

    (async () => {
      if (openContainer.current && openContainer.current !== step.opens?.container) await closeOpened();
      if (!alive()) return;

      if (step.tab && !h.goToTab(step.tab)) return skip();
      if (h.isMobile) h.setSidebarOpen(!!step.inSidebar);

      if (step.opens && !findVisible(step.opens.container)) {
        const trigger = await waitFor(step.opens.click, 3500, alive);
        if (!alive()) return;
        if (!trigger) return skip();
        trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
        await sleep(250);
        if (!alive()) return;
        trigger.click();
        openContainer.current = step.opens.container;
        if (!(await waitFor(step.opens.container, 2500, alive))) return skip();
      }

      if (!step.target) { if (alive()) setReadyAt(index); return; }

      const el = await waitFor(step.target, step.tab || step.inSidebar ? 3500 : 1200, alive);
      if (!alive()) return;
      if (!el) return skip();
      // Scroll only when it's off screen: a menu is already in view, and
      // scrolling under it makes it chase its button while the spotlight
      // is being measured. A second, instant scroll catches a nested panel
      // (a card's sheet on a phone) that the smooth one didn't finish.
      if (!inView(el)) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        await sleep(450);
        if (!alive()) return;
        if (!inView(el)) el.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      await sleep(step.inSidebar && h.isMobile ? 450 : 200);
      if (!alive()) return;
      targetEl.current = el;
      setRect(el.getBoundingClientRect());
      setReadyAt(index);
    })();
    // `index` drives this; the step objects are static per tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Keep the spotlight on its target as things scroll, resize or animate in.
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = targetEl.current;
        if (el && el.isConnected) setRect(el.getBoundingClientRect());
        setViewport(v => v + 1);
      });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const settle = setInterval(update, 400); // catches layout shifts as data loads
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(settle);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [ready]);

  // Measure the card so it can be placed without overlapping its target; its
  // height changes with each step's text.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setCardSize(prev =>
      prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ← → move (Enter presses the focused Next button by itself). Escape ends
  // the tour outright: caught before anything else hears it, so it doesn't
  // just close the menu or card the tour opened and leave the tour standing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (closing.current) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        void finish();
      } else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (index > 0) go(index - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, index, finish]);

  const pos = place(rect, cardSize.w, cardSize.h, host.isMobile);
  const spot = rect && {
    top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9400]"
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
        data-step={step.id}
        data-ready={ready ? 'true' : 'false'}
      >
        {/* Holds the app still: the tour drives, clicks underneath wait. */}
        <div className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />

        {/* Dimming, with the target cut out of it. */}
        {spot && ready ? (
          <motion.div
            className="absolute rounded-xl pointer-events-none"
            style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)' }}
            initial={false}
            animate={spot}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            {/* The outline is a border, not a `ring`: Tailwind draws rings
                with box-shadow, which the dimming above replaces. */}
            <span className="absolute inset-0 rounded-xl border-2 border-accent" />
            <span className="absolute -inset-1 rounded-xl border-2 border-accent/50 animate-ping" />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
        )}

        {/* The hint */}
        <motion.div
          ref={cardRef}
          className="absolute w-[min(320px,calc(100vw-32px))] bg-zinc-950 border border-white/15 rounded-2xl shadow-2xl p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0, top: pos.top, left: pos.left }}
          transition={{ type: 'spring', stiffness: 300, damping: 32, opacity: { duration: 0.15 } }}
          aria-live="polite"
        >
          {pos.side && (
            <span
              aria-hidden
              className="absolute w-3 h-3 bg-zinc-950 border-white/15 rotate-45"
              style={{
                ...(pos.side === 'top' && { top: -ARROW / 2, left: Math.min(Math.max(pos.arrow - ARROW / 2, 14), cardSize.w - 26), borderLeftWidth: 1, borderTopWidth: 1 }),
                ...(pos.side === 'bottom' && { bottom: -ARROW / 2, left: Math.min(Math.max(pos.arrow - ARROW / 2, 14), cardSize.w - 26), borderRightWidth: 1, borderBottomWidth: 1 }),
                ...(pos.side === 'left' && { left: -ARROW / 2, top: Math.min(Math.max(pos.arrow - ARROW / 2, 14), cardSize.h - 26), borderLeftWidth: 1, borderBottomWidth: 1 }),
                ...(pos.side === 'right' && { right: -ARROW / 2, top: Math.min(Math.max(pos.arrow - ARROW / 2, 14), cardSize.h - 26), borderRightWidth: 1, borderTopWidth: 1 }),
              }}
            />
          )}

          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-tight text-white leading-snug">{step.title}</h3>
            <button
              onClick={() => { void finish(); }}
              aria-label="End tour"
              className="p-1 -m-1 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[13px] text-white/70 leading-relaxed mt-1">{step.body}</p>

          <div className="flex items-center justify-between gap-3 mt-4">
            <span className="text-[11px] text-white/40 tabular-nums">{index + 1} of {steps.length}</span>
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  onClick={() => go(index - 1)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <button
                onClick={() => go(index + 1)}
                autoFocus
                className="px-3.5 py-1.5 rounded-lg bg-accent hover:opacity-90 text-xs font-semibold text-white flex items-center gap-1 transition-opacity"
              >
                {isLast ? 'Done' : 'Next'} {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
