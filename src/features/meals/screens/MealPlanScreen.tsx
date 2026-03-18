import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
  StatusBar, Alert, Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import type { MealPlan, MealType, HouseholdMember } from '@appTypes/index';

dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');

const C = {
  bgDeep: '#1A0E00', bgMid: '#261400', bgSurface: '#2E1A00', bgElevated: '#3A2200',
  amber: '#F5A623', amberSoft: 'rgba(245,166,35,0.15)', amberGlow: 'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)', border: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.58)', textMuted: 'rgba(255,255,255,0.32)',
  green: '#34D399', red: '#FF6B6B', blue: '#4ECDC4', purple: '#A78BFA', orange: '#FF8C00',
};

const MEALS: { type: MealType; emoji: string; label: string; color: string }[] = [
  { type: 'breakfast', emoji: '🥐', label: 'Petit-déj', color: '#FFD700' },
  { type: 'lunch', emoji: '🍽️', label: 'Déjeuner', color: C.orange },
  { type: 'dinner', emoji: '🌙', label: 'Dîner', color: C.purple },
  { type: 'snack', emoji: '🍪', label: 'Goûter', color: C.green },
];

const QUICK_IDEAS: Record<MealType, string[]> = {
  breakfast: ['Tartines & confiture', 'Céréales & lait', 'Œufs brouillés', 'Pancakes', 'Smoothie bowl', 'Croissants'],
  lunch: ['Pâtes bolognaise', 'Salade César', 'Poulet grillé', 'Quiche lorraine', 'Buddha bowl', 'Croque-monsieur'],
  dinner: ['Soupe de légumes', 'Pizza maison', 'Gratin dauphinois', 'Saumon & riz', 'Raclette', 'Omelette'],
  snack: ['Fruits frais', 'Gâteau au chocolat', 'Cookies maison', 'Yaourt & granola', 'Crêpes', 'Compote'],
};

