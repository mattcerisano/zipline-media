'use client';

import React, { useEffect, useState } from 'react';
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
    document.querySelector<HTMLElement>('.studio-shell') ||
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

  // Escape closes; the page behind stops scrolling while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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

  useEffect(() => {
    if (!rect) return;
    const close = () => setRect(null);
    // Any scroll or resize invalidates the anchor position — close rather
    // than let the menu drift away from its button.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [rect]);

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
