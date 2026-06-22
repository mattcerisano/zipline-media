'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to Supabase Realtime changes on one or more tables and run a
 * callback (typically a refetch) whenever any row is inserted, updated, or
 * deleted. This is what makes the app live for a team: when one teammate
 * saves, everyone else's open tabs refresh within ~1s.
 *
 * The callback is held in a ref so it always runs the latest closure without
 * re-subscribing, and bursts of changes are debounced into a single refetch.
 */
export function useRealtime(tables: string[], onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const key = tables.join(',');

  useEffect(() => {
    if (tables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 250);
    };

    const channelName = `realtime:${key}:${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        debounced
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