export const MealPlanScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user = useAuthStore(s => s.user);
  const members = useAuthStore(s => s.members);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
  const [editMealType, setEditMealType] = useState<MealType>('lunch');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  const weekDays = useMemo(() => {
    const start = dayjs().startOf('week').add(weekOffset * 7, 'day');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.month() === e.month()) return `${s.format('D')} - ${e.format('D MMMM YYYY')}`;
    return `${s.format('D MMM')} - ${e.format('D MMM YYYY')}`;
  }, [weekDays]);

  const load = useCallback(async () => {
    if (!household?.id) return;
    const start = weekDays[0].format('YYYY-MM-DD');
    const end = weekDays[6].format('YYYY-MM-DD');
    const { data } = await supabase.from('meal_plans').select('*')
      .eq('household_id', household.id)
      .gte('date', start).lte('date', end);
    setMeals((data ?? []) as MealPlan[]);
  }, [household?.id, weekDays]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('meal_plans', household.id, () => load());
  }, [household?.id, load]);

  const getMeal = (date: string, type: MealType) =>
    meals.find(m => m.date === date && m.meal_type === type);

  const openAdd = (date: string, type: MealType) => {
    const existing = getMeal(date, type);
    setEditDate(date);
    setEditMealType(type);
    setEditTitle(existing?.title ?? '');
    setEditDesc(existing?.description ?? '');
    setShowModal(true);
  };

  const save = async () => {
    if (!editTitle.trim() || !household?.id || !myMember?.id) return;
    const existing = getMeal(editDate, editMealType);
    if (existing) {
      await supabase.from('meal_plans').update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      }).eq('id', existing.id);
    } else {
      await supabase.from('meal_plans').insert({
        household_id: household.id,
        date: editDate,
        meal_type: editMealType,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        created_by: myMember.id,
      });
    }
    setShowModal(false);
    load();
  };

  const generateShoppingList = async () => {
    if (!household?.id || !myMember?.id) return;
    const weekMeals = meals.filter(m => m.title);
    if (weekMeals.length === 0) {
      Alert.alert('Aucun repas', 'Planifie d\'abord des repas pour générer la liste.');
      return;
    }
    const items = weekMeals.map(m => m.title);
    const uniqueItems = [...new Set(items)];
    const inserts = uniqueItems.map(name => ({
      household_id: household.id,
      added_by: myMember.id,
      name: `🍽️ ${name}`,
      category: 'food',
      checked: false,
    }));
    await supabase.from('shopping_items').insert(inserts);
    Alert.alert('✅ Liste créée', `${uniqueItems.length} éléments ajoutés aux courses !`);
  };

  const deleteMeal = (id: string) => {
    Alert.alert('Supprimer', 'Retirer ce repas du planning ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('meal_plans').delete().eq('id', id);
        load();
      }},
    ]);
  };

  const todayStr = dayjs().format('YYYY-MM-DD');

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)}>
        <LinearGradient colors={['rgba(255,140,0,0.10)', 'rgba(245,166,35,0.04)', 'transparent']}
          style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>
              🍽️ Repas
            </Text>
            <Pressable onPress={generateShoppingList}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: C.amberSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
                borderWidth: 1, borderColor: C.amberBorder }}>
              <Text style={{ fontSize: 12 }}>🛒</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber }}>→ Courses</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Week Nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, marginBottom: 12 }}>
        <Pressable onPress={() => setWeekOffset(w => w - 1)}
          style={{ padding: 8, backgroundColor: C.bgSurface, borderRadius: 10 }}>
          <Text style={{ color: C.amber, fontSize: 16 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setWeekOffset(0)}>
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>{weekLabel}</Text>
        </Pressable>
        <Pressable onPress={() => setWeekOffset(w => w + 1)}
          style={{ padding: 8, backgroundColor: C.bgSurface, borderRadius: 10 }}>
          <Text style={{ color: C.amber, fontSize: 16 }}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}>
        {weekDays.map((day, di) => {
          const dateStr = day.format('YYYY-MM-DD');
          const isToday = dateStr === todayStr;
          const dayMeals = meals.filter(m => m.date === dateStr);

          return (
            <Animated.View key={dateStr} entering={FadeInUp.duration(350).delay(di * 50)}
              style={{
                marginBottom: 12, borderRadius: 18, overflow: 'hidden',
                backgroundColor: C.bgSurface, borderWidth: 1.5,
                borderColor: isToday ? C.amber + '44' : C.border,
              }}>
              {/* Day header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 10,
                backgroundColor: isToday ? 'rgba(245,166,35,0.08)' : 'transparent',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isToday ? C.amber + '22' : C.bgElevated,
                  }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold',
                      color: isToday ? C.amber : C.textMuted }}>{day.format('DD')}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold',
                    color: isToday ? C.amber : C.textPrimary }}>
                    {day.format('dddd')}
                  </Text>
                </View>
                {isToday && (
                  <View style={{ backgroundColor: C.amber + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: C.amber }}>Aujourd'hui</Text>
                  </View>
                )}
              </View>

              {/* Meal slots */}
              <View style={{ paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}>
                {MEALS.map(slot => {
                  const meal = getMeal(dateStr, slot.type);
                  return (
                    <Pressable key={slot.type}
                      onPress={() => openAdd(dateStr, slot.type)}
                      onLongPress={() => meal && deleteMeal(meal.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                        paddingHorizontal: 10, borderRadius: 12,
                        backgroundColor: meal ? slot.color + '10' : 'transparent',
                        borderWidth: 1, borderColor: meal ? slot.color + '22' : C.border,
                      }}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>{slot.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Medium', color: slot.color, marginBottom: 1 }}>
                          {slot.label}
                        </Text>
                        {meal ? (
                          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.textPrimary }}>
                            {meal.title}
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMuted }}>
                            Tap pour ajouter...
                          </Text>
                        )}
                      </View>
                      {meal && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: slot.color + '66' }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Animated.View entering={FadeInDown.duration(300)}
            style={{ backgroundColor: C.bgSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: 24, paddingBottom: 40 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
              backgroundColor: C.border, marginBottom: 16 }} />

            <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.textPrimary, marginBottom: 4 }}>
              {MEALS.find(m => m.type === editMealType)?.emoji}{' '}
              {MEALS.find(m => m.type === editMealType)?.label}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMuted, marginBottom: 16 }}>
              {dayjs(editDate).format('dddd D MMMM')}
            </Text>

            <TextInput
              value={editTitle} onChangeText={setEditTitle}
              placeholder="Nom du plat..." placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.bgElevated, borderRadius: 14, padding: 14, fontSize: 15,
                fontFamily: 'DMSans-Medium', color: C.textPrimary, borderWidth: 1, borderColor: C.border, marginBottom: 10 }}
            />

            {/* Quick ideas */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              {QUICK_IDEAS[editMealType].map(idea => (
                <Pressable key={idea} onPress={() => setEditTitle(idea)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
                    backgroundColor: editTitle === idea ? C.amberSoft : C.bgElevated,
                    borderWidth: 1, borderColor: editTitle === idea ? C.amberBorder : C.border }}>
                  <Text style={{ fontSize: 12, fontFamily: 'DMSans-Medium',
                    color: editTitle === idea ? C.amber : C.textSecondary }}>{idea}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              value={editDesc} onChangeText={setEditDesc}
              placeholder="Notes (optionnel)..." placeholderTextColor={C.textMuted}
              multiline numberOfLines={2}
              style={{ backgroundColor: C.bgElevated, borderRadius: 14, padding: 14, fontSize: 13,
                fontFamily: 'DMSans-Regular', color: C.textPrimary, borderWidth: 1, borderColor: C.border,
                height: 60, textAlignVertical: 'top', marginBottom: 16 }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  backgroundColor: C.bgElevated }}>
                <Text style={{ fontFamily: 'DMSans-Medium', color: C.textMuted }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={save}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  backgroundColor: C.amber }}>
                <Text style={{ fontFamily: 'Nunito-Bold', color: C.bgDeep }}>Enregistrer</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};
