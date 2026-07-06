'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Scissors, Clapperboard, ListTodo, Loader2, UserCheck, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { formatLocalDate, parseLocalDate } from '@/lib/date';

// "My Work" — everything assigned to the signed-in user in one place:
// edit cards where they're the editor, upcoming shoots where they're on the
// crew, and open tasks. Identity is matched to the Rolodex by the account's
// email, so it works with the data the team already keeps.

interface MyCard {
  id: string;
  title: string;
  client_name?: string;
  edit_status?: string;
  due_date?: string;
}

interface MyCall {
  jobId: string;
  title: string;
  position: string;
  shoot_date?: string;
  call_time?: string;
  location_name?: string;
}

interface OpenTask {
  id: string;
  task: string;
  job_title?: string | null;
  due_date?: string | null;
}

export default function MyWorkWidget() {
  const [email, setEmail] = useState<string | null>(null);
  const [cards, setCards] = useState<MyCard[]>([]);
  const [calls, setCalls] = useState<MyCall[]>([]);
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email?.toLowerCase() || null);
    });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!email) return;
    try {
      // My contact record(s) — identity bridge between auth and the Rolodex.
      const { data: myContacts } = await supabase
        .from('contacts')
        .select('id')
        .ilike('email', email);
      const myIds = (myContacts || []).map(c => c.id);

      const [cardsRes, rolesRes, tasksRes] = await Promise.all([
        myIds.length > 0
          ? supabase
              .from('jobs')
              .select('id, title, client_name, edit_status, due_date, job_status, editor_id')
              .in('editor_id', myIds)
              .not('edit_status', 'is', null)
              .neq('job_status', 'Cancelled')
          : Promise.resolve({ data: [] } as any),
        myIds.length > 0
          ? supabase
              .from('job_roles')
              .select('position, job:jobs(id, title, shoot_date, call_time, location_name, job_status)')
              .in('contact_id', myIds)
          : Promise.resolve({ data: [] } as any),
        supabase
          .from('job_todos')
          .select('id, task, due_date, job:jobs(title)')
          .eq('completed', false)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(25),
      ]);

      setCards(((cardsRes.data as any[]) || []).filter(c => !['Delivered', 'Wrapped'].includes(c.edit_status)));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming: MyCall[] = ((rolesRes.data as any[]) || [])
        .filter(r => r.job && r.job.job_status !== 'Cancelled')
        .map(r => ({
          jobId: r.job.id,
          title: r.job.title,
          position: r.position,
          shoot_date: r.job.shoot_date,
          call_time: r.job.call_time,
          location_name: r.job.location_name,
        }))
        .filter(c => {
          const d = parseLocalDate(c.shoot_date);
          return d && d >= today;
        })
        .sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || ''))
        .slice(0, 10);
      setCalls(upcoming);

      setTasks(((tasksRes.data as any[]) || []).map(t => ({
        id: t.id,
        task: t.task,
        due_date: t.due_date,
        job_title: t.job?.title || null,
      })));
    } catch (err) {
      console.error('My Work load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (email) fetchAll();
    else if (email === null) setLoading(false);
  }, [email, fetchAll]);

  useRealtime(['jobs', 'job_roles', 'job_todos'], fetchAll);

  const toggleTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await supabase.from('job_todos').update({ completed: true }).eq('id', id);
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  const sectionTitle = 'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-2';

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-5 space-y-6">
      {/* My edit cards */}
      <section>
        <h3 className={sectionTitle}><Scissors className="w-3.5 h-3.5 text-accent" /> My Edits ({cards.length})</h3>
        {cards.length === 0 ? (
          <p className="text-[11px] text-white/25 px-1">No active edits assigned to you.</p>
        ) : (
          <div className="space-y-1.5">
            {cards.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.title}</p>
                  <p className="text-[9px] text-white/35 truncate">{c.client_name || 'Internal'}</p>
                </div>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-accent bg-accent/10 px-2 py-1 rounded-full">{c.edit_status}</span>
                {c.due_date && (
                  <span className="shrink-0 text-[9px] font-bold text-white/40">{formatLocalDate(c.due_date, { month: 'short', day: 'numeric' })}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My upcoming calls */}
      <section>
        <h3 className={sectionTitle}><Clapperboard className="w-3.5 h-3.5 text-accent" /> My Upcoming Shoots ({calls.length})</h3>
        {calls.length === 0 ? (
          <p className="text-[11px] text-white/25 px-1">No upcoming crew calls.</p>
        ) : (
          <div className="space-y-1.5">
            {calls.map((c, i) => (
              <div key={`${c.jobId}-${i}`} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.title}</p>
                  <p className="text-[9px] text-white/35 truncate">{c.position}{c.location_name ? ` · ${c.location_name}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="flex items-center gap-1 text-[10px] font-bold text-white/60 justify-end">
                    <Calendar className="w-3 h-3 text-white/30" /> {formatLocalDate(c.shoot_date, { month: 'short', day: 'numeric' })}
                  </p>
                  {c.call_time && <p className="text-[9px] text-accent font-bold mt-0.5">Call {c.call_time}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Open tasks */}
      <section>
        <h3 className={sectionTitle}><ListTodo className="w-3.5 h-3.5 text-accent" /> Open Tasks ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <p className="text-[11px] text-white/25 px-1">No open tasks. Nice.</p>
        ) : (
          <div className="space-y-1">
            {tasks.map(t => (
              <label key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleTask(t.id)}
                  className="w-4 h-4 rounded border-white/20 text-accent focus:ring-accent bg-black cursor-pointer shrink-0"
                />
                <span className="flex-1 min-w-0 text-xs text-white/80 truncate">{t.task}</span>
                {t.job_title && <span className="text-[9px] font-bold text-accent/60 truncate max-w-[110px] shrink-0">{t.job_title}</span>}
                {t.due_date && <span className="text-[9px] text-white/30 shrink-0">{formatLocalDate(t.due_date, { month: 'short', day: 'numeric' })}</span>}
              </label>
            ))}
          </div>
        )}
      </section>

      {!email && (
        <p className="flex items-center gap-2 text-[10px] text-white/30 px-1">
          <UserCheck className="w-3.5 h-3.5" /> Sign in to see work assigned to you.
        </p>
      )}
    </div>
  );
}
