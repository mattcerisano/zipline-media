'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EscapeToClose, Modal, Portal } from '@/components/workspace/Overlay';
import {
  Lock, Unlock, Plus, Eye, EyeOff, Copy, Trash2, X, Loader2, ShieldCheck,
  KeyRound, CreditCard, FileText, Paperclip, Calendar, Search, Download, Users, RefreshCw, UserPlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  deriveKey, encryptString, decryptString, createVerifier, checkVerifier, randomSaltBase64, reencryptItems,
} from '@/lib/vault-crypto';
import { toast, confirmAction } from '@/components/Feedback';

/**
 * The Vault: passwords, licenses and other secure information, encrypted in
 * the browser so the database only ever holds ciphertext.
 *
 * Two spaces. **Personal** is one person's, unlocked with their own
 * passphrase — as it always was. **Shared** is for the select people an admin
 * adds as members (migration 20261019221841): only members can see it at all,
 * and they unlock it with a team passphrase they know, so getting into a
 * member's Studio OS account isn't enough to read it. Changing that passphrase
 * re-encrypts every shared item in one go — what to do after removing someone
 * who knew it.
 */

interface VaultItem {
  id: string;
  user_id: string;
  shared?: boolean;
  category: 'subscription' | 'license' | 'product_key' | 'password' | 'other';
  name: string;
  username?: string;
  url?: string;
  secret_cipher?: string;
  notes_cipher?: string;
  file_path?: string;
  file_name?: string;
  expires_at?: string;
}

type Space = 'personal' | 'shared';
type Meta = { salt: string; verifier: string };

interface TeamAccount {
  id: string;
  email: string | null;
  role: string | null;
}

const CATEGORIES: { id: VaultItem['category']; label: string; icon: React.ElementType }[] = [
  { id: 'subscription', label: 'Subscriptions', icon: CreditCard },
  { id: 'license', label: 'Licenses', icon: ShieldCheck },
  { id: 'product_key', label: 'Product keys', icon: KeyRound },
  { id: 'password', label: 'Passwords', icon: Lock },
  { id: 'other', label: 'Other', icon: FileText },
];

/** A table the shared-vault migration creates. Missing means it hasn't been run. */
const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''));

