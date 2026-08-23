'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Star, AlertTriangle, Check, Merge, Mail, Phone, Building, MapPin, Tag, Briefcase } from 'lucide-react';
import type { DuplicateGroup, MatchStrength } from '@/lib/duplicate-contacts';
import { planMerge, type DuplicateCandidate } from '@/lib/duplicate-contacts';
import { formatRoleList } from '@/lib/crew-roles';

/**
 * The review sheet for possible duplicates.
 *
 * The whole point is that the user can tell at a glance which record to keep,
 * so the group is laid out as records side by side with the fields that
 * *disagree* marked. Every action is explicit: keep this one (and fold the
 * others into it), or say they aren't the same person.
 */

const STRENGTH_COPY: Record<MatchStrength, { label: string; className: string }> = {
  high: { label: 'Almost certainly the same', className: 'bg-red-500/15 text-red-400 border-red-500/25' },
  medium: { label: 'Likely the same', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  low: { label: 'Worth a look', className: 'bg-white/10 text-white/50 border-white/10' },
};

const FIELDS: Array<{
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  read: (c: DuplicateCandidate) => string;
}> = [
  { key: 'primary_role', label: 'Role', icon: Briefcase, read: c => c.primary_role || '' },
  { key: 'secondary_roles', label: 'Other roles', icon: Briefcase, read: c => formatRoleList(c.secondary_roles || []) },
  { key: 'email', label: 'Email', icon: Mail, read: c => c.email || '' },
  { key: 'phone', label: 'Phone', icon: Phone, read: c => c.phone || '' },
  { key: 'company_name', label: 'Company', icon: Building, read: c => c.company_name || '' },
  {
    key: 'location', label: 'Location', icon: MapPin,
    read: c => [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', '),
  },
  { key: 'tags', label: 'Tags', icon: Tag, read: c => c.tags || '' },
];

function GroupCard({
  group,
  busy,
  onMerge,
  onDismiss,
}: {
  group: DuplicateGroup;
  busy: boolean;
  onMerge: (keepId: string) => void;
  onDismiss: () => void;
}) {
  // Default to the record with the most filled in — usually the one someone
  // has actually been maintaining.
  const richest = useMemo(() => {
    return [...group.contacts].sort((a, b) => {
      const filled = (c: DuplicateCandidate) =>
        FIELDS.reduce((n, f) => n + (f.read(c) ? 1 : 0), 0) + (c.is_favorite ? 1 : 0);
      return filled(b) - filled(a);
    })[0].id;
  }, [group]);

  const [keepId, setKeepId] = useState(richest);
  const strength = STRENGTH_COPY[group.strength];
  const plan = useMemo(() => {
    try {
      return planMerge(group.contacts, keepId);
    } catch {
      return null;
    }
  }, [group, keepId]);

  // A field only earns a highlight when the records actually disagree about
  // it — two blanks and two identical values are not a decision to make.
  const conflicting = useMemo(() => {
    const out = new Set<string>();
    for (const field of FIELDS) {
      const values = new Set(group.contacts.map(c => field.read(c).trim().toLowerCase()).filter(Boolean));
      if (values.size > 1) out.add(field.key);
    }
    return out;
  }, [group]);

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/5 bg-black/20">
        <span className={`px-2 py-1 rounded-lg border text-[10px] font-semibold tracking-tight ${strength.className}`}>
          {strength.label}
        </span>
        {group.reasons.map(reason => (
          <span key={reason} className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-medium text-white/50">
            {reason}
          </span>
        ))}
        <span className="ml-auto text-[10px] font-semibold text-white/30">
          {group.contacts.length} records
        </span>
      </div>

      <div className="grid gap-3 p-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
        {group.contacts.map(contact => {
          const selected = contact.id === keepId;
          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => setKeepId(contact.id)}
              disabled={busy}
              className={`text-left rounded-2xl border p-4 transition-all ${
                selected
                  ? 'bg-accent/10 border-accent/50 shadow-lg shadow-accent/10'
                  : 'bg-black/30 border-white/5 hover:border-white/20'
              } ${busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-2 mb-3">
                <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                  selected ? 'bg-accent border-accent' : 'border-white/20'
                }`}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-white truncate">{contact.name}</p>
                  <p className="text-[10px] font-medium text-white/30">
                    {selected ? 'Keeps everything below' : 'Folds into the selected record'}
                  </p>
                </div>
                {contact.is_favorite && <Star className="w-3.5 h-3.5 text-yellow-500 fill-current shrink-0 ml-auto" />}
              </div>

              <div className="space-y-1.5">
                {FIELDS.map(field => {
                  const value = field.read(contact);
                  const Icon = field.icon;
                  return (
                    <div key={field.key} className="flex items-start gap-2">
                      <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${conflicting.has(field.key) ? 'text-yellow-500/70' : 'text-white/20'}`} />
                      <span
                        title={`${field.label}: ${value || 'not set'}`}
                        className={`text-[10px] font-medium break-words ${
                          value
                            ? conflicting.has(field.key) ? 'text-yellow-500' : 'text-white/60'
                            : 'text-white/15'
                        }`}
                      >
                        {value || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 pb-4">
        <p className="flex-1 text-[10px] font-medium text-white/30 leading-relaxed">
          {plan && plan.gained.length > 0
            ? `Merging fills in ${plan.gained.join(', ')} on the record you keep, and moves the others' job history onto it.`
            : 'Merging moves the other records’ job history onto the one you keep, then deletes them.'}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-white/50 hover:text-white transition-all disabled:opacity-40"
        >
          Not a duplicate
        </button>
        <button
          type="button"
          onClick={() => onMerge(keepId)}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-white hover:text-black text-white text-[10px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Merge className="w-3.5 h-3.5" /> Merge into selected</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function DuplicateReview({
  groups,
  busyKey,
  onMerge,
  onDismiss,
  onClose,
}: {
  groups: DuplicateGroup[];
  busyKey: string | null;
  onMerge: (group: DuplicateGroup, keepId: string) => void;
  onDismiss: (group: DuplicateGroup) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg cursor-pointer"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-4xl bg-neutral-950 border border-white/10 rounded-3xl shadow-2xl cursor-default flex flex-col max-h-[90vh]"
      >
        <div className="flex items-start justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-yellow-500" /> Possible duplicates
            </h2>
            <p className="text-[11px] font-medium text-white/40 mt-1">
              Nothing is merged until you pick the record to keep. Dismissed pairs stay dismissed.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <Check className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">No duplicates left to review.</p>
              <p className="text-[11px] font-medium text-white/30 mt-1">The rolodex looks clean.</p>
            </div>
          ) : (
            groups.map(group => (
              <GroupCard
                key={group.key}
                group={group}
                busy={busyKey === group.key}
                onMerge={(keepId) => onMerge(group, keepId)}
                onDismiss={() => onDismiss(group)}
              />
            ))
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500/60 shrink-0" />
          <p className="text-[10px] font-medium text-white/30 flex-1">
            A merge keeps every value the surviving record already has and fills its blanks from the others.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-white/60 hover:text-white transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
