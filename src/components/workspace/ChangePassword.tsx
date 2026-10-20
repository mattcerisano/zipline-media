'use client';

import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/** Long enough to resist guessing; Supabase's own floor is only 6. */
const MIN_LENGTH = 10;

/**
 * Change the signed-in user's password from Settings → Profile.
 *
 * There was no way to do this in the app, so a password that had leaked could
 * only be changed from the Supabase dashboard. The current password is checked
 * first — Supabase's updateUser doesn't ask for it, so on its own anyone at an
 * unlocked, signed-in screen could have set a new one. Other devices are signed
 * out by default, since the usual reason to change a password is that someone
 * else may have it.
 */
export default function ChangePassword({ email, inputClass, labelClass }: {
  email: string;
  inputClass: string;
  labelClass: string;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const problem =
    !current || !next || !confirm ? null
      : next.length < MIN_LENGTH ? `Use at least ${MIN_LENGTH} characters.`
      : next !== confirm ? 'The new passwords don’t match.'
      : next === current ? 'Pick a password you haven’t used here before.'
      : null;
  const ready = !!current && !!next && !!confirm && !problem;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) {
        setStatus({ ok: false, text: 'Your current password isn’t right.' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setStatus({ ok: false, text: `Couldn’t change your password: ${error.message}` });
        return;
      }
      let note = '';
      if (signOutOthers) {
        const out = await supabase.auth.signOut({ scope: 'others' });
        if (out.error) note = ' Other devices couldn’t be signed out — sign them out from each device.';
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus({ ok: true, text: `Password updated.${signOutOthers && !note ? ' Other devices have been signed out.' : ''}${note}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="pt-4 mt-2 border-t border-white/10 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-white/40" />
        <h3 className="text-sm font-semibold text-white">Password</h3>
      </div>
      {/* Lets password managers pair the new password with this account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label className={labelClass} htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
        <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="accent-[var(--color-accent)]" />
        Sign out other devices
      </label>
      {(problem || status) && (
        <p className={`text-xs ${problem || !status?.ok ? 'text-red-400' : 'text-green-400'}`} role="status">
          {problem || status?.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!ready || busy}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
