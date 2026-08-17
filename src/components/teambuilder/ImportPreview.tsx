/**
 * The import preview: the table a producer corrects a CSV or vCard in before
 * any of it reaches the database.
 *
 * It lives outside Rolodex, and owns the draft rows itself, because keystroke
 * latency here is a correctness problem rather than a polish one. While the
 * draft was Rolodex state, every character typed re-rendered the whole 2.2k-line
 * panel — the contact table behind the modal included — which put ~90ms between
 * a keypress and the letter appearing on a 400-row contractor list, and ~130ms
 * on a thousand. Typing that far behind your fingers reads as a field that
 * doesn't accept input. Holding the draft here keeps a keystroke's work
 * proportional to the modal, and `ImportPreviewRow` is memoised so it is
 * proportional to the one row being edited.
 *
 * The parent gets the corrected rows back on confirm; it does not observe every
 * keystroke.
 */
'use client';

import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ImportContact } from '@/lib/contact-import';

/** One row of the preview. Memoised — see the note above. */
const ImportPreviewRow = React.memo(function ImportPreviewRow({
  contact,
  idx,
  isSelected,
  onChange,
  onToggle,
}: {
  contact: ImportContact;
  idx: number;
  isSelected: boolean;
  onChange: (idx: number, patch: Partial<ImportContact>) => void;
  onToggle: (idx: number) => void;
}) {
  const isPlaceholderEmail = contact.email.includes('@temporary.com');
  const field =
    'w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-accent outline-none p-2 rounded-lg font-bold text-white';

  return (
    <tr className={`hover:bg-white/[0.01] transition-colors ${isSelected ? 'text-white' : 'text-white/40'}`}>
      <td className="p-4 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(idx)}
          className="rounded border-white/10 text-accent focus:ring-accent bg-black"
        />
      </td>
      <td className="p-3">
        <input
          type="text"
          value={contact.name}
          onChange={(e) => onChange(idx, { name: e.target.value })}
          className={`${field} text-xs uppercase tracking-wide`}
        />
      </td>
      <td className="p-3">
        <input
          type="email"
          value={contact.email}
          onChange={(e) => onChange(idx, { email: e.target.value })}
          className={`w-full bg-black/40 border outline-none p-2 rounded-lg text-xs font-bold text-white ${
            isPlaceholderEmail
              ? 'border-yellow-500/30 focus:border-yellow-500'
              : 'border-white/5 hover:border-white/10 focus:border-accent'
          }`}
          title={isPlaceholderEmail ? 'Temporary email generated' : ''}
        />
      </td>
      <td className="p-3">
        <input
          type="text"
          value={contact.phone}
          placeholder="—"
          onChange={(e) => onChange(idx, { phone: e.target.value })}
          className={`${field} text-xs`}
        />
      </td>
      <td className="p-3">
        {/* A text field, not a fixed list: the file's own role ("Rental House /
            Vendor") has to survive the preview, and a dropdown silently blanked
            anything that wasn't one of the standard ones. */}
        <input
          type="text"
          list="standard-roles"
          placeholder="— none —"
          value={contact.primary_role}
          onChange={(e) => onChange(idx, { primary_role: e.target.value })}
          className={`${field} text-[10px] uppercase`}
        />
      </td>
      <td className="p-3">
        <input
          type="text"
          list="standard-roles"
          placeholder="Editor, Producer"
          title="Other hats this person wears, comma-separated"
          value={contact.secondary_roles}
          onChange={(e) => onChange(idx, { secondary_roles: e.target.value })}
          className={`${field} text-[10px] uppercase`}
        />
      </td>
      <td className="p-3">
        <input
          type="text"
          value={contact.tags}
          onChange={(e) => onChange(idx, { tags: e.target.value })}
          className={`${field} text-xs uppercase`}
        />
      </td>
    </tr>
  );
});

export default function ImportPreview({
  initialContacts,
  isSaving,
  onCancel,
  onConfirm,
}: {
  /** Rows as parsed. Corrections are made against a copy held here. */
  initialContacts: ImportContact[];
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (contacts: ImportContact[]) => void;
}) {
  const [contacts, setContacts] = useState<ImportContact[]>(initialContacts);
  /** A Set, not an array: `includes` per row made selecting O(rows²). */
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialContacts.map((_, i) => i)));

  /**
   * Replaces the row rather than mutating it. The old code assigned through a
   * shallow array copy, so the "previous" state object was edited in place —
   * which works only for as long as nothing downstream compares references.
   */
  const updateContact = useCallback((idx: number, patch: Partial<ImportContact>) => {
    setContacts(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }, []);

  const toggleRow = useCallback((idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (!next.delete(idx)) next.add(idx);
      return next;
    });
  }, []);

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-neutral-950 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] text-white cursor-default"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Import Preview</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
              Edit any field, then tick the crew to import
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto border border-white/5 rounded-xl mb-6 max-h-[45vh] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 uppercase tracking-wider text-[11px] md:text-[9px] font-black opacity-60">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(contacts.map((_, i) => i)) : new Set())
                    }
                    className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                  />
                </th>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4 w-44">Primary Role</th>
                <th className="p-4 w-48">Other Roles</th>
                <th className="p-4">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contacts.map((contact, idx) => (
                <ImportPreviewRow
                  key={idx}
                  contact={contact}
                  idx={idx}
                  isSelected={selected.has(idx)}
                  onChange={updateContact}
                  onToggle={toggleRow}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center bg-black/40 border border-white/5 p-4 rounded-2xl mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Total Contacts Found: <span className="text-white font-black">{contacts.length}</span> | Selected:{' '}
            <span className="text-accent font-black">{selected.size}</span>
          </span>
          <span className="text-[11px] md:text-[9px] font-bold text-yellow-500 uppercase tracking-widest animate-pulse">
            ⚠️ Verify highlighted fields before importing
          </span>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all cursor-pointer font-bold"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(contacts.filter((_, idx) => selected.has(idx)))}
            disabled={isSaving || selected.size === 0}
            className="flex-grow py-4 bg-accent hover:bg-white hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent/25 font-bold"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              `Confirm Import (${selected.size})`
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
