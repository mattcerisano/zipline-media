'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Edit-in-place controls for the production cards on the Slate.
 *
 * Shoot details change late — a call moved by text, a venue swapped by email,
 * two more cutdowns — and each of those used to mean the full production
 * form: open it, find the field, change it, save. These put the editor where
 * the value is already shown, and they all keep the same contract so it only
 * has to be learned once:
 *
 *   - the first tap lands on the real input, so a phone opens its keyboard or
 *     picker straight away instead of after a second tap;
 *   - blur or Enter saves; Escape puts the saved value back;
 *   - each keeps its own draft while focused, so a teammate's save echoing
 *     back over realtime can't overwrite what's being typed;
 *   - nothing waits on hover, which touch screens never see.
 */

/** Resting look of an editable value: text in a faint well, so it reads as a field without the card turning into a form. */
const WELL = 'bg-white/[0.035] hover:bg-white/[0.07] transition-colors';
const WELL_FOCUS = 'bg-black/40 ring-1 ring-accent/60';
/** 32px with a mouse; 44px — Apple's tap-target floor — on a touch screen. */
const WELL_H = 'min-h-8 pointer-coarse:min-h-11';
/** Matches the 16px a touch screen forces on inputs (globals.css), so a value doesn't change size the moment it's tapped. */
const WELL_TEXT = 'text-[13px] pointer-coarse:text-base';

/** Escape belongs to the field being edited, not to the sheet or menu underneath it. */
function keepEscape(e: React.KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * A draft that logic can read synchronously. Blur, Enter, Escape and unmount
 * can arrive in one tick; reading state there sees the last render, and a
 * draft already saved would be saved twice.
 */
function useDraft<T>() {
  const [draft, setState] = useState<T | null>(null);
  const ref = useRef<T | null>(null);
  const setDraft = useCallback((next: T | null) => {
    ref.current = next;
    setState(next);
  }, []);
  return [draft, setDraft, ref] as const;
}

/**
 * Saves a draft that's still open when the field goes away — the tab switched
 * mid-edit, or the card moved to another section. Blur doesn't reliably fire
 * for an element that's removed while focused.
 */
function useCommitOnUnmount(commit: () => void) {
  const latest = useRef(commit);
  useEffect(() => { latest.current = commit; });
  useEffect(() => () => latest.current(), []);
}

const FADE = 'linear-gradient(to bottom, black 55%, transparent)';

/**
 * Grow a textarea with its text, so a long address wraps like the line of
 * text it replaced rather than scrolling inside a one-line box. With `fade`,
 * text cut off by a max-height fades out, which says there's more.
 */
function useAutoHeight(ref: React.RefObject<HTMLTextAreaElement | null>, text: string, fade: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
      const mask = fade && el.scrollHeight > el.clientHeight + 1 ? FADE : '';
      el.style.maskImage = mask;
      el.style.webkitMaskImage = mask;
    };
    fit();
    // A narrower card rewraps the text: the grid reflowing, a phone rotating.
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, text, fade]);
}

