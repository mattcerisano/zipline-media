'use client';

import React, { useState } from 'react';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Contact } from '@/components/gearbuilder/types';

/**
 * "Suggest role & tags" panel for the contact editor.
 *
 * Always-ask by policy: the assistant proposes, the person decides. Nothing is
 * written anywhere until Apply is clicked, and Apply only fills the form —
 * saving is still the form's own Save button. Dismissing costs nothing.
 */

export interface ContactSuggestion {
  primary_role: string;
  department: string;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const CONFIDENCE_TONE: Record<ContactSuggestion['confidence'], string> = {
  high: 'bg-green-500/10 border-green-500/20 text-green-300',
  medium: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  low: 'bg-white/5 border-white/10 text-white/50',
};

export default function ContactSuggest({ contact, onApply }: {
  contact: Partial<Contact>;
  /** Called with the accepted fields when the user clicks Apply. */
  onApply: (fields: { primary_role: string; tags: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<ContactSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** null until the server says whether ANTHROPIC_API_KEY is configured. */
  const [unavailable, setUnavailable] = useState(false);

  const fetchSuggestion = async () => {
    setBusy(true);
    setError(null);
    setSuggestion(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sign in to use the assistant.');
        return;
      }
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'contact_tags', contact }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 501) {
        // Not configured on this deployment — hide the feature quietly rather
        // than showing a button that can never work.
        setUnavailable(true);
        return;
      }
      if (!res.ok || !data.suggestion) {
        setError(data.error || 'No suggestion available.');
        return;
      }
      setSuggestion(data.suggestion as ContactSuggestion);
    } catch {
      setError('Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) return null;

  const hasEnoughDetail = !!(contact.name || contact.notes_general || contact.company_name);

  return (
    <div className="md:col-span-2">
      {!suggestion ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSuggestion}
            disabled={busy || !hasEnoughDetail}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            title={hasEnoughDetail ? 'Ask Claude to suggest a role and tags from the details above' : 'Add a name or notes first'}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {busy ? 'Thinking…' : 'Suggest role & tags'}
          </button>
          {error && <p className="text-[10px] font-semibold text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="p-3.5 bg-accent/5 border border-accent/20 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Suggestion
            </p>
            <span className={`text-[11px] md:text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${CONFIDENCE_TONE[suggestion.confidence]}`}>
              {suggestion.confidence} confidence
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {suggestion.primary_role && (
              <span className="text-[11px] font-bold text-white px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                {suggestion.primary_role}
              </span>
            )}
            <span className="text-[10px] font-semibold text-white/50 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
              {suggestion.department}
            </span>
            {suggestion.tags.map(tag => (
              <span key={tag} className="text-[10px] font-medium text-white/70 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                #{tag}
              </span>
            ))}
          </div>

          <p className="text-[10px] text-white/40 leading-relaxed italic">{suggestion.reasoning}</p>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onApply({
                  primary_role: suggestion.primary_role || contact.primary_role || '',
                  // Contacts have no department column, so the department rides
                  // along as a tag — otherwise it's shown here and then lost.
                  // Existing tags are kept; the set dedupes the overlap.
                  tags: Array.from(new Set([
                    ...(contact.tags?.split(',').map(t => t.trim()).filter(Boolean) || []),
                    suggestion.department,
                    ...suggestion.tags,
                  ].filter(Boolean))).join(', '),
                });
                setSuggestion(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              <Check className="w-3 h-3" /> Apply
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
            <p className="text-[11px] md:text-[9px] text-white/30 ml-auto">Nothing is saved until you hit Save Contact.</p>
          </div>
        </div>
      )}
    </div>
  );
}
