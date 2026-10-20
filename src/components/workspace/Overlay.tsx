'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal and menu primitives that render out of the panel that opened them.
 *
 * Widgets live inside workspace panels, and a panel is its own stacking
 * context — `.panel-rise` runs a fill-mode animation on opacity, which is
 * enough to create one. Everything a widget renders therefore paints as part
 * of the panel's subtree no matter how high its own z-index goes, so a modal
 * at z-150 still ended up underneath the sticky page header. Portalling
 * sidesteps the whole class of problem: no ancestor's stacking context,
 * overflow, or transform can reach these.
 *
 * The target is the app shell rather than `document.body`, because body is
 * outside both wrappers the app's own look depends on: `.studio-os`, which
 * re-points the `--color-white` / `--color-black` variables every themed
 * utility compiles to, and `.studio-shell`, which neutralises the brand
 * site's "uppercase every heading and button" rule. Portalled to body a sheet
 * renders in LuloClean caps and keeps the dark palette whatever the theme —
 * in light mode that is a near-black card dropped into a white app. The shell
 * is already high enough to clear any panel's stacking context, and it
 * inherits both.
 */

/**
 * Where overlays mount: the app shell if we're inside it, else the themed
 * root, else body — a page that has neither still gets a working modal.
 */
function portalTarget(): HTMLElement {
  return (
    // Not the toast/confirm host, which borrows the class for its typography
    // but sits outside the themed app root.
    document.querySelector<HTMLElement>('.studio-shell:not([data-feedback-host])') ||
    document.getElementById('studio-os-root') ||
    document.body
  );
}

/** True only after hydration, so createPortal never runs during SSR. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Deferred a tick: setting state synchronously in an effect body triggers
    // a cascading render on every mount of every overlay-bearing card.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

/**
 * Renders its children into the app shell, out of the panel that owns them.
 * For a screen with its own full-page overlay that can't use <Modal> — the
 * same stacking-context problem applies to it.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, portalTarget());
}

/**
 * Escape closes the top-most overlay, and only that one.
 *
 * Most of the app's sheets are hand-built rather than <Modal>, and none of
 * those listened for Escape at all. The ones that did each added their own
 * window listener, so with a menu open inside a sheet one keypress closed
 * both. Overlays register here as they open; the last one registered is the
 * one on top, and it alone answers. An input that wants Escape for itself
 * (cancelling an inline edit) stops propagation and keeps it.
 */
const escapeStack: { current: () => void }[] = [];

function onEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.current();
}

/** Register a close handler while `active`. Returns nothing; unregisters on cleanup. */
export function useEscapeToClose(active: boolean, onClose: () => void) {
  const handler = useRef(onClose);
  useEffect(() => { handler.current = onClose; });
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => handler.current() };
    if (escapeStack.length === 0) window.addEventListener('keydown', onEscapeKey);
    escapeStack.push(entry);
    return () => {
      const i = escapeStack.lastIndexOf(entry);
      if (i !== -1) escapeStack.splice(i, 1);
      if (escapeStack.length === 0) window.removeEventListener('keydown', onEscapeKey);
    };
  }, [active]);
}

/**
 * The same, as an element, for overlays that are conditionally rendered deep
 * in JSX where a hook can't go: drop it inside the overlay's markup and it is
 * registered exactly as long as the overlay is on screen.
 */
export function EscapeToClose({ onClose }: { onClose: () => void }) {
  useEscapeToClose(true, onClose);
  return null;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered pinned to the bottom of the sheet, outside the scroll area. */
  footer?: React.ReactNode;
  /** Tailwind max-width class for the sheet. */
  maxWidth?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, subtitle, footer, maxWidth = 'max-w-2xl', children }: ModalProps) {
  const mounted = useMounted();

  // Escape closes (when this is the top-most overlay); the page behind stops
  // scrolling while the sheet is open.
  useEscapeToClose(open, onClose);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        onMouseDown={(e) => e.stopPropagation()}
        // The sheet is capped to the viewport and scrolls internally, so the
        // top of a tall form can never end up above the top of the screen.
        className={`w-full ${maxWidth} bg-neutral-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden`}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>}
              {subtitle && <p className="text-[11px] font-medium text-white/40 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 -mr-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>

        {footer && (
          <div className="shrink-0 px-5 py-3.5 border-t border-white/10 bg-neutral-900">{footer}</div>
        )}
      </motion.div>
    </div>,
    portalTarget(),
  );
}

export interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** Renders the row in red and separates it from the rest. */
  danger?: boolean;
  hint?: string;
}

/**
 * Labelled overflow menu anchored to its trigger. Portalled for the same
 * reason as Modal, and because the job card clips its own overflow.
 */
export function DropdownMenu({ trigger, items, align = 'right' }: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; ref: React.Ref<HTMLButtonElement>; 'aria-expanded': boolean }) => React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}) {
  const mounted = useMounted();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const isOpen = !!rect;
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setRect(null);
    // A scroll moves the anchor, so the menu follows its button — and closes
    // only once the button has scrolled out of sight. Closing on any scroll
    // broke menus near the bottom of a scrolling panel: the click itself
    // focused the button, the panel scrolled it into view, and the menu shut
    // the moment it opened.
    const follow = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setRect(null);
      else setRect(r);
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);
  // Escape closes the menu alone, not the sheet the menu was opened from.
  useEscapeToClose(!!rect, () => setRect(null));

  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRect(prev => (prev ? null : btnRef.current?.getBoundingClientRect() ?? null));
  };

  const MENU_W = 232;
  let top = 0;
  let left = 0;
  if (rect) {
    top = rect.bottom + 6;
    left = align === 'right' ? rect.right - MENU_W : rect.left;
    // Keep the panel on screen near the window edges.
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8));
    const estHeight = items.length * 38 + 16;
    if (top + estHeight > window.innerHeight - 8) top = Math.max(8, rect.top - estHeight - 6);
  }

  return (
    <>
      {trigger({ onClick: open, ref: btnRef, 'aria-expanded': !!rect })}
      {mounted && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[8990]" onMouseDown={() => setRect(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            style={{ top, left, width: MENU_W }}
            data-tour="dropdown-menu"
            className="fixed z-[9000] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-1.5"
          >
            {items.map((item, i) => (
              <React.Fragment key={item.label}>
                {item.danger && i > 0 && <div className="h-px bg-white/10 my-1.5" />}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setRect(null); item.onSelect(); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="shrink-0 opacity-80">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold leading-tight truncate">{item.label}</span>
                    {item.hint && <span className="block text-[10px] text-white/35 leading-tight mt-0.5 truncate">{item.hint}</span>}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </motion.div>
        </>,
        portalTarget(),
      )}
    </>
  );
}
