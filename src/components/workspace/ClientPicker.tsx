'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Feedback';
import { Client } from '@/components/gearbuilder/types';

/**
 * Picks the client a production or a gear list belongs to.
 *
 * Only the clients table is ever offered. Crew, rental houses and everyone else
 * in the Rolodex are contacts, not clients, and a field that blurred the two
 * put the whole address book in front of someone choosing who to bill — a
 * plain text input with an empty datalist behind it let the browser's own
 * autofill answer, which on a phone is the device address book.
 *
 * A name matching no client becomes one only when someone clicks the add row.
 * Both callers used to insert whatever was typed here as a client on save,
 * which is how one-off names became permanent client records.
 */
export default function ClientPicker({
  clients,
  value,
  clientId = null,
  onChange,
  onClientCreated,
  placeholder = 'Client name',
  inputClassName,
  disabled = false,
}: {
  /** Every client on the books. The picker shows these and nothing else. */
  clients: Client[];
  /** Current text in the field — the client name, chosen or half-typed. */
  value: string;
  /** Set when the text belongs to a real client row; null while typing. */
  clientId?: string | null;
  onChange: (next: { name: string; clientId: string | null }) => void;
  /** Fires when the add row creates a client, so the caller's list keeps up. */
  onClientCreated?: (client: Client) => void;
  placeholder?: string;
  /** Overrides the input's styling — the two callers size their forms differently. */
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Two pickers can share a screen (a production form over the gear builder),
  // so the listbox id has to be unique per instance for aria-controls to mean
  // anything.
  const listId = `client-picker-${useId()}`;

  // Close when the click lands anywhere else on the page.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  const query = value.trim().toLowerCase();

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  // Typing narrows the list; an empty box shows every client, so the field
  // works as a browse-and-pick as well as a search.
  const matches = useMemo(() => {
    if (!query) return sorted;
    return sorted.filter(
      c => c.name.toLowerCase().includes(query) || (c.email || '').toLowerCase().includes(query),
    );
  }, [sorted, query]);

  const exact = useMemo(
    () => clients.find(c => c.name.trim().toLowerCase() === query) || null,
    [clients, query],
  );

  const select = (client: Client) => {
    onChange({ name: client.name, clientId: client.id });
    setIsOpen(false);
  };

  const createFromInput = async () => {
    const name = value.trim();
    if (!name || creating) return;
    if (exact) {
      select(exact);
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.from('clients').insert({ name }).select().single();
      if (error) throw error;
      const created = data as Client;
      onClientCreated?.(created);
      select(created);
      toast(`Added "${created.name}" to Clients.`);
    } catch (err: any) {
      console.error('Error creating client:', err);
      toast('Failed to add that client: ' + (err.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={e => {
            // Typing past a chosen client breaks the link until one is picked again.
            onChange({ name: e.target.value, clientId: null });
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setIsOpen(false);
            // Enter takes the top match rather than leaving a half-typed name
            // that looks chosen but carries no client link.
            if (e.key === 'Enter' && isOpen && matches.length > 0) {
              e.preventDefault();
              select(matches[0]);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          autoComplete="off"
          className={
            inputClassName ||
            'w-full bg-black/50 border border-white/10 py-2.5 pl-4 pr-10 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg'
          }
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen(o => !o)}
          aria-label={isOpen ? 'Hide client list' : 'Show client list'}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-lg shadow-2xl"
        >
          <p className="px-3 pt-2.5 pb-1.5 text-[11px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
            Clients
          </p>
          {matches.length > 0 ? (
            matches.map(client => (
              <button
                key={client.id}
                type="button"
                role="option"
                aria-selected={clientId === client.id}
                onClick={() => select(client)}
                title={client.name}
                className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors ${
                  clientId === client.id ? 'bg-accent/10 text-accent' : 'text-white'
                }`}
              >
                {/* Stacked, not side by side: client names are long enough that
                    a contact column beside them left both unreadable. */}
                <span className="block text-xs font-semibold truncate">{client.name}</span>
                {(client.email || client.phone) && (
                  <span className="block text-[11px] md:text-[10px] font-medium text-white/30 truncate">
                    {client.email || client.phone}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs font-semibold text-white/40">
              {clients.length === 0
                ? 'No clients yet — add one here or in the Rolodex.'
                : 'No client by that name.'}
            </p>
          )}
          {query && !exact && (
            <button
              type="button"
              onClick={createFromInput}
              disabled={creating}
              className="w-full text-left px-3 py-2.5 border-t border-white/10 text-accent hover:bg-accent/10 disabled:opacity-40 transition-colors flex items-center gap-2 text-xs font-semibold"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add &ldquo;{value.trim()}&rdquo; as a new client
            </button>
          )}
        </div>
      )}
    </div>
  );
}
