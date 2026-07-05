'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User as UserIcon, Building2, Upload, Loader2, Save, Palette, SwatchBook, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/components/gearbuilder/types';
import type { Branding } from '@/lib/branding';
import { applyAccent, extractBrandColorFromImage } from '@/lib/brand-theme';
import ThemeSwitcher from './ThemeSwitcher';
import IntegrationsSettings from './IntegrationsSettings';

interface ProfileSettingsProps {
  session: any;
  userRole?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProfileSettings({ session, userRole, onClose, onSaved }: ProfileSettingsProps) {
  const isAdmin = userRole === 'admin';
  const userId = session?.user?.id;

  const [tab, setTab] = useState<'profile' | 'appearance' | 'branding' | 'integrations'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [org, setOrg] = useState<Partial<Branding>>({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Brand color auto-detected from the uploaded logo, offered as a one-tap fill.
  const [suggestedColor, setSuggestedColor] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load current profile + org branding
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, orgRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('organizations').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]);
        if (profileRes.data) {
          setProfile(profileRes.data as Profile);
        } else {
          setProfile({ id: userId, email: session?.user?.email || '' });
        }
        if (orgRes.data) setOrg(orgRes.data as Branding);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) load();
  }, [userId, session?.user?.email]);

  // Generic image upload to a public Supabase Storage bucket
  const uploadImage = async (bucket: string, file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      console.error('Upload failed:', error);
      setMessage(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setMessage(null);
    const url = await uploadImage('avatars', file);
    if (url) setProfile(p => ({ ...p, avatar_url: url }));
    setUploadingAvatar(false);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setMessage(null);
    setSuggestedColor(null);
    const url = await uploadImage('branding', file);
    if (url) {
      setOrg(o => ({ ...o, logo_url: url }));
      // Read the dominant brand color straight off the logo so the user can
      // match the app to their brand in one tap. Fails soft to no suggestion.
      try {
        const detected = await extractBrandColorFromImage(url);
        if (detected && detected.toLowerCase() !== (org.brand_color || '').toLowerCase()) {
          setSuggestedColor(detected);
        }
      } catch {
        /* extraction unavailable (e.g. CORS) — user can still pick manually */
      }
    }
    setUploadingLogo(false);
  };

  // Set the brand color and re-skin the app live so the change is visible
  // immediately, before the user even saves.
  const chooseBrandColor = (hex: string) => {
    setOrg(o => ({ ...o, brand_color: hex }));
    applyAccent(hex);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        id: userId,
        full_name: profile.full_name || null,
        position: profile.position || null,
        phone: profile.phone || null,
        address: profile.address || null,
        email: profile.email || session?.user?.email || null,
        avatar_url: profile.avatar_url || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      setMessage('Profile saved.');
      onSaved?.();
    } catch (err: any) {
      setMessage(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!org.id) {
      setMessage('No organization found to update.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: org.name || 'My Production Company',
        tagline: org.tagline || null,
        logo_url: org.logo_url || null,
        brand_color: org.brand_color || '#0077FF',
        address: org.address || null,
        phone: org.phone || null,
        email: org.email || null,
        website: org.website || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('organizations').update(payload).eq('id', org.id);
      if (error) throw error;
      // Persist the accent app-wide (and cache it for next load).
      applyAccent(payload.brand_color);
      setMessage('Branding saved. The app and new exports now use it.');
      onSaved?.();
    } catch (err: any) {
      setMessage(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-black/50 border border-white/10 py-2.5 px-3 rounded-lg outline-none focus:border-accent text-sm text-white transition-colors';
  const labelClass = 'block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full md:max-w-xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-950">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Settings</h3>
            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-5 pt-4">
            <button
              onClick={() => setTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'profile' ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
            >
              <UserIcon className="w-3.5 h-3.5" /> My Profile
            </button>
            <button
              onClick={() => setTab('appearance')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'appearance' ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
            >
              <SwatchBook className="w-3.5 h-3.5" /> Appearance
            </button>
            {isAdmin && (
              <button
                onClick={() => setTab('branding')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'branding' ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
              >
                <Palette className="w-3.5 h-3.5" /> Branding
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setTab('integrations')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'integrations' ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
              >
                <Bell className="w-3.5 h-3.5" /> Integrations
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {tab === 'profile' && (
                <>
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {profile.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-8 h-8 text-white/30" />
                      )}
                    </div>
                    <div>
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingAvatar ? 'Uploading…' : 'Upload Photo'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input className={inputClass} value={profile.full_name || ''} onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Position / Title</label>
                      <input className={inputClass} value={profile.position || ''} onChange={(e) => setProfile(p => ({ ...p, position: e.target.value }))} placeholder="Producer, DP, Editor…" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input className={inputClass} value={profile.email || session?.user?.email || ''} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input className={inputClass} value={profile.phone || ''} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Address</label>
                    <input className={inputClass} value={profile.address || ''} onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </>
              )}

              {tab === 'appearance' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Theme</label>
                    <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
                      Choose how Studio OS looks. Your choice is saved to this browser and applies the next time you sign in.
                    </p>
                    <ThemeSwitcher />
                  </div>
                </div>
              )}

              {tab === 'branding' && isAdmin && (
                <>
                  {/* Logo */}
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 p-2">
                      {org.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-7 h-7 text-white/30" />
                      )}
                    </div>
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                      </button>
                      <p className="text-[8px] text-white/30 mt-1 uppercase tracking-widest">PNG with transparency works best</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Company Name</label>
                      <input className={inputClass} value={org.name || ''} onChange={(e) => setOrg(o => ({ ...o, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Tagline</label>
                      <input className={inputClass} value={org.tagline || ''} onChange={(e) => setOrg(o => ({ ...o, tagline: e.target.value }))} placeholder="Creative Video Production" />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Brand Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={org.brand_color || '#0077FF'}
                        onChange={(e) => chooseBrandColor(e.target.value)}
                        className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                      />
                      <input
                        className={inputClass}
                        value={org.brand_color || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setOrg(o => ({ ...o, brand_color: v }));
                          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) applyAccent(v.trim());
                        }}
                        placeholder="#0077FF"
                      />
                    </div>
                    {suggestedColor && (
                      <button
                        type="button"
                        onClick={() => { chooseBrandColor(suggestedColor); setSuggestedColor(null); }}
                        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-accent/50 transition-colors"
                      >
                        <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: suggestedColor }} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                          Use color from logo · {suggestedColor}
                        </span>
                      </button>
                    )}
                    <p className="text-[8px] text-white/30 mt-1 uppercase tracking-widest">Themes the whole app, plus headers & accents in exported call sheets and manifests</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Company Email</label>
                      <input className={inputClass} value={org.email || ''} onChange={(e) => setOrg(o => ({ ...o, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Company Phone</label>
                      <input className={inputClass} value={org.phone || ''} onChange={(e) => setOrg(o => ({ ...o, phone: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Website</label>
                      <input className={inputClass} value={org.website || ''} onChange={(e) => setOrg(o => ({ ...o, website: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Address</label>
                      <input className={inputClass} value={org.address || ''} onChange={(e) => setOrg(o => ({ ...o, address: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {tab === 'integrations' && isAdmin && (
                <IntegrationsSettings isAdmin={isAdmin} onMessage={setMessage} />
              )}

              {message && (
                <p className="text-[11px] font-bold text-accent">{message}</p>
              )}
            </div>
          )}

          {/* Footer */}
          {!loading && (
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-zinc-950">
              <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">
                Close
              </button>
              {tab !== 'appearance' && tab !== 'integrations' && (
                <button
                  onClick={tab === 'profile' ? handleSaveProfile : handleSaveBranding}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
