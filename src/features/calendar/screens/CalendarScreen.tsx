import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import { useCalendarData } from '../hooks/useCalendarData';
import { useCalendarStore } from '../store/calendarStore';

import type { CalendarEvent, EventCategory, FoodItem, ExpiryStatus } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// Category config for event display
const EVT_CAT: Record<string, { emoji: string; label: string; color: string }> = {
  birthday: { emoji: '🎂', label: 'Anniversaire', color: '#FF6B6B' },
  work: { emoji: '💼', label: 'Travail', color: '#4ECDC4' },
  health: { emoji: '🏥', label: 'Santé', color: '#34D399' },
  family: { emoji: '👨‍👩‍👧', label: 'Famille', color: '#A78BFA' },
  sport: { emoji: '🏃', label: 'Sport', color: '#FFA07A' },
  other: { emoji: '⭐', label: 'Autre', color: '#FFB347' },
};

// ─── Palette chaude / chocolat (d'après le mockup) ──────
const COLORS = {
  bg: '#2C1810',
  bgLight: '#3D2418',
  bgCard: '#4A2E1E',
  bgCardBorder: 'rgba(255,200,130,0.12)',
  accent: '#FFB347',
  accentSoft: 'rgba(255,179,71,0.15)',
  cream: '#FFF5E6',
  creamSoft: 'rgba(255,245,230,0.7)',
  creamMuted: 'rgba(255,245,230,0.35)',
  green: '#5CB85C',
  greenSoft: 'rgba(92,184,92,0.15)',
  red: '#E74C3C',
  redSoft: 'rgba(231,76,60,0.15)',
  blue: '#5DADE2',
  purple: '#9B59B6',
  orange: '#F39C12',
  pink: '#E91E63',
  teal: '#1ABC9C',
  yellow: '#F1C40F',
};

// Food category config
const FOOD_CAT: Record<string, { emoji: string; color: string }> = {
  dairy: { emoji: '🥛', color: '#87CEEB' },
  meat: { emoji: '🥩', color: '#FF6B6B' },
  vegetables: { emoji: '🥦', color: '#34D399' },
  fruits: { emoji: '🍎', color: '#FFA07A' },
  frozen: { emoji: '❄️', color: '#4ECDC4' },
  dry: { emoji: '🌾', color: '#F5A623' },
  other: { emoji: '📦', color: 'rgba(255,255,255,0.45)' },
};

const getExpiry = (d: string): ExpiryStatus => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(d); exp.setHours(0, 0, 0, 0);
  const diff = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 2) return 'urgent';
  if (diff <= 5) return 'warning';
  return 'ok';
};

const getExpiryDays = (d: string): number => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(d); exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / 86400000);
};

const expiryColor = (s: ExpiryStatus) =>
  s === 'expired' ? '#FF4444' : s === 'urgent' ? '#FF8C00' : s === 'warning' ? '#F5A623' : '#34D399';

const DAYS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ─── Helper: get calendar grid ──────────────────────────
function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];

  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  return grid;
}

// ─── Day cell component ─────────────────────────────────
const DayCell: React.FC<{
  day: number | null;
  dateString: string;
  isToday: boolean;
  isSelected: boolean;
  dots: Array<{ color: string }>;
  hasCompleted: boolean;
  onPress: (date: string) => void;
}> = React.memo(({ day, dateString, isToday, isSelected, dots, hasCompleted, onPress }) => {
  if (day === null) return <View style={styles.dayCell} />;

  return (
    <Pressable
      onPress={() => onPress(dateString)}
      style={[
        styles.dayCell,
        isSelected && { backgroundColor: COLORS.accent, borderRadius: 10 },
        isToday && !isSelected && { backgroundColor: COLORS.accentSoft, borderRadius: 10 },
      ]}
    >
      <Text style={[
        styles.dayText,
        { color: isSelected ? COLORS.bg : COLORS.cream },
        isToday && !isSelected && { color: COLORS.accent, fontFamily: 'Nunito-Bold' },
      ]}>
        {day}
      </Text>
      {/* Dots row */}
      {dots.length > 0 && (
        <View style={styles.dotsRow}>
          {dots.slice(0, 5).map((d, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: d.color }]} />
          ))}
        </View>
      )}
      {/* Green checkmark */}
      {hasCompleted && (
        <Text style={styles.checkMark}>{'\u2713'}</Text>
      )}
    </Pressable>
  );
});

// ─── Section Header ─────────────────────────────────────
const SectionHeader: React.FC<{ title: string; emoji: string; count?: number }> = ({ title, emoji, count }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionEmoji}>{emoji}</Text>
    {count !== undefined && (
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    )}
  </View>
);

