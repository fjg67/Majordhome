import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type { FoodItem, ExpiryStatus } from '@appTypes/index';

export const getExpiryStatus = (expiryDate: string): ExpiryStatus => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return 'expired';
  if (diffDays <= 2) return 'urgent';
  if (diffDays <= 5) return 'warning';
  return 'ok';
};

export const getDaysUntilExpiry = (expiryDate: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
};

interface UseFoodTrackerOptions {
  householdId: string;
}

export const useFoodTracker = ({ householdId }: UseFoodTrackerOptions) => {
  const queryClient = useQueryClient();

  const foodQuery = useQuery({
    queryKey: ['food', householdId],
    queryFn: async (): Promise<FoodItem[]> => {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('household_id', householdId)
        .is('consumed_at', null)
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FoodItem[];
    },
    enabled: !!householdId,
  });

  const addFood = useMutation({
    mutationFn: async (
      item: Omit<FoodItem, 'id' | 'consumed_at' | 'created_at'>,
    ) => {
      const { data, error } = await supabase
        .from('food_items')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      const food = data as FoodItem;
      // Planifier notification DLC via le nouveau service
      await notificationService.scheduleFoodExpiryReminder({
        id: food.id,
        name: food.name,
        expiry_date: food.expiry_date,
        quantity: food.quantity ?? '',
      });
      return food;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['food', householdId] });
    },
  });

  const consumeFood = useMutation({
    mutationFn: async (foodId: string) => {
      const { error } = await supabase
        .from('food_items')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', foodId);
      if (error) throw error;
      await notificationService.cancelFoodReminders(foodId);
    },
    onMutate: async (foodId) => {
      await queryClient.cancelQueries({ queryKey: ['food', householdId] });
      const previous = queryClient.getQueryData<FoodItem[]>([
        'food',
        householdId,
      ]);
      queryClient.setQueryData<FoodItem[]>(
        ['food', householdId],
        (old) => old?.filter((f) => f.id !== foodId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['food', householdId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['food', householdId] });
    },
  });

  const stats = {
    expired: (foodQuery.data ?? []).filter(
      (f) => getExpiryStatus(f.expiry_date) === 'expired',
    ).length,
    urgent: (foodQuery.data ?? []).filter(
      (f) => getExpiryStatus(f.expiry_date) === 'urgent',
    ).length,
    warning: (foodQuery.data ?? []).filter(
      (f) => getExpiryStatus(f.expiry_date) === 'warning',
    ).length,
    ok: (foodQuery.data ?? []).filter(
      (f) => getExpiryStatus(f.expiry_date) === 'ok',
    ).length,
  };

  return {
    foods: foodQuery.data ?? [],
    isLoading: foodQuery.isLoading,
    error: foodQuery.error,
    stats,
    addFood: addFood.mutate,
    consumeFood: consumeFood.mutate,
    refetch: foodQuery.refetch,
  };
};
