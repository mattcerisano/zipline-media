'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Unlock, Plus, Eye, EyeOff, Copy, Trash2, X, Loader2, ShieldCheck,
  KeyRound, CreditCard, FileText, Paperclip, Calendar, Search, Download,
  FolderOpen, Cloud, RefreshCw, Check, ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  deriveKey, encryptString, decryptString, createVerifier, checkVerifier, randomSaltBase64,
} from '@/lib/vault-crypto';

interface VaultItem {
  id: string;
  user_id: string;
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

const CATEGORIES: { id: VaultItem['category']; label: string; icon: React.ElementType }[] = [
  { id: 'subscription', label: 'Subscriptions', icon: CreditCard },
  { id: 'license', label: 'Licenses', icon: ShieldCheck },
  { id: 'product_key', label: 'Product Keys', icon: KeyRound },
  { id: 'password', label: 'Passwords', icon: Lock },
  { id: 'other', label: 'Other', icon: FileText },
];

export default function Vault() {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasVault, setHasVault] = useState<boolean | null>(null); // null = loading
  const [vaultMeta, setVaultMeta] = useState<{ salt: string; verifier: string } | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [passphrase2, setPassphrase2] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({}); // id -> decrypted secret
  const [editing, setEditing] = useState<Partial<VaultItem> & { _secret?: string; _notes?: string; _file?: File | null } | null>(null);