export function InlineText({
  value,
  onSave,
  placeholder,
  ariaLabel,
  multiline = false,
  restLines,
  autoFocus = false,
  onDone,
  className = '',
}: {
  value: string | null | undefined;
  onSave: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Notes: Enter starts a new line, and ⌘/Ctrl+Enter or Save finishes. */
  multiline?: boolean;
  /** Lines shown while not editing, the rest faded out; unset shows it all. */
  restLines?: number;
  autoFocus?: boolean;
  /** Editing ended, saved or not — e.g. to fold an empty section away again. */
  onDone?: () => void;
  className?: string;
}) {
  const saved = value ?? '';
  // Null while not editing: the field shows the saved value and follows it
  // when a teammate changes it.
  const [draft, setDraft, draftRef] = useDraft<string>();
  const ref = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;
  const shown = draft ?? saved;

  // At rest a long note is cut to a few lines, faded at the cut.
  useAutoHeight(ref, shown, !!restLines && !editing);

  const tidy = (text: string) => (multiline ? text.trimEnd() : text.replace(/\s*\n\s*/g, ' ').trim());

  const commit = () => {
    const current = draftRef.current;
    if (current === null) return;
    setDraft(null);
    if (tidy(current) !== saved) onSave(tidy(current));
  };
  useCommitOnUnmount(commit);

  // Dropping the draft first leaves the blur that follows nothing to save.
  const cancel = () => {
    setDraft(null);
    ref.current?.blur();
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <textarea
        ref={ref}
        rows={1}
        value={shown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        enterKeyHint={multiline ? undefined : 'done'}
        onFocus={() => setDraft(saved)}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { commit(); onDone?.(); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { keepEscape(e); cancel(); return; }
          if (e.key === 'Enter' && !e.shiftKey && (!multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        style={!editing && restLines ? { maxHeight: `calc(${restLines}lh + 0.75rem)` } : undefined}
        className={`block w-full resize-none rounded-lg px-2 py-1.5 pointer-coarse:py-2.5 ${WELL_H} ${WELL_TEXT} leading-snug text-inherit placeholder:text-white/35 outline-none ${
          editing ? WELL_FOCUS : WELL
        } ${editing && multiline ? 'max-h-[50vh] overflow-y-auto' : 'overflow-hidden'}`}
      />
      {/* Notes have no single-key finish, and a phone has no Escape: say
          how to finish, and give both outcomes a button. Mouse-down is
          swallowed so pressing either doesn't blur — and so save — first. */}
      {multiline && editing && (
        <div className="flex items-center justify-end gap-1.5 mt-1.5">
          <span className="hidden pointer-fine:inline mr-auto text-[10px] text-white/30">⌘↩ to save · Esc to cancel</span>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={cancel}
            className="px-3 h-8 pointer-coarse:h-10 rounded-lg text-[12px] font-medium text-white/60 hover:text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => ref.current?.blur()}
            className="px-3 h-8 pointer-coarse:h-10 rounded-lg text-[12px] font-semibold bg-accent text-white hover:opacity-90"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A date or time shown the way people read it ("Tue, Oct 21", "7:30 AM")
 * with the native input laid invisibly over it. The tap lands on the input
 * itself, so a phone opens its picker on the first tap; while focused the
 * input shows through so typing into it is visible.
 */
export function InlinePicker({
  type,
  value,
  onSave,
  format,
  placeholder,
  ariaLabel,
  min,
  placeholderClassName = 'text-white/35',
  className = '',
}: {
  type: 'date' | 'time';
  /** In the input's own format — "2026-10-21", "07:30" — or empty when unset. */
  value: string;
  onSave: (next: string) => void;
  format: (value: string) => React.ReactNode;
  placeholder: string;
  ariaLabel: string;
  min?: string;
  placeholderClassName?: string;
  className?: string;
}) {
  const [draft, setDraft, draftRef] = useDraft<string>();
  const editing = draft !== null;
  const shown = draft ?? value;

  const commit = () => {
    const current = draftRef.current;
    if (current === null) return;
    setDraft(null);
    if (current !== value) onSave(current);
  };
  useCommitOnUnmount(commit);

  // A mouse click on a date input only selects a segment; the calendar opens
  // from the icon. Open it on any click. Touch screens open their own picker.
  const openPicker = (input: HTMLInputElement) => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    try { input.showPicker(); } catch { /* unsupported, or already open */ }
  };

  return (
    <span className={`relative flex items-center min-w-0 rounded-lg px-2 ${WELL_H} ${WELL_TEXT} ${editing ? WELL_FOCUS : WELL} ${className}`}>
      <span aria-hidden className={`truncate ${editing ? 'invisible' : ''} ${shown ? '' : placeholderClassName}`}>
        {shown ? format(shown) : placeholder}
      </span>
      <input
        type={type}
        value={shown}
        min={min}
        aria-label={ariaLabel}
        onFocus={() => setDraft(value)}
        onClick={e => openPicker(e.currentTarget)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            keepEscape(e);
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        // The picker icon goes: a click anywhere opens the picker already,
        // and on a narrow card the icon pushed "AM" out of a time field.
        className="absolute inset-0 w-full h-full px-1.5 bg-transparent text-inherit outline-none cursor-pointer opacity-0 focus:opacity-100 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
      />
    </span>
  );
}

/**
 * A chip that is a dropdown: the native select is stretched invisibly over
 * it, so the system picker opens on a phone and the chip stays a chip.
 */
export function ChipSelect<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  children,
}: {
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (next: V) => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`relative inline-flex items-center gap-1.5 shrink-0 h-7 pointer-coarse:h-10 px-2.5 rounded-full border text-[11px] font-semibold tracking-wide focus-within:ring-1 focus-within:ring-accent/60 ${className}`}>
      {children}
      <ChevronDown className="w-3 h-3 opacity-50 -ml-0.5" />
      <select
        value={value}
        onChange={e => onChange(e.target.value as V)}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-zinc-900 text-white">{o.label}</option>
        ))}
      </select>
    </span>
  );
}

/**
 * The one-line input for adding to a list — a deliverable, say. Enter adds
 * and stays open for the next one, so three cutdowns are three lines typed;
 * leaving the field adds what's there and closes; Escape drops it.
 */
export function AddLine({
  placeholder,
  ariaLabel,
  onAdd,
  onClose,
}: {
  placeholder: string;
  ariaLabel: string;
  onAdd: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const textRef = useRef('');
  const update = (next: string) => { textRef.current = next; setText(next); };
  const take = () => {
    const value = textRef.current.trim();
    update('');
    return value;
  };
  return (
    <input
      autoFocus
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      enterKeyHint="next"
      onChange={e => update(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Escape') { keepEscape(e); update(''); onClose(); }
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = take();
          if (value) onAdd(value);
          else onClose();
        }
      }}
      onBlur={() => {
        const value = take();
        if (value) onAdd(value);
        onClose();
      }}
      className={`block w-full rounded-lg px-2 ${WELL_H} ${WELL_TEXT} ${WELL_FOCUS} text-inherit placeholder:text-white/35 outline-none`}
    />
  );
}

/**
 * A link pasted onto the card, with an optional name. Enter, or leaving
 * both fields, adds it; Escape drops it. Stays open when the link is refused
 * so a mistyped address can be fixed rather than retyped.
 */
export function AddLinkForm({
  onAdd,
  onClose,
}: {
  onAdd: (url: string, label: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const fields = useRef({ url: '', label: '' });
  const finished = useRef(false);

  const submit = async () => {
    if (finished.current) return;
    if (!fields.current.url.trim()) { finished.current = true; onClose(); return; }
    finished.current = true;
    const added = await onAdd(fields.current.url, fields.current.label);
    if (added) onClose();
    else finished.current = false;
  };

  const field = `block w-full rounded-lg px-2 ${WELL_H} ${WELL_TEXT} ${WELL} focus:bg-black/40 focus:ring-1 focus:ring-accent/60 text-inherit placeholder:text-white/35 outline-none`;

  return (
    <div
      className="space-y-1.5"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void submit(); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { keepEscape(e); finished.current = true; onClose(); }
        if (e.key === 'Enter') { e.preventDefault(); void submit(); }
      }}
    >
      <input
        autoFocus
        type="url"
        inputMode="url"
        value={url}
        onChange={e => { fields.current.url = e.target.value; setUrl(e.target.value); }}
        placeholder="Paste a link"
        aria-label="Link address"
        className={field}
      />
      <input
        value={label}
        onChange={e => { fields.current.label = e.target.value; setLabel(e.target.value); }}
        placeholder="Name it (optional), e.g. Frame.io review"
        aria-label="Link name"
        enterKeyHint="done"
        className={field}
      />
    </div>
  );
}
