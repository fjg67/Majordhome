import { create } from 'zustand';
import { supabase, subscribeToTable } from '@services/supabase';
import type { Task, CalendarEvent } from '@appTypes/index';

interface CalendarState {
  selectedDate: string;
  tasks: Task[];
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  setSelectedDate: (date: string) => void;
  fetchMonthData: (householdId: string, year: number, month: number) => Promise<void>;
  subscribeRealtime: (householdId: string) => () => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  selectedDate: new Date().toISOString().split('T')[0],
  tasks: [],
  events: [],
  isLoading: false,
  error: null,

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  fetchMonthData: async (householdId: string, year: number, month: number) => {
    set({ isLoading: true, error: null });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    try {
      const [tasksRes, eventsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('household_id', householdId)
          .gte('due_date', startDate)
          .lte('due_date', endDate)
          .order('due_date', { ascending: true }),
        supabase
          .from('events')
          .select('*')
          .eq('household_id', householdId)
          .gte('start_at', `${startDate}T00:00:00`)
          .lte('start_at', `${endDate}T23:59:59`)
          .order('start_at', { ascending: true }),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (eventsRes.error) throw eventsRes.error;

      set({
        tasks: (tasksRes.data ?? []) as Task[],
        events: (eventsRes.data ?? []) as CalendarEvent[],
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Erreur chargement',
        isLoading: false,
      });
    }
  },

  subscribeRealtime: (householdId: string) => {
    const unsubTasks = subscribeToTable('tasks', householdId, (payload) => {
      const state = get();
      if (payload.eventType === 'INSERT') {
        set({ tasks: [...state.tasks, payload.new as unknown as Task] });
      } else if (payload.eventType === 'UPDATE') {
        set({
          tasks: state.tasks.map((t) =>
            t.id === (payload.new as Record<string, unknown>).id
              ? (payload.new as unknown as Task)
              : t,
          ),
        });
      } else if (payload.eventType === 'DELETE') {
        set({
          tasks: state.tasks.filter(
            (t) => t.id !== (payload.old as Record<string, unknown>).id,
          ),
        });
      }
    });

    const unsubEvents = subscribeToTable('events', householdId, (payload) => {
      const state = get();
      if (payload.eventType === 'INSERT') {
        set({ events: [...state.events, payload.new as unknown as CalendarEvent] });
      } else if (payload.eventType === 'UPDATE') {
        set({
          events: state.events.map((e) =>
            e.id === (payload.new as Record<string, unknown>).id
              ? (payload.new as unknown as CalendarEvent)
              : e,
          ),
        });
      } else if (payload.eventType === 'DELETE') {
        set({
          events: state.events.filter(
            (e) => e.id !== (payload.old as Record<string, unknown>).id,
          ),
        });
      }
    });

    return () => {
      unsubTasks();
      unsubEvents();
    };
  },
}));
