'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

/**
 * Filters: inline on desktop, collapsed behind a chip on a phone.
 *
 * Stacking four full-width selects vertically pushed the first row of content
 * roughly two-thirds of the way down a 390px screen — on the Rolodex you
 * scrolled past five controls before reaching a contact. Desktop has the
 * horizontal room and keeps them in the toolbar; phones get one chip that
 * expands the same controls.
 *
 * A collapsing panel rather than a portalled sheet, deliberately. A sheet would
 * mean rendering the children in two places — hidden inline and again in the
 * portal — leaving two live inputs bound to the same state. Here they exist
 * exactly once and CSS decides whether they're visible.
 */
export function FilterSheet({
  activeCount,
  title = 'Filters',
  children,
}: {
  /** How many filters are set. Shown on the chip, because a hidden filter with
   *  no indicator reads as missing data rather than as a filter. */
  activeCount: number;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`md:hidden flex items-center gap-2 px-3 py-3 rounded-xl border text-[13px] font-medium tracking-tight transition-colors shrink-0 ${
          activeCount > 0 || open
            ? 'bg-accent/15 border-accent/40 text-accent'
            : 'bg-black/50 border-white/10 text-white/60'
        }`}
      >
        {open ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
        {title}
        {activeCount > 0 && (
          <span className="bg-accent text-white rounded-full text-[10px] font-black px-1.5 min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* One instance of the controls. `hidden` below md unless expanded;
          always a flex row from md up. */}
      <div
        className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-3 md:flex md:w-auto md:flex-row md:flex-wrap md:items-center`}
      >
        {children}
      </div>
    </>
  );
}
