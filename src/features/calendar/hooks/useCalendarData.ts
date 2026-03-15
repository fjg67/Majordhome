import { useMemo } from 'react';
import { useCalendarStore } from '../store/calendarStore';
import type { Task, CalendarEvent, HouseholdMember } from '@appTypes/index';

interface DayData {
  tasks: Task[];
  events: CalendarEvent[];
}

interface MarkedDates {
  [date: string]: {
    dots?: Array<{ key: string; color: string }>;
    periods?: Array<{ startingDay: boolean; endingDay: boolean; color: string }>;
    selected?: boolean;
    selectedColor?: string;
  };
}

export const useCalendarData = (members: HouseholdMember[] = []) => {
  const { tasks, events, selectedDate } = useCalendarStore();

  // Find member by id (new: member.id) or user_id (old/created_by)
  const findMember = (id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  };

  const dayData = useMemo<DayData>(() => {
    const dayTasks = tasks.filter((t) => t.due_date === selectedDate);
    const dayEvents = events.filter((e) => {
      const eventDate = e.start_at.split('T')[0];
      return eventDate === selectedDate;
    });
    return { tasks: dayTasks, events: dayEvents };
  }, [tasks, events, selectedDate]);

  const markedDates = useMemo<MarkedDates>(() => {
    const marks: MarkedDates = {};

    // Regrouper les tâches par date
    for (const task of tasks) {
      const date = task.due_date;
      if (!marks[date]) marks[date] = { dots: [] };
      // Ajouter un dot par tâche (max 5 visibles)
      if ((marks[date].dots?.length ?? 0) < 5) {
        // Use member color if assigned, else red/green for status
        const member = findMember(task.assigned_to) ?? findMember(task.created_by);
        const dotColor = task.completed_at ? '#34D399' : (member?.color ?? '#FF6B6B');
        marks[date].dots?.push({
          key: task.id,
          color: dotColor,
        });
      }
    }

    // Regrouper les événements par date
    for (const event of events) {
      const date = event.start_at.split('T')[0];
      if (!marks[date]) marks[date] = { dots: [] };
      if (!marks[date].dots) marks[date].dots = [];
      if ((marks[date].dots?.length ?? 0) < 5) {
        marks[date].dots?.push({
          key: event.id,
          color: event.color ?? '#A78BFA',
        });
      }
    }

    // Marquer la date sélectionnée
    if (marks[selectedDate]) {
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = '#FF6B6B';
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: '#FF6B6B',
      };
    }

    return marks;
  }, [tasks, events, selectedDate, members]);

  return { dayData, markedDates, selectedDate };
};
