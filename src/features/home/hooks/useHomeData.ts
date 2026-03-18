import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@services/supabase';
import type { HouseholdMember, FoodItem, Task, CalendarEvent } from '@appTypes/index';

// ─── Types ────────────────────────────────────────────────

export interface ActiveTimer {
  id: string;
  title: string;
  category: string;
  duration_sec: number;
  started_at: string | null;
  paused_at: string | null;
  elapsed_sec: number;
  status: 'running' | 'paused' | 'finished' | 'ready';
  created_by: string;
  household_id: string;
  is_shared: boolean;
}

export interface ActivePoll {
  id: string;
  question: string;
  emoji: string;
  category: string;
  options: Array<{ id: string; text: string; color: string; votes_count: number }>;
  total_votes: number;
  hasVoted: boolean;
  created_by: string;
}

export interface MonthBudget {
  total_spent: number;
  by_member: Array<{ member_id: string; amount: number }>;
  balances: Array<{ from_id: string; to_id: string; amount: number }>;
}

export interface ExpiringDoc {
  id: string;
  title: string;
  category: string;
  expiry_date: string;
  days_until_expiry: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  emoji: string | null;
}

export interface PinnedNote {
  id: string;
  title: string;
  content: string | null;
  category: string;
  created_by: string;
  updated_at: string;
  is_pinned: boolean;
}

export interface LastMessage {
  id: string;
  content: string | null;
  type: 'text' | 'image' | 'audio';
  sender_id: string;
  sender_name: string;
  sender_color: string;
  created_at: string;
}

export interface MyStats {
  streak_days: number;
  xp_total: number;
  level: number;
}

export interface TodayMood {
  [memberId: string]: string; // emoji humeur
}

export interface TodayChore {
  id: string;
  title: string;
  category: string;
  assigned_to: string;
  occurrence_id: string;
  completed: boolean;
}

export interface HomeData {
  members: HouseholdMember[];
  todayMoods: TodayMood;
  myStats: MyStats | null;
  upcomingEvents: CalendarEvent[];
  todayTasks: Task[];
  todayChores: TodayChore[];
  activeTimers: ActiveTimer[];
  activePoll: ActivePoll | null;
  monthBudget: MonthBudget | null;
  urgentFood: FoodItem[];
  expiringDocs: ExpiringDoc[];
  shoppingList: ShoppingItem[];
  shoppingCheckedCount: number;
  pinnedNotes: PinnedNote[];
  unreadMessages: number;
  lastMessage: LastMessage | null;
}

const EMPTY_DATA: HomeData = {
  members: [],
  todayMoods: {},
  myStats: null,
  upcomingEvents: [],
  todayTasks: [],
  todayChores: [],
  activeTimers: [],
  activePoll: null,
  monthBudget: null,
  urgentFood: [],
  expiringDocs: [],
  shoppingList: [],
  shoppingCheckedCount: 0,
  pinnedNotes: [],
  unreadMessages: 0,
  lastMessage: null,
};

// ─── Hook ────────────────────────────────────────────────