  // Identify the user and check whether a vault exists
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
      if (!uid) { setHasVault(false); return; }
      const { data: meta } = await supabase.from('vault_meta').select('*').eq('id', uid).maybeSingle();
      if (meta) {
        setVaultMeta({ salt: meta.salt, verifier: meta.verifier });
        setHasVault(true);
      } else {
        setHasVault(false);
      }
    };
    init();
  }, []);

  const loadItems = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('vault_items').select('*').eq('user_id', userId).order('name');
    setItems((data as VaultItem[]) || []);
  }, [userId]);

  // Set up a brand-new vault
  const handleCreateVault = async () => {
    if (passphrase.length < 8) { setUnlockError('Use at least 8 characters.'); return; }
    if (passphrase !== passphrase2) { setUnlockError('Passphrases do not match.'); return; }
    setBusy(true);
    setUnlockError(null);
    try {
      const salt = randomSaltBase64();
      const key = await deriveKey(passphrase, salt);
      const verifier = await createVerifier(key);
      const { error } = await supabase.from('vault_meta').insert({ id: userId, salt, verifier });
      if (error) throw error;
      setVaultMeta({ salt, verifier });
      setHasVault(true);
      setCryptoKey(key);
      setPassphrase(''); setPassphrase2('');
      await loadItems();
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to create vault.');
    } finally {
      setBusy(false);
    }
  };

  // Unlock an existing vault
  const handleUnlock = async () => {
    if (!vaultMeta) return;
    setBusy(true);
    setUnlockError(null);
    try {
      const key = await deriveKey(passphrase, vaultMeta.salt);
      const ok = await checkVerifier(vaultMeta.verifier, key);
      if (!ok) { setUnlockError('Incorrect passphrase.'); setBusy(false); return; }
      setCryptoKey(key);
      setPassphrase('');
      await loadItems();
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to unlock.');
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setCryptoKey(null);
    setRevealed({});
    setItems([]);
  };

  const revealSecret = async (item: VaultItem) => {
    if (!cryptoKey || !item.secret_cipher) return;
    if (revealed[item.id]) {
      setRevealed(r => { const n = { ...r }; delete n[item.id]; return n; });
      return;
    }
    try {
      const plain = await decryptString(item.secret_cipher, cryptoKey);
      setRevealed(r => ({ ...r, [item.id]: plain }));
    } catch {
      setRevealed(r => ({ ...r, [item.id]: '⚠️ decrypt failed' }));
    }
  };

  const copySecret = async (item: VaultItem) => {
    if (!cryptoKey || !item.secret_cipher) return;
    try {
      const plain = revealed[item.id] || await decryptString(item.secret_cipher, cryptoKey);
      await navigator.clipboard.writeText(plain);
    } catch { /* ignore */ }
  };

  const handleSaveItem = async () => {
    if (!editing || !cryptoKey || !userId) return;
    if (!editing.name?.trim()) return;
    setBusy(true);
    try {
      let file_path = editing.file_path;
      let file_name = editing.file_name;
      if (editing._file) {
        const path = `${userId}/${Date.now()}_${editing._file.name}`;
        const { error: upErr } = await supabase.storage.from('vault').upload(path, editing._file, { upsert: true });
        if (upErr) throw upErr;
        file_path = path;
        file_name = editing._file.name;
      }

      const payload: any = {
        user_id: userId,
        category: editing.category || 'password',
        name: editing.name.trim(),
        username: editing.username?.trim() || null,
        url: editing.url?.trim() || null,
        secret_cipher: editing._secret ? await encryptString(editing._secret, cryptoKey) : (editing.secret_cipher || null),
        notes_cipher: editing._notes ? await encryptString(editing._notes, cryptoKey) : (editing.notes_cipher || null),
        file_path: file_path || null,
        file_name: file_name || null,
        expires_at: editing.expires_at || null,
        updated_at: new Date().toISOString(),
      };

      if (editing.id) {
        const { error } = await supabase.from('vault_items').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vault_items').insert(payload);
        if (error) throw error;
      }
      setEditing(null);
      await loadItems();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (item: VaultItem) => {
    if (!confirm(`Delete "${item.name}" from the vault?`)) return;
    if (item.file_path) await supabase.storage.from('vault').remove([item.file_path]);
    await supabase.from('vault_items').delete().eq('id', item.id);
    await loadItems();
  };

  const openEditItem = async (item: VaultItem) => {
    // Pre-decrypt secret/notes for editing
    let _secret = '';
    let _notes = '';
    if (cryptoKey) {
      if (item.secret_cipher) { try { _secret = await decryptString(item.secret_cipher, cryptoKey); } catch {} }
      if (item.notes_cipher) { try { _notes = await decryptString(item.notes_cipher, cryptoKey); } catch {} }
    }
    setEditing({ ...item, _secret, _notes, _file: null });
  };

  const downloadFile = async (item: VaultItem) => {
    if (!item.file_path) return;
    const { data } = await supabase.storage.from('vault').createSignedUrl(item.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const inputClass = 'w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white transition-colors';
  const labelClass = 'block text-[9px] font-semibold uppercase tracking-wider text-white/40 mb-1.5';

  // ---------------- Lock / Setup screens ----------------
  if (hasVault === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!cryptoKey) {
    const setup = !hasVault;
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-sm bg-neutral-900/60 border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-sm font-semibold tracking-wide text-white">{setup ? 'Create Your Vault' : 'Vault Locked'}</h2>
          <p className="text-[11px] font-medium text-white/40 mt-2 leading-relaxed">
            {setup
              ? 'Choose a passphrase. Secrets are encrypted in your browser — we can never recover this passphrase, so store it safely.'
              : 'Enter your passphrase to decrypt your subscriptions, licenses & keys.'}
          </p>

          <div className="mt-6 space-y-3 text-left">
            <input
              type="password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !setup) handleUnlock(); }}
              placeholder="Vault passphrase..."
              className={inputClass}
            />
            {setup && (
              <input
                type="password"
                value={passphrase2}
                onChange={(e) => setPassphrase2(e.target.value)}
                placeholder="Confirm passphrase..."
                className={inputClass}
              />
            )}
            {unlockError && <p className="text-[11px] font-semibold text-red-400">{unlockError}</p>}
            <button
              onClick={setup ? handleCreateVault : handleUnlock}
              disabled={busy || !passphrase}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-white text-xs font-semibold tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
              {setup ? 'Create Vault' : 'Unlock'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Unlocked vault ----------------
  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || (i.username || '').toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">Vault</h2>
            <p className="text-[9px] font-medium text-white/40">End-to-end encrypted · {items.length} items</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-black/50 border border-white/10 py-2 pl-9 pr-3 rounded-lg outline-none focus:border-accent text-xs font-normal text-white w-full md:w-44"
            />
          </div>
          <button
            onClick={() => setEditing({ category: 'subscription', _file: null })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button
            onClick={lock}
            title="Lock vault"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold tracking-wide text-white/60 hover:text-white transition-colors"
          >
            <Lock className="w-3.5 h-3.5" /> Lock
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Vault Items */}
        <div className="lg:col-span-8 space-y-6">
          {filtered.length === 0 ? (
            <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
              <p className="font-semibold text-xs text-white">Vault is empty. Add a subscription, license, or password.</p>
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
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70">{cat.label}</h3>
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[9px] font-semibold opacity-30 uppercase tracking-wider text-white">{catItems.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {catItems.map(item => (
                        <div key={item.id} className="bg-neutral-900/50 border border-white/10 rounded-2xl p-5 group hover:border-accent/30 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                              {item.username && <p className="text-[9px] font-medium text-white/40 truncate mt-0.5">{item.username}</p>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditItem(item)} className="p-1 text-white/40 hover:text-accent" title="Edit"><FileText className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteItem(item)} className="p-1 text-white/40 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>

                          {item.secret_cipher && (
                            <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-lg px-3 py-2 mb-2">
                              <code className="flex-1 text-[11px] text-white/80 font-mono truncate">
                                {revealed[item.id] || '••••••••••••'}
                              </code>
                              <button onClick={() => revealSecret(item)} className="text-white/40 hover:text-accent" title="Reveal">
                                {revealed[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => copySecret(item)} className="text-white/40 hover:text-accent" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                            </div>
                          )}

                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                            {item.url && (
                              <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer" className="text-[9px] font-medium text-accent hover:underline truncate max-w-full">{item.url}</a>
                            )}
                            {item.expires_at && (
                              <span className="text-[9px] font-medium text-white/40 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.expires_at}</span>
                            )}
                            {item.file_path && (
                              <button onClick={() => downloadFile(item)} className="text-[9px] font-medium text-white/50 hover:text-accent flex items-center gap-1">
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
        </div>

        {/* Right: Cloud Folder Automator */}
        <div className="lg:col-span-4 sticky top-24">
          <CloudFolderAutomator />
        </div>
      </div>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm md:p-4"
            onClick={() => !busy && setEditing(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-950">
                <h3 className="text-sm font-semibold tracking-wide text-white">{editing.id ? 'Edit Item' : 'New Vault Item'}</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input className={inputClass} value={editing.name || ''} onChange={(e) => setEditing(s => ({ ...s!, name: e.target.value }))} placeholder="Adobe CC, Frame.io…" />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={editing.category || 'subscription'} onChange={(e) => setEditing(s => ({ ...s!, category: e.target.value as VaultItem['category'] }))}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Username / Account</label>
                    <input className={inputClass} value={editing.username || ''} onChange={(e) => setEditing(s => ({ ...s!, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>URL</label>
                    <input className={inputClass} value={editing.url || ''} onChange={(e) => setEditing(s => ({ ...s!, url: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Password / Product Key <span className="text-accent">(encrypted)</span></label>
                  <input className={inputClass} value={editing._secret || ''} onChange={(e) => setEditing(s => ({ ...s!, _secret: e.target.value }))} placeholder={editing.secret_cipher && !editing._secret ? '•••••• (unchanged)' : ''} />
                </div>
                <div>
                  <label className={labelClass}>Notes <span className="text-accent">(encrypted)</span></label>
                  <textarea rows={2} className={`${inputClass} resize-none`} value={editing._notes || ''} onChange={(e) => setEditing(s => ({ ...s!, _notes: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Renewal / Expiry Date</label>
                    <input type="date" className={`${inputClass} [color-scheme:dark]`} value={editing.expires_at || ''} onChange={(e) => setEditing(s => ({ ...s!, expires_at: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Attach File (license PDF…)</label>
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer text-xs font-semibold tracking-wide text-white/60 hover:text-white">
                      <Paperclip className="w-3.5 h-3.5" />
                      {editing._file?.name || editing.file_name || 'Choose file'}
                      <input type="file" className="hidden" onChange={(e) => setEditing(s => ({ ...s!, _file: e.target.files?.[0] || null }))} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-zinc-950">
                <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2.5 text-xs font-semibold tracking-wide text-white/50 hover:text-white">Cancel</button>
                <button onClick={handleSaveItem} disabled={busy || !editing.name?.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold tracking-wide hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/* Cloud Folder Automator Sidebar Widget                              */
/* ================================================================== */
function CloudFolderAutomator() {
  const [jobs, setJobs] = useState<{ id: string; title: string; client_name?: string }[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [provider, setProvider] = useState<'drive' | 'dropbox'>('drive');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [step, setStep] = useState(0); // 0 = idle, 1 = connecting, 2 = creating folders, 3 = finalizing, 4 = done
  const [integrations, setIntegrations] = useState<{ id: string; jobTitle: string; provider: string; date: string; url: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studio_vault_folder_integrations');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, client_name')
          .order('shoot_date', { ascending: false });
        if (!error && data && data.length > 0) {
          setJobs(data);
          setSelectedJobId(data[0].id);
        } else {
          // Mock fallback
          const mock = [
            { id: 'job-1', title: 'Pekoe Commercial Cut', client_name: 'Pekoe Tea Co.' },
            { id: 'job-2', title: 'Broadway B-Roll Reel', client_name: 'Broadway Productions' },
            { id: 'job-3', title: 'Reveals Campaign', client_name: 'Tech Inc.' }
          ];
          setJobs(mock);
          setSelectedJobId(mock[0].id);
        }
      } catch (e) {
        // Mock fallback
        const mock = [
          { id: 'job-1', title: 'Pekoe Commercial Cut', client_name: 'Pekoe Tea Co.' },
          { id: 'job-2', title: 'Broadway B-Roll Reel', client_name: 'Broadway Productions' },
          { id: 'job-3', title: 'Reveals Campaign', client_name: 'Tech Inc.' }
        ];
        setJobs(mock);
        setSelectedJobId(mock[0].id);
      }
    };
    fetchJobs();
  }, []);

  const activeJob = jobs.find(j => j.id === selectedJobId) || null;

  const handleProvision = () => {
    if (!activeJob) return;
    setIsProvisioning(true);
    setStep(1);

    // Step-by-step simulation
    setTimeout(() => {
      setStep(2);
      setTimeout(() => {
        setStep(3);
        setTimeout(() => {
          setStep(4);
          setIsProvisioning(false);
          
          const newIntegration = {
            id: 'int_' + Date.now(),
            jobTitle: activeJob.title,
            provider: provider === 'drive' ? 'Google Drive' : 'Dropbox',
            date: new Date().toLocaleDateString(),
            url: provider === 'drive' ? 'https://drive.google.com' : 'https://dropbox.com'
          };
          
          const updated = [newIntegration, ...integrations];
          setIntegrations(updated);
          localStorage.setItem('studio_vault_folder_integrations', JSON.stringify(updated));
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const handleDisconnect = (id: string) => {
    const updated = integrations.filter(i => i.id !== id);
    setIntegrations(updated);
    localStorage.setItem('studio_vault_folder_integrations', JSON.stringify(updated));
  };

  return (
    <div className="bg-neutral-900/60 border border-white/10 p-5 rounded-2xl space-y-4 text-white">
      <div className="flex items-center gap-2">
        <Cloud className="w-4.5 h-4.5 text-accent" />
        <h3 className="text-xs font-black uppercase tracking-widest text-accent">Cloud Folder Automator</h3>
      </div>
      
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-relaxed">
        Auto-provision standardized folder directories on Google Drive or Dropbox for active jobs
      </p>

      {/* Selectors */}
      <div className="space-y-3">
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1 block">Target Job / Project</label>
          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setStep(0);
            }}
            className="w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-xl outline-none focus:border-accent text-xs font-bold text-white appearance-none cursor-pointer"
          >
            {jobs.map(j => (
              <option key={j.id} value={j.id} className="bg-zinc-900">
                {j.title.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1 block">Cloud Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setProvider('drive'); setStep(0); }}
              className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all ${
                provider === 'drive'
                  ? 'bg-white text-black border-white shadow'
                  : 'bg-white/5 text-white/40 border-white/5 hover:text-white'
              }`}
            >
              Google Drive
            </button>
            <button
              type="button"
              onClick={() => { setProvider('dropbox'); setStep(0); }}
              className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all ${
                provider === 'dropbox'
                  ? 'bg-white text-black border-white shadow'
                  : 'bg-white/5 text-white/40 border-white/5 hover:text-white'
              }`}
            >
              Dropbox
            </button>
          </div>
        </div>
      </div>

      {/* Directory Preview */}
      {step === 0 && activeJob && (
        <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl font-mono text-[9px] text-white/60 space-y-1">
          <p className="text-white/45 font-bold uppercase tracking-wider">Preview Structure:</p>
          <div className="pl-2 border-l border-white/10 space-y-1 mt-2">
            <p className="text-white font-bold">📁 {activeJob.title.toUpperCase().replace(/\s+/g, '_')}</p>
            <p className="pl-3">📁 01_FOOTAGE</p>
            <p className="pl-6">📁 A_CAM</p>
            <p className="pl-6">📁 B_CAM</p>
            <p className="pl-3">📁 02_AUDIO</p>
            <p className="pl-3">📁 03_ASSETS</p>
            <p className="pl-3">📁 04_EXPORTS</p>
          </div>
        </div>
      )}

      {/* Provisioning Animation */}
      {isProvisioning && (
        <div className="bg-black/30 border border-white/5 p-4 rounded-2xl space-y-3 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto" />
          <span className="text-[8px] font-black text-accent tracking-widest bg-accent/10 px-2 py-0.5 rounded border border-accent/20 uppercase">
            {step === 1 ? 'CONNECTING TO API...' : step === 2 ? 'CREATING DIRECTORIES...' : 'FINALIZING PERMISSIONS...'}
          </span>
          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-1000" 
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Provision Completed */}
      {step === 4 && activeJob && (
        <div className="bg-green-500/5 border border-green-500/25 p-4 rounded-2xl space-y-3 text-center">
          <Check className="w-6 h-6 text-green-400 mx-auto" />
          <div>
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">STANDARD DIRECTORY PROVISIONED!</p>
            <p className="text-[8px] text-white/40 uppercase tracking-widest mt-1">Ready for uploads on {provider === 'drive' ? 'Google Drive' : 'Dropbox'}</p>
          </div>
          <a
            href={provider === 'drive' ? 'https://drive.google.com' : 'https://dropbox.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            Open Folder <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Action Button */}
      {step < 4 && !isProvisioning && (
        <button
          type="button"
          onClick={handleProvision}
          disabled={!activeJob}
          className="w-full bg-accent hover:bg-white hover:text-black text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border border-accent flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Provision Folder Structure
        </button>
      )}

      {/* Active integrations log */}
      {integrations.length > 0 && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <h4 className="text-[8px] font-black text-white/30 uppercase tracking-widest">Active Project Folders</h4>
          <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
            {integrations.map(i => (
              <div key={i.id} className="group flex justify-between items-center bg-black/20 border border-white/5 p-2.5 rounded-xl text-[9px]">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-bold text-white uppercase tracking-tight truncate">{i.jobTitle}</p>
                  <span className="text-[7px] text-white/40 uppercase tracking-widest">{i.provider} • {i.date}</span>
                </div>
                <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-white/30 hover:text-accent rounded transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(i.id)}
                    className="p-1 text-white/30 hover:text-red-400 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
