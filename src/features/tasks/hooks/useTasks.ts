import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import type { Task } from '@appTypes/index';

interface UseTasksOptions {
  householdId: string;
  filter?: 'today' | 'week' | 'all' | 'completed';
}

export const useTasks = ({ householdId, filter = 'all' }: UseTasksOptions) => {
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const fetchTasks = useCallback(async (): Promise<Task[]> => {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('household_id', householdId)
      .order('due_date', { ascending: true });

    switch (filter) {
      case 'today':
        query = query.eq('due_date', today).is('completed_at', null);
        break;
      case 'week':
        query = query
          .gte('due_date', today)
          .lte('due_date', weekEnd)
          .is('completed_at', null);
        break;
      case 'completed':
        query = query.not('completed_at', 'is', null);
        break;
      case 'all':
      default:
        query = query.is('completed_at', null);
        break;
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Task[];
  }, [householdId, filter, today, weekEnd]);

  const tasksQuery = useQuery({
    queryKey: ['tasks', householdId, filter],
    queryFn: fetchTasks,
    enabled: !!householdId,
  });

  const toggleComplete = useMutation({
    mutationFn: async ({
      taskId,
      completed,
      userId,
    }: {
      taskId: string;
      completed: boolean;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? userId : null,
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onMutate: async ({ taskId, completed, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', householdId] });
      const previous = queryClient.getQueryData<Task[]>([
        'tasks',
        householdId,
        filter,
      ]);

      queryClient.setQueryData<Task[]>(
        ['tasks', householdId, filter],
        (old) =>
          old?.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  completed_at: completed ? new Date().toISOString() : null,
                  completed_by: completed ? userId : null,
                }
              : t,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['tasks', householdId, filter],
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', householdId] });
    },
  });

  const createTask = useMutation({
    mutationFn: async (
      task: Omit<Task, 'id' | 'completed_at' | 'completed_by' | 'created_at'>,
    ) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', householdId] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', householdId] });
      const previous = queryClient.getQueryData<Task[]>([
        'tasks',
        householdId,
        filter,
      ]);
      queryClient.setQueryData<Task[]>(
        ['tasks', householdId, filter],
        (old) => old?.filter((t) => t.id !== taskId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['tasks', householdId, filter],
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', householdId] });
    },
  });

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    refetch: tasksQuery.refetch,
    toggleComplete: toggleComplete.mutate,
    createTask: createTask.mutate,
    deleteTask: deleteTask.mutate,
  };
};