export const useHomeData = (householdId: string | undefined, currentUserId: string | undefined) => {
  const [data, setData] = useState<HomeData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!householdId || !currentUserId) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().slice(0, 10);
      const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      const [
        eventsRes, tasksRes, choresRes, timersRes,
        pollsRes, expensesRes, foodRes, docsRes,
        shoppingRes, notesRes, chatRes, moodsRes, statsRes,
      ] = await Promise.all([
        supabase.from('events')
          .select('*')
          .eq('household_id', householdId)
          .gte('start_at', now.toISOString().slice(0, 10))
          .lte('start_at', weekEnd)
          .order('start_at', { ascending: true })
          .limit(5),

        supabase.from('tasks')
          .select('*')
          .eq('household_id', householdId)
          .eq('due_date', todayStr)
          .order('created_at', { ascending: false }),

        supabase.from('chore_occurrences')
          .select('*, chores(title, category)')
          .eq('household_id', householdId)
          .eq('due_date', todayStr)
          .limit(5),

        supabase.from('timers')
          .select('*')
          .eq('household_id', householdId)
          .in('status', ['running', 'paused'])
          .order('created_at', { ascending: false })
          .limit(5),

        supabase.from('polls')
          .select('*, poll_options(*)')
          .eq('household_id', householdId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1),

        supabase.from('expenses')
          .select('*')
          .eq('household_id', householdId)
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .order('date', { ascending: false }),

        supabase.from('food_items')
          .select('*')
          .eq('household_id', householdId)
          .is('consumed_at', null)
          .lte('expiry_date', new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10))
          .order('expiry_date', { ascending: true })
          .limit(5),

        supabase.from('documents')
          .select('id, title, category, expiry_date')
          .eq('household_id', householdId)
          .not('expiry_date', 'is', null)
          .lte('expiry_date', in30Days)
          .order('expiry_date', { ascending: true })
          .limit(5),

        supabase.from('shopping_items')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(20),

        supabase.from('notes')
          .select('id, title, content, category, created_by, updated_at, is_pinned')
          .eq('household_id', householdId)
          .eq('is_pinned', true)
          .order('updated_at', { ascending: false })
          .limit(5),

        supabase.from('messages')
          .select('id, content, type, user_id, created_at, metadata')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(1),

        supabase.from('moods')
          .select('user_id, mood')
          .eq('household_id', householdId)
          .eq('mood_date', todayStr),

        supabase.from('player_stats')
          .select('streak_days, xp_total, level')
          .eq('household_id', householdId)
          .eq('user_id', currentUserId)
          .single(),
      ]);

      // Process moods
      const todayMoods: TodayMood = {};
      (moodsRes.data ?? []).forEach((m: any) => {
        todayMoods[m.user_id] = m.mood;
      });

      // Process stats
      const myStats: MyStats | null = statsRes.data
        ? { streak_days: statsRes.data.streak_days ?? 0, xp_total: statsRes.data.xp_total ?? 0, level: statsRes.data.level ?? 1 }
        : null;

      // Process chores
      const todayChores: TodayChore[] = (choresRes.data ?? []).map((c: any) => ({
        id: c.id,
        title: c.chores?.title ?? 'Corvée',
        category: c.chores?.category ?? 'other',
        assigned_to: c.assigned_to ?? '',
        occurrence_id: c.id,
        completed: !!c.completed_at,
      }));

      // Process timers
      const activeTimers: ActiveTimer[] = (timersRes.data ?? []) as ActiveTimer[];

      // Process poll — fetch options + votes séparément (compatible avec le schéma réel)
      let activePoll: ActivePoll | null = null;
      const pollData = pollsRes.data?.[0];
      if (pollData) {
        const [optRes, allVotesRes, myVoteRes] = await Promise.all([
          supabase.from('poll_options').select('id, text, label, color, sort_order').eq('poll_id', pollData.id).order('sort_order'),
          supabase.from('poll_votes').select('option_id').eq('poll_id', pollData.id),
          supabase.from('poll_votes').select('id').eq('poll_id', pollData.id).eq('user_id', currentUserId).limit(1),
        ]);

        const allVotes = (allVotesRes.data ?? []) as { option_id: string }[];
        const hasVoted = (myVoteRes.data?.length ?? 0) > 0;

        // Compter les votes par option
        const votesByOption: Record<string, number> = {};
        allVotes.forEach(v => {
          const key = String(v.option_id);
          votesByOption[key] = (votesByOption[key] ?? 0) + 1;
        });

        const rawOptions = optRes.data ?? (pollData.poll_options ?? []);
        const options = (rawOptions as any[]).map((o: any) => ({
          id: String(o.id),
          text: o.text ?? o.label ?? '',
          color: o.color ?? '#F5A623',
          votes_count: votesByOption[String(o.id)] ?? 0,
        }));

        activePoll = {
          id: pollData.id,
          question: pollData.question ?? '',
          emoji: pollData.emoji ?? '🗳️',
          category: pollData.category ?? 'other',
          options,
          total_votes: allVotes.length,
          hasVoted,
          created_by: pollData.created_by ?? '',
        };
      }

      // Process budget
      let monthBudget: MonthBudget | null = null;
      const expenses = expensesRes.data ?? [];
      if (expenses.length > 0) {
        const total = expenses.reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0);
        const byMember: Record<string, number> = {};
        expenses.forEach((e: any) => {
          const mid = e.paid_by ?? '';
          byMember[mid] = (byMember[mid] ?? 0) + (e.amount ?? 0);
        });
        monthBudget = {
          total_spent: total,
          by_member: Object.entries(byMember).map(([member_id, amount]) => ({ member_id, amount })),
          balances: [],
        };
      }

      // Process shopping
      const allShopping = (shoppingRes.data ?? []) as ShoppingItem[];
      const checkedCount = allShopping.filter(i => i.checked).length;

      // Process docs
      const expiringDocs: ExpiringDoc[] = (docsRes.data ?? []).map((d: any) => {
        const exp = new Date(d.expiry_date);
        const days = Math.floor((exp.getTime() - now.getTime()) / 86400000);
        return { id: d.id, title: d.title, category: d.category ?? 'other', expiry_date: d.expiry_date, days_until_expiry: days };
      });

      // Process chat
      let lastMessage: LastMessage | null = null;
      let unreadMessages = 0;
      const lastMsg = chatRes.data?.[0];
      if (lastMsg) {
        const unreadRes = await supabase.from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .neq('user_id', currentUserId);
        unreadMessages = unreadRes.count ?? 0;
        if (unreadMessages > 0) {
          lastMessage = {
            id: lastMsg.id,
            content: lastMsg.content,
            type: lastMsg.type ?? 'text',
            sender_id: lastMsg.user_id,
            sender_name: '',
            sender_color: '#F5A623',
            created_at: lastMsg.created_at,
          };
        }
      }

      setData({
        members: [],
        todayMoods,
        myStats,
        upcomingEvents: (eventsRes.data ?? []) as CalendarEvent[],
        todayTasks: (tasksRes.data ?? []) as Task[],
        todayChores,
        activeTimers,
        activePoll,
        monthBudget,
        urgentFood: (foodRes.data ?? []) as FoodItem[],
        expiringDocs,
        shoppingList: allShopping,
        shoppingCheckedCount: checkedCount,
        pinnedNotes: (notesRes.data ?? []) as PinnedNote[],
        unreadMessages,
        lastMessage,
      });
    } catch {
      // fail silently
    } finally {
      setIsLoading(false);
    }
  }, [householdId, currentUserId, todayStr]);

  // Partial refresh by section
  const refreshSection = useCallback(async (table: string) => {
    if (!householdId || !currentUserId) return;
    const now = new Date();
    const todayS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (table === 'timers') {
      const { data } = await supabase.from('timers')
        .select('*').eq('household_id', householdId).in('status', ['running', 'paused']).limit(5);
      setData(prev => ({ ...prev, activeTimers: (data ?? []) as ActiveTimer[] }));
    } else if (table === 'tasks') {
      const { data } = await supabase.from('tasks')
        .select('*').eq('household_id', householdId).eq('due_date', todayS);
      setData(prev => ({ ...prev, todayTasks: (data ?? []) as Task[] }));
    } else if (table === 'events') {
      const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from('events')
        .select('*').eq('household_id', householdId)
        .gte('start_at', todayS).lte('start_at', weekEnd).order('start_at').limit(5);
      setData(prev => ({ ...prev, upcomingEvents: (data ?? []) as CalendarEvent[] }));
    } else if (table === 'moods') {
      const { data } = await supabase.from('moods')
        .select('user_id, mood').eq('household_id', householdId).eq('mood_date', todayS);
      const m: TodayMood = {};
      (data ?? []).forEach((d: any) => { m[d.user_id] = d.mood; });
      setData(prev => ({ ...prev, todayMoods: m }));
    } else if (table === 'messages') {
      const unreadRes = await supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId).neq('user_id', currentUserId);
      const lastMsg = await supabase.from('messages')
        .select('id, content, type, user_id, created_at')
        .eq('household_id', householdId).order('created_at', { ascending: false }).limit(1);
      const unread = unreadRes.count ?? 0;
      let lm: LastMessage | null = null;
      if (unread > 0 && lastMsg.data?.[0]) {
        const m = lastMsg.data[0];
        lm = { id: m.id, content: m.content, type: m.type ?? 'text', sender_id: m.user_id, sender_name: '', sender_color: '#F5A623', created_at: m.created_at };
      }
      setData(prev => ({ ...prev, unreadMessages: unread, lastMessage: lm }));
    } else if (table === 'shopping_items') {
      const { data } = await supabase.from('shopping_items')
        .select('*').eq('household_id', householdId).order('created_at', { ascending: false }).limit(20);
      const items = (data ?? []) as ShoppingItem[];
      setData(prev => ({ ...prev, shoppingList: items, shoppingCheckedCount: items.filter(i => i.checked).length }));
    } else if (table === 'notes') {
      const { data } = await supabase.from('notes')
        .select('id, title, content, category, created_by, updated_at, is_pinned')
        .eq('household_id', householdId).eq('is_pinned', true).order('updated_at', { ascending: false }).limit(5);
      setData(prev => ({ ...prev, pinnedNotes: (data ?? []) as PinnedNote[] }));
    } else if (table === 'expenses') {
      // re-fetch full
      fetchAll();
    } else if (table === 'player_stats') {
      const { data } = await supabase.from('player_stats')
        .select('streak_days, xp_total, level').eq('household_id', householdId).eq('user_id', currentUserId).single();
      if (data) setData(prev => ({ ...prev, myStats: { streak_days: data.streak_days ?? 0, xp_total: data.xp_total ?? 0, level: data.level ?? 1 } }));
    } else if (table === 'poll_votes' || table === 'polls') {
      // Refresh léger du sondage actif uniquement
      const { data: pData } = await supabase.from('polls')
        .select('id, question, emoji, category, created_by')
        .eq('household_id', householdId).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1);
      if (!pData || pData.length === 0) {
        setData(prev => ({ ...prev, activePoll: null }));
        return;
      }
      const poll = pData[0] as any;
      const [optRes, allVotesRes, myVoteRes] = await Promise.all([
        supabase.from('poll_options').select('id, text, label, color, sort_order').eq('poll_id', poll.id).order('sort_order'),
        supabase.from('poll_votes').select('option_id').eq('poll_id', poll.id),
        supabase.from('poll_votes').select('id').eq('poll_id', poll.id).eq('user_id', currentUserId).limit(1),
      ]);
      const allVotes = (allVotesRes.data ?? []) as { option_id: string }[];
      const votesByOption: Record<string, number> = {};
      allVotes.forEach((v: any) => { const k = String(v.option_id); votesByOption[k] = (votesByOption[k] ?? 0) + 1; });
      const opts = (optRes.data ?? []).map((o: any) => ({
        id: String(o.id), text: o.text ?? o.label ?? '', color: o.color ?? '#F5A623',
        votes_count: votesByOption[String(o.id)] ?? 0,
      }));
      setData(prev => ({ ...prev, activePoll: {
        id: poll.id, question: poll.question ?? '', emoji: poll.emoji ?? '🗳️',
        category: poll.category ?? 'other', options: opts,
        total_votes: allVotes.length, hasVoted: (myVoteRes.data?.length ?? 0) > 0,
        created_by: poll.created_by ?? '',
      }}));
    } else if (table === 'chore_occurrences') {
      const { data } = await supabase.from('chore_occurrences')
        .select('*, chores(title, category)').eq('household_id', householdId).eq('due_date', todayS).limit(5);
      const chores = (data ?? []).map((c: any) => ({
        id: c.id, title: c.chores?.title ?? 'Corvée', category: c.chores?.category ?? 'other',
        assigned_to: c.assigned_to ?? '', occurrence_id: c.id, completed: !!c.completed_at,
      }));
      setData(prev => ({ ...prev, todayChores: chores }));
    } else if (table === 'food_items') {
      const exp5 = new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from('food_items')
        .select('*').eq('household_id', householdId).is('consumed_at', null).lte('expiry_date', exp5).order('expiry_date').limit(5);
      setData(prev => ({ ...prev, urgentFood: (data ?? []) as FoodItem[] }));
    } else if (table === 'documents') {
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from('documents')
        .select('id, title, category, expiry_date').eq('household_id', householdId)
        .not('expiry_date', 'is', null).lte('expiry_date', in30).order('expiry_date').limit(5);
      const docs = (data ?? []).map((d: any) => {
        const exp = new Date(d.expiry_date);
        const days = Math.floor((exp.getTime() - now.getTime()) / 86400000);
        return { id: d.id, title: d.title, category: d.category ?? 'other', expiry_date: d.expiry_date, days_until_expiry: days };
      });
      setData(prev => ({ ...prev, expiringDocs: docs }));
    }
  }, [householdId, currentUserId, fetchAll]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    if (!householdId) return;

    // Tables avec colonne household_id
    const tablesWithHousehold = [
      'tasks', 'events', 'moods', 'timers',
      'polls', 'expenses',
      'food_items', 'shopping_items',
      'notes', 'messages', 'chore_occurrences',
      'documents', 'player_stats',
    ];

    const channels = tablesWithHousehold.map(table =>
      supabase
        .channel(`home-rt-${table}-${householdId}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
          () => refreshSection(table),
        )
        .subscribe(),
    );

    // poll_votes n'a pas de household_id → subscription sans filtre, refresh si poll appartient au foyer
    const pollVotesCh = supabase
      .channel(`home-rt-poll_votes-${householdId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => refreshSection('poll_votes'),
      )
      .subscribe();

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      supabase.removeChannel(pollVotesCh);
    };
  }, [householdId, refreshSection]);

  return { data, isLoading, refetch: fetchAll };
};
