'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, UserPlus, Trash2, ShieldCheck, Eye, EyeOff, Link2 } from 'lucide-react';
import { confirmAction } from '@/components/Feedback';
import { APP_ROLES, ROLE_HINTS, ROLE_LABELS, type AppRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { hasAnyRole, POST_ROLES } from '@/lib/crew-roles';
import { caps } from '@/lib/format';

// Admin-only team roster. Creates accounts with a temporary password the admin
// hands over — no client-facing signup flow, matching how the tool is used.
//
// A freelance editor's account is the one that needs a second thing besides a
// role. Their board is filtered to the cards assigned to them, and assignment
// points at a Rolodex contact, so the account has to say which contact it is.
// The form asks for it, offers to make the Rolodex entry when there isn't one
// yet, and won't create the account without it — an unlinked editor account
// opens onto an empty board with nothing on screen to explain why.

interface Member {
  id: string;
  email: string;
  role: AppRole;
  contact_id?: string | null;
  contact_name?: string | null;
}

interface ContactOption {
  id: string;
  name: string;
  email?: string | null;
  primary_role?: string | null;
  secondary_roles?: string[] | null;
}

/** Sentinel for "make a new Rolodex entry for this person". */
const NEW_CONTACT = '__new__';

interface Props {
  session: any;
  onMessage: (msg: string) => void;
}

export default function TeamSettings({ session, onMessage }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('staff');
  const [showPassword, setShowPassword] = useState(false);

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [newContactId, setNewContactId] = useState<string>(NEW_CONTACT);
  const [newContactName, setNewContactName] = useState('');

  const authHeaders = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }), [session?.access_token]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/team/members', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
      else onMessage(data.error || 'Failed to load team.');
    } catch {
      onMessage('Failed to load team.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onMessage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase
      .from('contacts')
      .select('id, name, email, primary_role, secondary_roles')
      .order('name')
      .then(({ data }) => setContacts((data as ContactOption[]) || []));
  }, []);

  // Typing an address that is already in the Rolodex picks that person, so the
  // common case — the editor you have been emailing for two years — is one
  // field instead of three.
  useEffect(() => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const match = contacts.find(c => (c.email || '').trim().toLowerCase() === email);
    if (match) setNewContactId(match.id);
  }, [newEmail, contacts]);

  // People the Edit Tracker will actually offer when assigning a card. Anyone
  // else can still be picked; linking them adds the hat rather than blocking it.
  const postContacts = contacts.filter(c => hasAnyRole(c, POST_ROLES));
  const otherContacts = contacts.filter(c => !hasAnyRole(c, POST_ROLES));
  const needsContact = newRole === 'editor';
  const contactReady =
    !needsContact ||
    (newContactId === NEW_CONTACT ? newContactName.trim().length > 1 : !!newContactId);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setNewPassword(Array.from(bytes).map(b => chars[b % chars.length]).join(''));
    setShowPassword(true);
  };

  const addMember = async () => {
    setBusy(true);
    onMessage('');
    try {
      const linking =
        newContactId === NEW_CONTACT
          ? { contactName: newContactName.trim() || newEmail.split('@')[0] }
          : { contactId: newContactId };

      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: authHeaders(),
        // Only an editor account is linked from here. The picker is the only
        // place that choice is visible, so linking a role that doesn't show it
        // would be a side effect nobody asked for.
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
          ...(needsContact ? linking : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onMessage(
          newRole === 'editor'
            ? `Account created. Share the temporary password with ${newEmail} — they sign in at /command-center, land on the Edit Tracker, and see the cards assigned to their linked contact.`
            : `Account created. Share the temporary password with ${newEmail} — they sign in at /command-center.`
        );
        setNewEmail('');
        setNewPassword('');
        setNewContactName('');
        setNewContactId(NEW_CONTACT);
        load();
      } else {
        onMessage(data.error || 'Failed to create the account.');
      }
    } catch {
      onMessage('Failed to create the account.');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setMembers(prev => prev.map(m => (m.id === userId ? { ...m, role: role as Member['role'] } : m)));
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onMessage(data.error || 'Failed to update the role.');
      }
    } catch {
      onMessage('Failed to update the role.');
    } finally {
      // Always re-read: switching someone to Freelance Editor changes what the
      // row has to show about them.
      load();
    }
  };

  const changeContact = async (userId: string, contactId: string) => {
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ userId, contactId: contactId || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onMessage(data.error || 'Failed to change the linked contact.');
      }
    } catch {
      onMessage('Failed to change the linked contact.');
    } finally {
      load();
    }
  };

  const removeMember = async (member: Member) => {
    if (!(await confirmAction({ title: 'Remove teammate?', message: `${member.email} — their login stops working immediately. Productions, cards, and contacts they created are not affected.`, danger: true, confirmLabel: 'Remove' }))) return;
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ userId: member.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== member.id));
        onMessage(`${member.email} removed.`);
      } else {
        onMessage(data.error || 'Failed to remove the member.');
      }
    } catch {
      onMessage('Failed to remove the member.');
    }
  };

  const inputClass = 'w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white transition-colors';
  const labelClass = 'block text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roster */}
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white mb-1">Team Members</h4>
        <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
          Internal accounts for your crew and staff. Each person signs in with their own email, gets their own Google connection, My Work view, and Vault.
        </p>
        <div className="space-y-2">
          {members.length === 0 && (
            <p className="text-[11px] text-white/30 py-3">No team accounts yet — add the first one below.</p>
          )}
          {members.map(m => {
            const isSelf = m.id === session?.user?.id;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{m.email}{isSelf && <span className="text-accent/70 font-black uppercase text-[11px] md:text-[9px] ml-2">You</span>}</p>
                  <p className="text-[11px] md:text-[9px] text-white/30">{ROLE_HINTS[m.role] || ''}</p>
                  {m.role === 'editor' && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Link2 className={`w-3 h-3 shrink-0 ${m.contact_id ? 'text-accent/70' : 'text-amber-400'}`} />
                      <select
                        value={m.contact_id || ''}
                        onChange={(e) => changeContact(m.id, e.target.value)}
                        title="Cards assigned to this contact are the cards this account can see"
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] font-bold text-white/70 outline-none focus:border-accent cursor-pointer max-w-[15rem]"
                      >
                        <option value="">Not linked — sees nothing</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{caps(c.name)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <select
                  value={m.role}
                  disabled={isSelf}
                  onChange={(e) => changeRole(m.id, e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 outline-none focus:border-accent appearance-none cursor-pointer disabled:opacity-40"
                >
                  {APP_ROLES.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeMember(m)}
                  disabled={isSelf}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors disabled:opacity-20"
                  title={isSelf ? 'You cannot remove your own account' : 'Remove this account'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add member */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white mb-3">
          <UserPlus className="w-3.5 h-3.5 text-accent" /> Add Team Member
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" placeholder="name@yourcompany.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)} className={`${inputClass} appearance-none cursor-pointer`}>
              {APP_ROLES.map(role => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
            <p className="text-[11px] md:text-[9px] text-white/30 mt-1.5 leading-relaxed">{ROLE_HINTS[newRole]}</p>
          </div>
        </div>

        {needsContact && (
          <div className="mb-3 rounded-lg border border-accent/20 bg-accent/[0.04] p-3">
            <label className={labelClass}>Rolodex Contact</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                <option value={NEW_CONTACT}>＋ Create a new contact</option>
                {postContacts.length > 0 && (
                  <optgroup label="Post crew">
                    {postContacts.map(c => <option key={c.id} value={c.id}>{caps(c.name)}</option>)}
                  </optgroup>
                )}
                {otherContacts.length > 0 && (
                  <optgroup label="Everyone else">
                    {otherContacts.map(c => <option key={c.id} value={c.id}>{caps(c.name)}</option>)}
                  </optgroup>
                )}
              </select>
              {newContactId === NEW_CONTACT && (
                <input
                  className={inputClass}
                  type="text"
                  placeholder="Their name, e.g. Dana Whitfield"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              )}
            </div>
            <p className="text-[11px] md:text-[9px] text-white/40 mt-2 leading-relaxed">
              This is what decides which cards they see: an editor account shows the Edit Tracker
              cards assigned to this contact, and nothing else in the studio. Picking someone who
              isn&apos;t listed as post crew adds Editor to their roles so they can be assigned.
            </p>
          </div>
        )}
        <label className={labelClass}>Temporary Password</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className={inputClass}
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            type="button"
            onClick={generatePassword}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
          >
            Generate
          </button>
        </div>
        <p className="text-[11px] md:text-[9px] text-white/30 mt-2 leading-relaxed">
          Share this password with them directly — they sign in immediately and should keep it safe. Accounts are internal-only; nothing here is exposed to clients unless you give a client role on purpose.
        </p>
        <div className="flex justify-end mt-3">
          <button
            onClick={addMember}
            disabled={busy || !newEmail.trim() || newPassword.length < 8 || !contactReady}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
