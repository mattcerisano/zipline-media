'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ListTodo, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { formatLocalDate } from '@/lib/date';

// Standalone task list backed by the same job_todos table as the Slate prep
// checklist: tasks can be general (job_id NULL) or attached to a production,
// so items added here show up on that production's prep checklist and
// vice versa.

interface Todo {
  id: string;
  job_id: string | null;
  task: string;
  completed: boolean;
  due_date?: string | null;
  sort_order?: number;
}

interface JobOption {
  id: string;
  title: string;
}

export default function TasksWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newJobId, setNewJobId] = useState<string>(''); // '' = general
  const [showDone, setShowDone] = useState(false);

  const fetchTodos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('job_todos')
        .select('*')
        .order('completed')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('sort_order');
      if (!error && data) setTodos(data as Todo[]);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, job_status')
        .neq('job_status', 'Cancelled')
        .order('shoot_date', { ascending: false })
        .limit(200);
      setJobs((data as JobOption[]) || []);
    };
    loadJobs();
    fetchTodos();
  }, [fetchTodos]);

  useRealtime(['job_todos'], fetchTodos);

  const jobTitle = useMemo(() => {
    const map = new Map(jobs.map(j => [j.id, j.title]));
    return (id: string | null) => (id ? map.get(id) || 'Production' : null);
  }, [jobs]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const { error } = await supabase.from('job_todos').insert([{
        job_id: newJobId || null,
        task: newTask.trim(),
        completed: false,
        sort_order: todos.length,
      }]);
      if (error) throw error;
      setNewTask('');
      fetchTodos();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const toggle = async (todo: Todo) => {
    setTodos(prev => prev.map(t => (t.id === todo.id ? { ...t, completed: !t.completed } : t)));
    try {
      await supabase.from('job_todos').update({ completed: !todo.completed }).eq('id', todo.id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const remove = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await supabase.from('job_todos').delete().eq('id', id);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const open = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-5 space-y-4">
      {/* Add row */}
      <div className="flex gap-2 items-center bg-black/30 border border-white/10 rounded-2xl p-3">
        <input
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent transition-colors"
          placeholder="Add a task…"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
        />
        <select
          value={newJobId}
          onChange={(e) => setNewJobId(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] font-bold text-white/70 outline-none focus:border-accent appearance-none cursor-pointer max-w-[150px]"
          title="Attach to a production (shows on its prep checklist too)"
        >
          <option value="">General</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Open tasks */}
      {open.length === 0 && done.length === 0 ? (
        <div className="py-16 text-center opacity-30">
          <ListTodo className="w-12 h-12 mx-auto mb-3" />
          <p className="text-xs font-semibold text-white/50">Nothing to do — add a task above.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {open.map(todo => (
            <div key={todo.id} className="group flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggle(todo)}
                className="w-4 h-4 rounded border-white/20 text-accent focus:ring-accent bg-black cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{todo.task}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {jobTitle(todo.job_id) && (
                    <span className="text-[9px] font-bold text-accent/70 truncate">{jobTitle(todo.job_id)}</span>
                  )}
                  {todo.due_date && (
                    <span className="flex items-center gap-1 text-[9px] text-white/30">
                      <Calendar className="w-2.5 h-2.5" /> {formatLocalDate(todo.due_date, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(todo.id)} className="p-1.5 text-white/10 group-hover:text-white/30 hover:!text-red-400 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Completed */}
          {done.length > 0 && (
            <>
              <button
                onClick={() => setShowDone(v => !v)}
                className="w-full text-left px-1 pt-2 text-[9px] font-black uppercase tracking-widest text-white/25 hover:text-white/50 transition-colors"
              >
                {showDone ? 'Hide' : 'Show'} {done.length} completed
              </button>
              {showDone && done.map(todo => (
                <div key={todo.id} className="group flex items-center gap-3 bg-white/[0.01] border border-white/5 rounded-xl px-3 py-2.5 opacity-50">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggle(todo)}
                    className="w-4 h-4 rounded border-white/20 text-accent focus:ring-accent bg-black cursor-pointer shrink-0"
                  />
                  <p className="flex-1 min-w-0 text-xs text-white/60 line-through truncate">{todo.task}</p>
                  <button onClick={() => remove(todo.id)} className="p-1.5 text-white/10 group-hover:text-white/30 hover:!text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