// ═══════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════
export const CalendarScreen: React.FC = () => {
  const household = useAuthStore((s) => s.household);
  const members = useAuthStore((s) => s.members);
  const user = useAuthStore((s) => s.user);
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate);
  const calStore = useCalendarStore();

  // Food items — fetch non-consumed items for calendar dots
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const loadFood = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('food_items').select('*')
      .eq('household_id', household.id).is('consumed_at', null)
      .order('expiry_date', { ascending: true });
    setFoodItems((data ?? []) as FoodItem[]);
  }, [household?.id]);

  useEffect(() => { loadFood(); }, [loadFood]);
  useFocusEffect(useCallback(() => { loadFood(); }, [loadFood]));

  const { dayData, markedDates, selectedDate } = useCalendarData(members, foodItems);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Load data for current month
  useEffect(() => {
    if (household?.id) {
      calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
    }
  }, [household?.id, viewYear, viewMonth]);

  // Refetch when screen comes into focus (e.g. after creating events on another tab)
  useFocusEffect(
    useCallback(() => {
      if (household?.id) {
        calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
      }
    }, [household?.id, viewYear, viewMonth]),
  );

  // Realtime subscription
  useEffect(() => {
    if (!household?.id) return;
    return calStore.subscribeRealtime(household.id);
  }, [household?.id]);

  const foodStats = useMemo(() => {
    const r = { expired: 0, urgent: 0, warning: 0, ok: 0 };
    foodItems.forEach(f => { r[getExpiry(f.expiry_date)]++; });
    return r;
  }, [foodItems]);

  const todayStr = useMemo(
    () =>
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [],
  );

  const grid = useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToPrev = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const goToNext = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  const onDayPress = useCallback((dateString: string) => {
    setSelectedDate(dateString);
  }, [setSelectedDate]);

  // Toggle task complete from calendar
  const toggleTask = useCallback(async (taskId: string, done: boolean) => {
    const myMember = members.find(m => m.user_id === user?.id);
    const myMemberId = myMember?.id ?? null;
    // Optimistic update via store
    const updatedTasks = calStore.tasks.map(t =>
      t.id === taskId ? { ...t, completed_at: done ? new Date().toISOString() : null, completed_by: done ? myMemberId : null } : t,
    );
    useCalendarStore.setState({ tasks: updatedTasks });
    await supabase.from('tasks').update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? myMemberId : null,
    }).eq('id', taskId);
  }, [calStore.tasks, user?.id, members]);

  // Helper: find member by id (new: member.id) or user_id (old/created_by)
  const findMember = useCallback((id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  }, [members]);
  const memberName = useCallback((uid: string | null) =>
    findMember(uid)?.display_name ?? null,
  [findMember]);
  const memberColor = useCallback((uid: string | null) =>
    findMember(uid)?.color ?? COLORS.accent,
  [findMember]);

  // Member color bar
  const memberInfos = useMemo(
    () => members.map(m => ({ color: m.color, name: m.display_name })).slice(0, 6),
    [members],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <LinearGradient
        colors={[COLORS.bg, COLORS.bgLight, COLORS.bg]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─── */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Text style={styles.householdName}>
            {household?.name ?? 'Mon foyer'}
          </Text>
          {/* Member color bar */}
          {memberInfos.length > 0 && (
            <View style={styles.memberBar}>
              {memberInfos.map((m, i) => (
                <View key={i} style={styles.memberItem}>
                  <View style={[styles.memberDot, { backgroundColor: m.color }]} />
                  <Text style={styles.memberDotName}>{m.name}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ─── Calendar Card ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
          <View style={styles.calCard}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <Pressable onPress={goToPrev} hitSlop={16}>
                <Text style={styles.navArrow}>{'\u25C0'}</Text>
              </Pressable>
              <Text style={styles.monthTitle}>
                {MONTHS_FR[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={goToNext} hitSlop={16}>
                <Text style={styles.navArrow}>{'\u25B6'}</Text>
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {DAYS_HEADER.map((d, i) => (
                <View key={i} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calGrid}>
              {grid.map((day, i) => {
                const dateStr = day
                  ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : '';
                const mark = dateStr ? markedDates[dateStr] : undefined;
                const dots = mark?.dots ?? [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                // Check if all tasks that day are completed
                const hasCompleted = dots.length > 0 && dots.every(d => d.color === '#34D399');

                return (
                  <DayCell
                    key={i}
                    day={day}
                    dateString={dateStr}
                    isToday={isToday}
                    isSelected={isSelected}
                    dots={dots}
                    hasCompleted={hasCompleted}
                    onPress={onDayPress}
                  />
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ─── Événements ─── */}
        <Animated.View entering={FadeInUp.delay(200).duration(600).springify()}>
          <View style={styles.sectionCard}>
            <SectionHeader title="ÉVÉNEMENTS" emoji={'\u{1F4C5}'} count={dayData.events.length} />
            {dayData.events.length === 0 ? (
              <Text style={styles.emptyText}>Aucun événement ce jour</Text>
            ) : (
              dayData.events.map((ev) => {
                const time = ev.is_all_day
                  ? 'Journée'
                  : new Date(ev.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const cat = (ev.category ?? 'other') as string;
                const catCfg = EVT_CAT[cat] ?? EVT_CAT.other;
                const catColor = catCfg.color;
                const creator = findMember(ev.created_by);
                const assignedIds: string[] = ev.assigned_members ?? [];
                const assigned = assignedIds.length > 0
                  ? assignedIds.map(id => findMember(id)).filter(Boolean) as NonNullable<ReturnType<typeof findMember>>[]
                  : null;
                const displayMembers = assigned && assigned.length > 0 ? assigned : (creator ? [creator] : []);
                return (
                  <View key={ev.id} style={{
                    backgroundColor: COLORS.bgCard,
                    borderRadius: 14, padding: 12, marginBottom: 8,
                    borderWidth: 1, borderColor: COLORS.bgCardBorder,
                    borderLeftWidth: 3, borderLeftColor: catColor,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{
                        backgroundColor: catColor + '22',
                        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                      }}>
                        <Text style={{ fontSize: 9 }}>{catCfg.emoji}</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'DMSans-Medium', color: catColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {catCfg.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: COLORS.accent }}>
                        {time}
                      </Text>
                      {ev.end_at && !ev.is_all_day && (
                        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: COLORS.creamMuted }}>
                          → {new Date(ev.end_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: 'DMSans-Medium', color: COLORS.cream }} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    {(ev.location || displayMembers.length > 0) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                        {ev.location ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={{ fontSize: 10 }}>📍</Text>
                            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: COLORS.creamMuted }} numberOfLines={1}>
                              {ev.location}
                            </Text>
                          </View>
                        ) : null}
                        {displayMembers.length > 0 && (
                          <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {displayMembers.map(mem => (
                              <View key={mem.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mem.color ?? COLORS.accent }} />
                                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: mem.color ?? COLORS.creamMuted }}>
                                  {mem.display_name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* ─── Tâches ─── */}
        <Animated.View entering={FadeInUp.delay(300).duration(600).springify()}>
          <View style={styles.sectionCard}>
            <SectionHeader title="TÂCHES" emoji={'\u2705'} count={dayData.tasks.length} />
            {dayData.tasks.length === 0 ? (
              <Text style={styles.emptyText}>Aucune tâche ce jour</Text>
            ) : (
              dayData.tasks.map((task) => {
                const isDone = !!task.completed_at;
                const person = findMember(task.assigned_to) ?? (task.created_by ? members.find(m => m.user_id === task.created_by) ?? null : null);
                const assignee = person?.display_name ?? null;
                const aColor = person?.color ?? COLORS.accent;
                const pc = task.priority === 'high' ? COLORS.red : task.priority === 'low' ? COLORS.green : COLORS.accent;
                return (
                  <Pressable key={task.id} onPress={() => toggleTask(task.id, !isDone)} style={styles.taskRow}>
                    <View style={[
                      styles.taskCheckbox,
                      isDone && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
                    ]}>
                      {isDone && <Text style={styles.taskCheck}>{'\u2713'}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.taskTitle,
                        isDone && { textDecorationLine: 'line-through', color: COLORS.creamMuted },
                      ]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      {assignee ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: aColor }} />
                          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: aColor }}>
                            {task.assigned_to ? assignee : `par ${assignee}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: pc, marginLeft: 8 }} />
                    {task.priority === 'high' && (
                      <Text style={styles.priorityBadge}>{'\u{1F525}'}</Text>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* ─── Aliments ─── */}
        <Animated.View entering={FadeInUp.delay(400).duration(600).springify()}>
          <View style={[styles.sectionCard, { marginBottom: 100 }]}>
            <SectionHeader title="ALIMENTS" emoji={'\u{1F951}'} count={foodItems.length} />
            {foodItems.length === 0 ? (
              <Text style={styles.emptyText}>Aucun aliment suivi</Text>
            ) : (
              <>
                {/* Quick stats row */}
                {(foodStats.expired > 0 || foodStats.urgent > 0) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {foodStats.expired > 0 && (
                      <View style={{
                        backgroundColor: 'rgba(255,68,68,0.12)', borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4,
                        borderWidth: 1, borderColor: 'rgba(255,68,68,0.25)',
                      }}>
                        <Text style={{ fontSize: 10 }}>🔴</Text>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#FF4444' }}>
                          {foodStats.expired} expiré{foodStats.expired > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                    {foodStats.urgent > 0 && (
                      <View style={{
                        backgroundColor: 'rgba(255,140,0,0.12)', borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4,
                        borderWidth: 1, borderColor: 'rgba(255,140,0,0.25)',
                      }}>
                        <Text style={{ fontSize: 10 }}>🟠</Text>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#FF8C00' }}>
                          {foodStats.urgent} urgent{foodStats.urgent > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {/* Food items list (max 5 shown on home) */}
                {foodItems.slice(0, 5).map(item => {
                  const st = getExpiry(item.expiry_date);
                  const days = getExpiryDays(item.expiry_date);
                  const col = expiryColor(st);
                  const cat = FOOD_CAT[item.category] ?? FOOD_CAT.other;
                  return (
                    <View key={item.id} style={{
                      flexDirection: 'row', alignItems: 'center', marginBottom: 6,
                      backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 10,
                      borderWidth: 1, borderColor: COLORS.bgCardBorder,
                      borderLeftWidth: 3, borderLeftColor: col,
                    }}>
                      <Text style={{ fontSize: 20, marginRight: 10 }}>{cat.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{
                          fontFamily: 'DMSans-Medium', fontSize: 14, color: COLORS.cream,
                        }}>{item.name}</Text>
                        {item.quantity ? (
                          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: COLORS.creamMuted }}>
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{
                        backgroundColor: col + '22', borderRadius: 10,
                        paddingHorizontal: 8, paddingVertical: 3,
                        borderWidth: 1, borderColor: col + '44',
                      }}>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: col }}>
                          {days < 0 ? `Expiré` : days === 0 ? "Auj." : `${days}j`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {foodItems.length > 5 && (
                  <Text style={{
                    fontFamily: 'DMSans-Regular', fontSize: 12, color: COLORS.accent,
                    textAlign: 'center', marginTop: 6,
                  }}>
                    +{foodItems.length - 5} autre{foodItems.length - 5 > 1 ? 's' : ''} produit{foodItems.length - 5 > 1 ? 's' : ''}
                  </Text>
                )}
              </>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 20 },

  // Header
  header: { marginBottom: 16, alignItems: 'center' },
  householdName: {
    fontFamily: 'Nunito-Bold', fontSize: 26, color: COLORS.cream,
    letterSpacing: -0.5, textAlign: 'center',
  },
  memberBar: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' },
  memberItem: { alignItems: 'center', gap: 3 },
  memberDot: { width: 10, height: 10, borderRadius: 5 },
  memberDotName: { fontFamily: 'DMSans-Regular', fontSize: 11, color: COLORS.creamMuted },

  // Calendar card
  calCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder,
    padding: 16, marginBottom: 14,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontFamily: 'Nunito-Bold', fontSize: 20, color: COLORS.accent,
    letterSpacing: 0.5,
  },
  navArrow: { fontSize: 14, color: COLORS.creamSoft, padding: 4 },

  // Day headers
  dayHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: {
    fontFamily: 'DMSans-Medium', fontSize: 13, color: COLORS.accent,
    letterSpacing: 1,
  },

  // Grid
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    flex: 0, width: '14.28%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  dayText: {
    fontFamily: 'DMSans-Regular', fontSize: 15, color: COLORS.cream,
  },
  dotsRow: {
    flexDirection: 'row', gap: 2, position: 'absolute', bottom: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  checkMark: {
    position: 'absolute', top: 0, right: 2,
    fontSize: 10, color: COLORS.green, fontWeight: '700',
  },

  // Section cards
  sectionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder,
    padding: 16, marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Nunito-Bold', fontSize: 16, color: COLORS.accent,
    letterSpacing: 1.5,
  },
  sectionEmoji: { fontSize: 16 },
  countBadge: {
    backgroundColor: COLORS.accentSoft, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto',
  },
  countText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: COLORS.accent },

  emptyText: {
    fontFamily: 'DMSans-Regular', fontSize: 14, color: COLORS.creamMuted,
    textAlign: 'center', paddingVertical: 16,
  },

  // Event rows
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,200,130,0.06)',
  },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTime: {
    fontFamily: 'DMSans-Medium', fontSize: 13, color: COLORS.creamSoft,
    width: 50,
  },
  eventTitle: {
    fontFamily: 'DMSans-Regular', fontSize: 15, color: COLORS.cream, flex: 1,
  },

  // Task rows
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,200,130,0.06)',
  },
  taskCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.creamMuted, alignItems: 'center', justifyContent: 'center',
  },
  taskCheck: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  taskTitle: {
    fontFamily: 'DMSans-Regular', fontSize: 15, color: COLORS.cream, flex: 1,
  },
  priorityBadge: { fontSize: 14 },
});