export default function Vault({ userRole }: { userRole?: string | null } = {}) {
  const isAdmin = userRole === 'admin';
  const [userId, setUserId] = useState<string | null>(null);
  const [space, setSpace] = useState<Space>('personal');

  // undefined = still loading, null = not set up yet
  const [personalMeta, setPersonalMeta] = useState<Meta | null | undefined>(undefined);
  const [sharedMeta, setSharedMeta] = useState<Meta | null | undefined>(undefined);
  /** False until the shared-vault migration has run. */
  const [sharedAvailable, setSharedAvailable] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [keys, setKeys] = useState<Record<Space, CryptoKey | null>>({ personal: null, shared: null });

  const [passphrase, setPassphrase] = useState('');
  const [passphrase2, setPassphrase2] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({}); // id -> decrypted secret
  const [editing, setEditing] = useState<Partial<VaultItem> & { _secret?: string; _notes?: string; _file?: File | null } | null>(null);

  const [membersOpen, setMembersOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  const key = keys[space];
  const meta = space === 'personal' ? personalMeta : sharedMeta;
  const canSeeShared = sharedAvailable && (isMember || isAdmin);

  const refreshShared = useCallback(async (uid: string) => {
    const [memberRes, metaRes] = await Promise.all([
      supabase.from('vault_members').select('user_id').eq('user_id', uid).maybeSingle(),
      supabase.from('vault_shared_meta').select('salt, verifier').eq('id', 1).maybeSingle(),
    ]);
    if (isMissingTable(memberRes.error) || isMissingTable(metaRes.error)) {
      setSharedAvailable(false);
      setSharedMeta(null);
      return;
    }
    setSharedAvailable(true);
    setIsMember(!!memberRes.data);
    setSharedMeta(metaRes.data ? { salt: metaRes.data.salt, verifier: metaRes.data.verifier } : null);
  }, []);

  // Identify the user, and find out which vaults exist for them.
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
      if (!uid) { setPersonalMeta(null); setSharedMeta(null); return; }
      const { data: own } = await supabase.from('vault_meta').select('salt, verifier').eq('id', uid).maybeSingle();
      setPersonalMeta(own ? { salt: own.salt, verifier: own.verifier } : null);
      await refreshShared(uid);
    };
    void init();
  }, [refreshShared]);

  const loadItems = useCallback(async (which: Space) => {
    if (!userId) return;
    if (which === 'shared') {
      const { data } = await supabase.from('vault_items').select('*').eq('shared', true).order('name');
      setItems((data as VaultItem[]) || []);
    } else {
      // Filtered here rather than with .eq('shared', false), so a database
      // without the shared column (migration not run) still lists everything.
      const { data } = await supabase.from('vault_items').select('*').eq('user_id', userId).order('name');
      setItems(((data as VaultItem[]) || []).filter(i => !i.shared));
    }
  }, [userId]);

  const switchSpace = (next: Space) => {
    if (next === space) return;
    setSpace(next);
    setItems([]);
    setRevealed({});
    setSearch('');
    setPassphrase(''); setPassphrase2(''); setUnlockError(null);
    if (keys[next]) void loadItems(next);
  };

  // Set up a vault: your own, or (an admin) the shared one.
  const handleCreateVault = async () => {
    if (!userId) return;
    if (passphrase.length < 8) { setUnlockError('Use at least 8 characters.'); return; }
    if (passphrase !== passphrase2) { setUnlockError('Passphrases do not match.'); return; }
    setBusy(true);
    setUnlockError(null);
    try {
      const salt = randomSaltBase64();
      const newKey = await deriveKey(passphrase, salt);
      const verifier = await createVerifier(newKey);
      if (space === 'shared') {
        // Whoever sets it up is its first member, or they couldn't open it.
        const { error: memberErr } = await supabase
          .from('vault_members')
          .upsert({ user_id: userId, added_by: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
        if (memberErr) throw memberErr;
        const { error } = await supabase.from('vault_shared_meta').insert({ id: 1, salt, verifier, updated_by: userId });
        if (error) throw error;
        setIsMember(true);
        setSharedMeta({ salt, verifier });
      } else {
        const { error } = await supabase.from('vault_meta').insert({ id: userId, salt, verifier });
        if (error) throw error;
        setPersonalMeta({ salt, verifier });
      }
      setKeys(k => ({ ...k, [space]: newKey }));
      setPassphrase(''); setPassphrase2('');
      await loadItems(space);
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to create the vault.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!meta) return;
    setBusy(true);
    setUnlockError(null);
    try {
      const derived = await deriveKey(passphrase, meta.salt);
      if (!(await checkVerifier(meta.verifier, derived))) { setUnlockError('Incorrect passphrase.'); return; }
      setKeys(k => ({ ...k, [space]: derived }));
      setPassphrase('');
      await loadItems(space);
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to unlock.');
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setKeys(k => ({ ...k, [space]: null }));
    setRevealed({});
    setItems([]);
  };

  const revealSecret = async (item: VaultItem) => {
    if (!key || !item.secret_cipher) return;
    if (revealed[item.id]) {
      setRevealed(r => { const n = { ...r }; delete n[item.id]; return n; });
      return;
    }
    try {
      const plain = await decryptString(item.secret_cipher, key);
      setRevealed(r => ({ ...r, [item.id]: plain }));
    } catch {
      setRevealed(r => ({ ...r, [item.id]: '⚠️ decrypt failed' }));
    }
  };

  const copySecret = async (item: VaultItem) => {
    if (!key || !item.secret_cipher) return;
    try {
      const plain = revealed[item.id] || await decryptString(item.secret_cipher, key);
      await navigator.clipboard.writeText(plain);
      toast('Copied.', 'success');
    } catch { /* ignore */ }
  };

  const handleSaveItem = async () => {
    if (!editing || !key || !userId) return;
    if (!editing.name?.trim()) return;
    setBusy(true);
    try {
      let file_path = editing.file_path;
      let file_name = editing.file_name;
      if (editing._file) {
        const folder = space === 'shared' ? 'shared' : userId;
        const path = `${folder}/${Date.now()}_${editing._file.name}`;
        const { error: upErr } = await supabase.storage.from('vault').upload(path, editing._file, { upsert: true });
        if (upErr) throw upErr;
        file_path = path;
        file_name = editing._file.name;
      }

      const payload: Record<string, unknown> = {
        category: editing.category || 'password',
        name: editing.name.trim(),
        username: editing.username?.trim() || null,
        url: editing.url?.trim() || null,
        secret_cipher: editing._secret ? await encryptString(editing._secret, key) : (editing.secret_cipher || null),
        notes_cipher: editing._notes ? await encryptString(editing._notes, key) : (editing.notes_cipher || null),
        file_path: file_path || null,
        file_name: file_name || null,
        expires_at: editing.expires_at || null,
        updated_at: new Date().toISOString(),
      };
      // Only shared items carry the flag, so a personal save still works on a
      // database that hasn't added the column.
      if (space === 'shared') payload.shared = true;

      if (editing.id) {
        const { error } = await supabase.from('vault_items').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vault_items').insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
      setEditing(null);
      await loadItems(space);
    } catch (err: any) {
      toast(`Save failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (item: VaultItem) => {
    const where = space === 'shared' ? 'the shared vault — for every member' : 'your vault';
    if (!(await confirmAction({ message: `Delete "${item.name}" from ${where}?`, danger: true, confirmLabel: 'Delete' }))) return;
    if (item.file_path) await supabase.storage.from('vault').remove([item.file_path]);
    const { error } = await supabase.from('vault_items').delete().eq('id', item.id);
    if (error) toast(`Delete failed: ${error.message}`, 'error');
    await loadItems(space);
  };

  const openEditItem = async (item: VaultItem) => {
    let _secret = '';
    let _notes = '';
    if (key) {
      if (item.secret_cipher) { try { _secret = await decryptString(item.secret_cipher, key); } catch {} }
      if (item.notes_cipher) { try { _notes = await decryptString(item.notes_cipher, key); } catch {} }
    }
    setEditing({ ...item, _secret, _notes, _file: null });
  };

  const downloadFile = async (item: VaultItem) => {
    if (!item.file_path) return;
    const { data } = await supabase.storage.from('vault').createSignedUrl(item.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const inputClass = 'w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white transition-colors';
  const labelClass = 'block text-[11px] md:text-[10px] font-medium text-white/45 mb-1.5';

  // Personal / Shared. Only shown to someone who can open the shared vault —
  // a member, or an admin who manages it.
  const spaceSwitcher = canSeeShared && (
    <div className="flex items-center gap-1 p-1 bg-black/50 border border-white/10 rounded-xl w-fit">
      {(['personal', 'shared'] as const).map(s => (
        <button
          key={s}
          type="button"
          onClick={() => switchSpace(s)}
          aria-pressed={space === s}
          className={`px-3.5 py-1.5 text-[13px] font-medium tracking-tight rounded-lg transition-colors flex items-center gap-1.5 ${
            space === s ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'
          }`}
        >
          {s === 'personal' ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
          {s === 'personal' ? 'Personal' : 'Shared'}
        </button>
      ))}
    </div>
  );

  const membersModal = userId && (
    <MembersModal
      open={membersOpen}
      onClose={() => setMembersOpen(false)}
      userId={userId}
      isAdmin={isAdmin}
      onMembershipChanged={async (removedSomeone) => {
        await refreshShared(userId);
        if (removedSomeone && keys.shared && isAdmin) {
          const rotate = await confirmAction({
            title: 'Change the shared passphrase?',
            message: "They can no longer open the shared vault. If they knew the passphrase, change it now so it's useless to them.",
            confirmLabel: 'Change passphrase',
            cancelLabel: 'Not now',
          });
          if (rotate) { setMembersOpen(false); setRotateOpen(true); }
        }
      }}
    />
  );

  // ---------------- Loading ----------------
  if (personalMeta === undefined || sharedMeta === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  // ---------------- Shared, but not for this person yet ----------------
  if (space === 'shared' && !key && (!isMember || !sharedMeta)) {
    const message = !sharedMeta
      ? null
      : 'You are not a member of the shared vault. Add yourself under Members, then ask a member for the shared passphrase.';
    if (message || !isAdmin) {
      return (
        <div className="p-4 md:p-6 space-y-6">
          {spaceSwitcher}
          <div className="flex items-center justify-center py-12 px-4">
            <div className="w-full max-w-sm bg-neutral-900/60 border border-white/10 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h2 className="text-sm font-semibold text-white">Shared vault</h2>
              <p className="text-[12px] text-white/50 mt-2 leading-relaxed">
                {message || "An admin hasn't set up the shared vault yet."}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white"
                >
                  <Users className="w-3.5 h-3.5" /> Members
                </button>
              )}
            </div>
          </div>
          {membersModal}
        </div>
      );
    }
  }

  // ---------------- Set up / unlock ----------------
  if (!key) {
    const setup = !meta;
    const shared = space === 'shared';
    return (
      <div className="p-4 md:p-6 space-y-6">
        {spaceSwitcher}
        <div className="flex items-center justify-center py-10 px-4">
          <div className="w-full max-w-sm bg-neutral-900/60 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
              {shared ? <Users className="w-6 h-6 text-accent" /> : <Lock className="w-6 h-6 text-accent" />}
            </div>
            <h2 className="text-sm font-semibold text-white">
              {setup ? (shared ? 'Set up the shared vault' : 'Create your vault') : (shared ? 'Shared vault locked' : 'Vault locked')}
            </h2>
            <p className="text-[12px] text-white/50 mt-2 leading-relaxed">
              {setup
                ? shared
                  ? 'Choose the passphrase members will use. Share it with them in person — it is never stored, and nobody can recover it.'
                  : 'Choose a passphrase. Secrets are encrypted in your browser — nobody can recover this passphrase, so store it safely.'
                : shared
                  ? 'Enter the shared passphrase to open the passwords and keys shared with members.'
                  : 'Enter your passphrase to decrypt your subscriptions, licenses and keys.'}
            </p>

            <div className="mt-6 space-y-3 text-left">
              <input
                type="password"
                autoFocus
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !setup) void handleUnlock(); }}
                placeholder={shared ? 'Shared passphrase' : 'Vault passphrase'}
                className={inputClass}
              />
              {setup && (
                <input
                  type="password"
                  value={passphrase2}
                  onChange={(e) => setPassphrase2(e.target.value)}
                  placeholder="Confirm passphrase"
                  className={inputClass}
                />
              )}
              {unlockError && <p className="text-[11px] font-semibold text-red-400">{unlockError}</p>}
              <button
                onClick={setup ? handleCreateVault : handleUnlock}
                disabled={busy || !passphrase}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                {setup ? (shared ? 'Set up shared vault' : 'Create vault') : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
        {isAdmin && !sharedAvailable && (
          <p className="text-center text-[11px] text-white/35">
            Sharing with select people needs the 20261019221841_shared_vault migration run in Supabase.
          </p>
        )}
        {membersModal}
      </div>
    );
  }

  // ---------------- Unlocked ----------------
  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || (i.username || '').toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {spaceSwitcher}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            {space === 'shared' ? <Users className="w-4 h-4 text-accent" /> : <ShieldCheck className="w-4 h-4 text-accent" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{space === 'shared' ? 'Shared vault' : 'Vault'}</h2>
            <p className="text-[11px] font-medium text-white/40">
              End-to-end encrypted · {items.length} item{items.length === 1 ? '' : 's'}
              {space === 'shared' ? ' · visible to members only' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="bg-black/50 border border-white/10 py-2 pl-9 pr-3 rounded-lg outline-none focus:border-accent text-xs font-normal text-white w-full md:w-44"
            />
          </div>
          <button
            onClick={() => setEditing({ category: 'password', _file: null })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {space === 'shared' && (
            <button
              onClick={() => setMembersOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> Members
            </button>
          )}
          {space === 'shared' && isAdmin && (
            <button
              onClick={() => setRotateOpen(true)}
              title="Change the shared passphrase and re-encrypt every shared item"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Change passphrase
            </button>
          )}
          <button
            onClick={lock}
            title="Lock vault"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white transition-colors"
          >
            <Lock className="w-3.5 h-3.5" /> Lock
          </button>
        </div>
      </div>

      {/* Grouped items */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-60">
          <p className="font-medium text-xs text-white/70">
            {space === 'shared'
              ? 'Nothing shared yet. Add a password, license or key every member should have.'
              : 'Vault is empty. Add a subscription, license or password.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(cat => {
            const catItems = filtered.filter(i => i.category === cat.id);
            if (catItems.length === 0) return null;
            const Icon = cat.icon;
            return (
              <section key={cat.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Icon className="w-3.5 h-3.5 text-accent" />
                  <h3 className="text-[12px] font-semibold text-white/70">{cat.label}</h3>
                  <div className="h-px bg-white/5 flex-1" />
                  <span className="text-[11px] font-medium text-white/30">{catItems.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map(item => (
                    <div key={item.id} className="bg-neutral-900/50 border border-white/10 rounded-2xl p-5 group hover:border-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          {item.username && <p className="text-[11px] font-medium text-white/40 truncate mt-0.5">{item.username}</p>}
                        </div>
                        <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditItem(item)} className="p-1 text-white/40 hover:text-accent" title="Edit" aria-label={`Edit ${item.name}`}><FileText className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteItem(item)} className="p-1 text-white/40 hover:text-red-500" title="Delete" aria-label={`Delete ${item.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {item.secret_cipher && (
                        <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-lg px-3 py-2 mb-2">
                          <code className="flex-1 text-[11px] text-white/80 font-mono truncate">
                            {revealed[item.id] || '••••••••••••'}
                          </code>
                          <button onClick={() => revealSecret(item)} className="text-white/40 hover:text-accent" title="Reveal" aria-label="Reveal">
                            {revealed[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => copySecret(item)} className="text-white/40 hover:text-accent" title="Copy" aria-label="Copy"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                      )}

                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                        {item.url && (
                          <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-accent hover:underline truncate max-w-full">{item.url}</a>
                        )}
                        {item.expires_at && (
                          <span className="text-[11px] font-medium text-white/40 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.expires_at}</span>
                        )}
                        {item.file_path && (
                          <button onClick={() => downloadFile(item)} className="text-[11px] font-medium text-white/50 hover:text-accent flex items-center gap-1">
                            <Download className="w-3 h-3" /> {item.file_name || 'File'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <Portal>
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm md:p-4"
            onClick={() => !busy && setEditing(null)}
          >
            <EscapeToClose onClose={() => { if (!busy) setEditing(null); }} />
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-950">
                <h3 className="text-sm font-semibold text-white">
                  {editing.id ? 'Edit item' : space === 'shared' ? 'New shared item' : 'New vault item'}
                </h3>
                <button onClick={() => setEditing(null)} className="p-1.5 text-white/40 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {space === 'shared' && !editing.id && (
                  <p className="text-[11px] text-white/45 leading-relaxed -mt-1">Every member of the shared vault will see this.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input className={inputClass} value={editing.name || ''} onChange={(e) => setEditing(s => ({ ...s!, name: e.target.value }))} placeholder="Adobe CC, Frame.io…" />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={editing.category || 'password'} onChange={(e) => setEditing(s => ({ ...s!, category: e.target.value as VaultItem['category'] }))}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Username / account</label>
                    <input className={inputClass} value={editing.username || ''} onChange={(e) => setEditing(s => ({ ...s!, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>URL</label>
                    <input className={inputClass} value={editing.url || ''} onChange={(e) => setEditing(s => ({ ...s!, url: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Password / product key <span className="text-accent">(encrypted)</span></label>
                  <input className={inputClass} value={editing._secret || ''} onChange={(e) => setEditing(s => ({ ...s!, _secret: e.target.value }))} placeholder={editing.secret_cipher && !editing._secret ? '•••••• (unchanged)' : ''} />
                </div>
                <div>
                  <label className={labelClass}>Notes <span className="text-accent">(encrypted)</span></label>
                  <textarea rows={2} className={`${inputClass} resize-none`} value={editing._notes || ''} onChange={(e) => setEditing(s => ({ ...s!, _notes: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Renewal / expiry date</label>
                    <input type="date" className={`${inputClass} [color-scheme:dark]`} value={editing.expires_at || ''} onChange={(e) => setEditing(s => ({ ...s!, expires_at: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Attach file (license PDF…)</label>
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer text-xs font-semibold text-white/60 hover:text-white">
                      <Paperclip className="w-3.5 h-3.5" />
                      {editing._file?.name || editing.file_name || 'Choose file'}
                      <input type="file" className="hidden" onChange={(e) => setEditing(s => ({ ...s!, _file: e.target.files?.[0] || null }))} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-zinc-950">
                <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white">Cancel</button>
                <button onClick={handleSaveItem} disabled={busy || !editing.name?.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </Portal>

      {membersModal}

      {keys.shared && (
        <RotatePassphraseModal
          open={rotateOpen}
          onClose={() => setRotateOpen(false)}
          currentKey={keys.shared}
          onRotated={async (newKey, newMeta) => {
            setKeys(k => ({ ...k, shared: newKey }));
            setSharedMeta(newMeta);
            setRevealed({});
            setRotateOpen(false);
            if (space === 'shared') await loadItems('shared');
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Members: who can open the shared vault. Admins add and remove; members see
// the list. Freelance editors are never offered — the database refuses them
// regardless.
// ----------------------------------------------------------------------
function MembersModal({
  open,
  onClose,
  userId,
  isAdmin,
  onMembershipChanged,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  isAdmin: boolean;
  onMembershipChanged: (removedSomeone: boolean) => void | Promise<void>;
}) {
  const [members, setMembers] = useState<string[]>([]);
  const [team, setTeam] = useState<TeamAccount[]>([]);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [memberRes, teamRes] = await Promise.all([
      supabase.from('vault_members').select('user_id'),
      supabase.from('user_roles').select('id, email, role'),
    ]);
    setMembers(((memberRes.data as { user_id: string }[]) || []).map(m => m.user_id));
    setTeam(((teamRes.data as TeamAccount[]) || []));
  }, []);

  useEffect(() => {
    if (open) void (async () => { await load(); })();
  }, [open, load]);

  const label = (id: string) => {
    const account = team.find(t => t.id === id);
    return account?.email || 'Unknown account';
  };
  const eligible = team.filter(t => !members.includes(t.id) && (t.role === 'admin' || t.role === 'staff'));

  const add = async () => {
    if (!adding) return;
    setBusy(true);
    const { error } = await supabase.from('vault_members').insert({ user_id: adding, added_by: userId });
    setBusy(false);
    if (error) { toast(`Couldn't add them: ${error.message}`, 'error'); return; }
    setAdding('');
    await load();
    await onMembershipChanged(false);
  };

  const remove = async (id: string) => {
    if (members.length <= 1) {
      toast('The shared vault needs at least one member.', 'error');
      return;
    }
    const ok = await confirmAction({
      title: id === userId ? 'Leave the shared vault?' : `Remove ${label(id)}?`,
      message: id === userId
        ? "You won't be able to open it again until an admin adds you back."
        : "They'll lose access to every shared item straight away.",
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from('vault_members').delete().eq('user_id', id);
    setBusy(false);
    if (error) { toast(`Couldn't remove them: ${error.message}`, 'error'); return; }
    await load();
    await onMembershipChanged(id !== userId);
  };

  return (
    <Modal open={open} onClose={onClose} title="Shared vault members" subtitle="Only these people can see shared items" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="space-y-1">
          {members.length === 0 && <p className="text-xs text-white/40">No members yet.</p>}
          {members.map(id => (
            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
              <span className="flex-1 min-w-0 text-[13px] text-white truncate">
                {label(id)}{id === userId ? <span className="text-white/40"> (you)</span> : null}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void remove(id)}
                  disabled={busy}
                  className="text-[11px] font-semibold text-white/40 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-white/45">Add a teammate</label>
            <div className="flex gap-2">
              <select
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                className="flex-1 min-w-0 bg-black/50 border border-white/10 py-2 px-3 rounded-lg outline-none focus:border-accent text-sm text-white"
              >
                <option value="">{eligible.length ? 'Choose an account…' : 'Everyone eligible is already a member'}</option>
                {eligible.map(t => (
                  <option key={t.id} value={t.id} className="bg-zinc-900">{t.email || t.id}{t.role === 'admin' ? ' · admin' : ''}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void add()}
                disabled={!adding || busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed">
              Adding someone lets them see the shared vault. Give them the shared passphrase in person to unlock it.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-white/35">Only an admin can change who&apos;s a member.</p>
        )}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Change the shared passphrase: re-encrypt every shared item with a key from
// the new one, then save items, salt and verifier in one transaction
// (rotate_shared_vault). Admins who are members only.
// ----------------------------------------------------------------------
function RotatePassphraseModal({
  open,
  onClose,
  currentKey,
  onRotated,
}: {
  open: boolean;
  onClose: () => void;
  currentKey: CryptoKey;
  onRotated: (key: CryptoKey, meta: Meta) => void | Promise<void>;
}) {
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => { if (busy) return; setNext(''); setNext2(''); setError(null); onClose(); };

  const rotate = async () => {
    if (next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (next !== next2) { setError('Passphrases do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { data, error: loadErr } = await supabase
        .from('vault_items')
        .select('id, secret_cipher, notes_cipher')
        .eq('shared', true);
      if (loadErr) throw loadErr;
      const salt = randomSaltBase64();
      const newKey = await deriveKey(next, salt);
      const verifier = await createVerifier(newKey);
      const batch = await reencryptItems((data || []) as { id: string; secret_cipher?: string | null; notes_cipher?: string | null }[], currentKey, newKey);
      const { error: rpcErr } = await supabase.rpc('rotate_shared_vault', { new_salt: salt, new_verifier: verifier, items: batch });
      if (rpcErr) throw rpcErr;
      toast(`Passphrase changed. ${batch.length} shared item${batch.length === 1 ? '' : 's'} re-encrypted — give members the new one.`, 'success');
      setNext(''); setNext2('');
      await onRotated(newKey, { salt, verifier });
    } catch (err: any) {
      setError(err?.message || 'Could not change the passphrase. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Change shared passphrase" subtitle="Re-encrypts every shared item" maxWidth="max-w-sm">
      <div className="space-y-3">
        <p className="text-[12px] text-white/50 leading-relaxed">
          Members will need the new passphrase to unlock the shared vault. Do this after removing someone who knew the old one.
        </p>
        <input
          type="password"
          autoFocus
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New shared passphrase"
          className="w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white"
        />
        <input
          type="password"
          value={next2}
          onChange={(e) => setNext2(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void rotate(); }}
          placeholder="Confirm new passphrase"
          className="w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white"
        />
        {error && <p className="text-[11px] font-semibold text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} disabled={busy} className="px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white">Cancel</button>
          <button
            type="button"
            onClick={() => void rotate()}
            disabled={busy || !next}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Change passphrase
          </button>
        </div>
      </div>
    </Modal>
  );
}
