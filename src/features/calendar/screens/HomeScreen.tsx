import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Dimensions, StatusBar, Platform,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, FadeOut,
  useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat,
  withSequence, withDelay, interpolate, Easing, runOnJS,
  SlideInRight, SlideOutLeft,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Circle, Line as SkLine, vec, RoundedRect, Path,
} from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import { useCalendarData } from '../hooks/useCalendarData';
import { useCalendarStore } from '../store/calendarStore';
import type { CalendarEvent, EventCategory, FoodItem, ExpiryStatus, Task } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:      '#1A0E00',
  bgMid:       '#261400',
  bgSurface:   '#2E1A00',
  bgElevated:  '#3A2200',
  amber:       '#F5A623',
  amberSoft:   'rgba(245,166,35,0.15)',
  amberGlow:   'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted:   'rgba(255,255,255,0.32)',
  green:       '#34D399',
  red:         '#FF6B6B',
  orange:      '#FF8C00',
  teal:        '#4ECDC4',
  purple:      '#A78BFA',
  pink:        '#FFA07A',
};

const EVT_CAT: Record<string, { emoji: string; label: string; color: string }> = {
  birthday: { emoji: '🎂', label: 'Anniversaire', color: C.red },
  work:     { emoji: '💼', label: 'Travail', color: C.teal },
  health:   { emoji: '🏥', label: 'Santé', color: C.green },
  family:   { emoji: '👨‍👩‍👧', label: 'Famille', color: C.purple },
  sport:    { emoji: '🏃', label: 'Sport', color: C.pink },
  other:    { emoji: '⭐', label: 'Autre', color: C.amber },
};

const FOOD_CAT: Record<string, { emoji: string; color: string }> = {
  dairy: { emoji: '🥛', color: '#87CEEB' },
  meat: { emoji: '🥩', color: C.red },
  vegetables: { emoji: '🥦', color: C.green },
  fruits: { emoji: '🍎', color: C.pink },
  frozen: { emoji: '❄️', color: C.teal },
  dry: { emoji: '🌾', color: C.amber },
  other: { emoji: '📦', color: 'rgba(255,255,255,0.45)' },
};

const DAYS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

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
  s === 'expired' ? '#FF4444' : s === 'urgent' ? C.orange : s === 'warning' ? C.amber : C.green;

const dlcBorderColor = (s: ExpiryStatus) =>
  s === 'expired' ? 'rgba(255,68,68,0.35)' : s === 'urgent' ? 'rgba(255,140,0,0.35)'
  : s === 'warning' ? 'rgba(245,166,35,0.25)' : 'rgba(52,211,153,0.22)';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return '🌅 Bonjour ! Bonne journée à vous';
  if (h >= 12 && h < 18) return '☀️ Bon après-midi !';
  if (h >= 18 && h < 22) return '🌙 Bonsoir !';
  return '🌙 Bonne nuit !';
};

const priorityColor = (p: string) =>
  p === 'high' ? C.red : p === 'low' ? C.green : C.amber;

// ═══════════════════════════════════════════════════════════
// DAY CELL
// ═══════════════════════════════════════════════════════════
const DayCell: React.FC<{
  day: number | null;
  dateString: string;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  dots: Array<{ color: string }>;
  hasTasks: boolean;
  onPress: (d: string) => void;
}> = React.memo(({ day, dateString, isToday, isSelected, isWeekend, dots, hasTasks, onPress }) => {
  if (day === null) return <View style={{ width: '14.28%' as unknown as number, height: 44 }} />;

  return (
    <Pressable
      onPress={() => onPress(dateString)}
      style={{
        width: '14.28%' as unknown as number, height: 44,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 12,
        borderWidth: isToday && !isSelected ? 1.5 : 0,
        borderColor: 'rgba(245,166,35,0.6)',
        backgroundColor: isSelected ? C.amber : 'transparent',
        ...(isSelected ? {
          shadowColor: C.amber, shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
        } : {}),
      }}
    >
      <Text style={{
        fontFamily: isToday || isSelected ? 'Nunito-Bold' : 'DMSans-Regular',
        fontSize: 15,
        color: isSelected ? C.bgDeep
          : isToday ? C.amber
          : isWeekend ? 'rgba(245,166,35,0.55)'
          : 'rgba(255,255,255,0.80)',
      }}>{day}</Text>

      {/* Event dots */}
      {dots.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, position: 'absolute', bottom: 3 }}>
          {dots.slice(0, 3).map((d, i) => (
            <View key={i} style={{
              width: 4, height: 4, borderRadius: 2,
              backgroundColor: isSelected ? 'rgba(26,14,0,0.5)' : d.color,
            }} />
          ))}
        </View>
      )}

      {/* Task indicator */}
      {hasTasks && !isSelected && (
        <View style={{
          position: 'absolute', top: 4, right: 4,
          width: 5, height: 5, borderRadius: 1.5,
          backgroundColor: 'rgba(245,166,35,0.7)',
        }} />
      )}
    </Pressable>
  );
});

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const household = useAuthStore(s => s.household);
  const members = useAuthStore(s => s.members);
  const user = useAuthStore(s => s.user);
  const { dayData, markedDates, selectedDate } = useCalendarData(members);
  const setSelectedDate = useCalendarStore(s => s.setSelectedDate);
  const calStore = useCalendarStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [showPanel, setShowPanel] = useState(false);
  const [panelPage, setPanelPage] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const scrollY = useSharedValue(0);

  const todayStr = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [],
  );

  // ─── Data loading ──────────────────────────────────────
  useEffect(() => {
    if (household?.id) calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
  }, [household?.id, viewYear, viewMonth]);

  useFocusEffect(useCallback(() => {
    if (household?.id) calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
  }, [household?.id, viewYear, viewMonth]));

  useEffect(() => {
    if (!household?.id) return;
    return calStore.subscribeRealtime(household.id);
  }, [household?.id]);

  // Food items
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const loadFood = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('food_items').select('*')
      .eq('household_id', household.id).is('consumed_at', null)
      .order('expiry_date', { ascending: true }).limit(10);
    setFoodItems((data ?? []) as FoodItem[]);
  }, [household?.id]);

  useEffect(() => { loadFood(); }, [loadFood]);
  useFocusEffect(useCallback(() => { loadFood(); }, [loadFood]));

  // Food realtime
  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('food_items', household.id, () => loadFood());
  }, [household?.id, loadFood]);

  const foodStats = useMemo(() => {
    const r = { expired: 0, urgent: 0, warning: 0, ok: 0 };
    foodItems.forEach(f => { r[getExpiry(f.expiry_date)]++; });
    return r;
  }, [foodItems]);

  // ─── Calendar helpers ──────────────────────────────────
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
    if (dateString === selectedDate && showPanel) {
      setShowPanel(false);
    } else {
      setSelectedDate(dateString);
      setShowPanel(true);
      setPanelPage(0);
    }
  }, [selectedDate, showPanel, setSelectedDate]);

  // ─── Task toggle ───────────────────────────────────────
  const toggleTask = useCallback(async (taskId: string, done: boolean) => {
    const myMember = members.find(m => m.user_id === user?.id);
    const myMemberId = myMember?.id ?? null;
    const updatedTasks = calStore.tasks.map(t =>
      t.id === taskId ? { ...t, completed_at: done ? new Date().toISOString() : null, completed_by: done ? myMemberId : null } : t,
    );
    useCalendarStore.setState({ tasks: updatedTasks });
    await supabase.from('tasks').update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? myMemberId : null,
    }).eq('id', taskId);
  }, [calStore.tasks, user?.id, members]);

  // ─── Member helpers ────────────────────────────────────
  const findMember = useCallback((id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  }, [members]);

  // ─── Events for selected day ─────────────
  const upcomingEvents = useMemo(() => {
    const dayStart = selectedDate + 'T00:00:00';
    const dayEnd = selectedDate + 'T23:59:59';
    return calStore.events
      .filter(e => {
        // Event overlaps with selected day
        const start = e.start_at;
        const end = e.end_at || e.start_at;
        return start <= dayEnd && end >= dayStart;
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [calStore.events, selectedDate]);

  // ─── Tasks for selected day + overdue tasks (missed) ────
  const selectedDayTasks = useMemo(() => {
    // Tasks due on selected day
    const dayTasks = calStore.tasks
      .filter(t => t.due_date === selectedDate)
      .map(t => ({ ...t, _missed: false }));
    // Overdue tasks: due before selected date AND not completed — show as "manquée"
    const overdue = calStore.tasks
      .filter(t => !t.completed_at && t.due_date < selectedDate)
      .map(t => ({ ...t, _missed: true }));
    // Merge: pending first, then missed, then completed
    return [...dayTasks, ...overdue].sort((a, b) => {
      // Completed last
      if (!a.completed_at && b.completed_at) return -1;
      if (a.completed_at && !b.completed_at) return 1;
      // Missed after normal pending
      if (!a._missed && b._missed) return -1;
      if (a._missed && !b._missed) return 1;
      return 0;
    });
  }, [calStore.tasks, selectedDate]);

  // ─── Sticky header animation ──────────────────────────
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 80], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [40, 80], [-10, 0], 'clamp') }],
  }));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, [scrollY]);

  // ─── FAB animations ───────────────────────────────────
  const fabPulse = useSharedValue(0);
  useEffect(() => {
    fabPulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, true,
    );
    return () => { fabPulse.value = 0; };
  }, [fabPulse]);
  const fabGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(fabPulse.value, [0, 1], [0.45, 0.75]),
  }));

  // ─── Panel date label ─────────────────────────────────
  const panelDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(selectedDate + 'T12:00:00');
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()].toLowerCase()}`;
  }, [selectedDate]);

  // ─── Has tasks for date ────────────────────────────────
  const taskDates = useMemo(() => {
    const s = new Set<string>();
    calStore.tasks.forEach(t => { if (!t.completed_at) s.add(t.due_date); });
    return s;
  }, [calStore.tasks]);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* ══════ STICKY COMPACT HEADER ══════ */}
      <Animated.View style={[headerOpacity, {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        height: insets.top + 50,
        backgroundColor: C.bgDeep,
        borderBottomWidth: 1, borderBottomColor: 'rgba(245,166,35,0.15)',
        alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8,
      }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: C.textPrimary }}>
            {household?.name ?? 'Mon foyer'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {members.slice(0, 4).map((m, i) => (
              <View key={i} style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: m.color || C.amber,
              }} />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* ══════ MAIN SCROLL ══════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ══════ 1. HEADER FOYER ══════ */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={['rgba(245,166,35,0.08)', 'transparent']}
            style={{
              paddingTop: insets.top + 8, paddingBottom: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontFamily: 'Nunito-Bold', fontSize: 26, color: C.textPrimary,
              letterSpacing: -0.5, textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 0 },
            }}>
              {household?.name ?? 'Mon foyer'}
            </Text>

            {/* Members pills */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: 20 }}>
              {members.map((m, i) => {
                const mc = m.color || C.amber;
                return (
                  <View key={m.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: mc + '1F',
                    borderWidth: 1, borderColor: mc + '4D',
                  }}>
                    {/* Avatar circle */}
                    <View style={{ position: 'relative' }}>
                      <View style={{
                        width: 26, height: 26, borderRadius: 9,
                        backgroundColor: mc + '40',
                        borderWidth: 1.5, borderColor: mc,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 12 }}>{m.avatar_emoji || m.display_name.charAt(0)}</Text>
                      </View>
                      {/* Online dot */}
                      <View style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 7, height: 7, borderRadius: 3.5,
                        backgroundColor: C.green,
                        borderWidth: 1.5, borderColor: C.bgDeep,
                      }} />
                    </View>
                    <Text style={{
                      fontFamily: 'DMSans-Medium', fontSize: 13,
                      color: 'rgba(255,255,255,0.75)',
                    }}>{m.display_name}</Text>
                  </View>
                );
              })}
            </View>

            {/* Greeting */}
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 12,
              color: 'rgba(255,255,255,0.35)', textAlign: 'center',
              marginTop: 6,
            }}>{greeting()}</Text>
          </LinearGradient>
        </Animated.View>

        {/* ══════ 2. CALENDAR ══════ */}
        <Animated.View entering={FadeInUp.delay(100).duration(500).springify()}
          style={{ marginHorizontal: 16, marginBottom: 10 }}
        >
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 24, borderWidth: 1,
            borderColor: 'rgba(245,166,35,0.20)', overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
          }}>
            {/* Highlight line */}
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.40)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1 }}
            />

            {/* Month nav */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 16,
            }}>
              <Pressable onPress={goToPrev} style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: 'rgba(245,166,35,0.10)',
                borderWidth: 1, borderColor: C.amberBorder,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: C.amber, fontSize: 14 }}>◀</Text>
              </Pressable>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 18, color: C.amber,
              }}>
                {MONTHS_FR[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={goToNext} style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: 'rgba(245,166,35,0.10)',
                borderWidth: 1, borderColor: C.amberBorder,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: C.amber, fontSize: 14 }}>▶</Text>
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8 }}>
              {DAYS_HEADER.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{
                    fontFamily: 'Nunito-SemiBold', fontSize: 11,
                    letterSpacing: 1,
                    color: i >= 5 ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.35)',
                  }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 12 }}>
              {grid.map((day, i) => {
                const dateStr = day
                  ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : '';
                const mark = dateStr ? markedDates[dateStr] : undefined;
                const dots = mark?.dots ?? [];
                const dayOfWeek = (i % 7);

                return (
                  <DayCell
                    key={i}
                    day={day}
                    dateString={dateStr}
                    isToday={dateStr === todayStr}
                    isSelected={dateStr === selectedDate}
                    isWeekend={dayOfWeek >= 5}
                    dots={dots}
                    hasTasks={dateStr ? taskDates.has(dateStr) : false}
                    onPress={onDayPress}
                  />
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ══════ LÉGENDE COULEURS ══════ */}
        <Animated.View entering={FadeIn.delay(250).duration(400)} style={{
          marginHorizontal: 16, marginTop: 6, marginBottom: 10,
          backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1,
          borderColor: C.amberBorder, padding: 14,
        }}>
          <Text style={{
            fontFamily: 'DMSans-Medium', fontSize: 10, color: 'rgba(245,166,35,0.55)',
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
          }}>Légende</Text>

          {/* Tâches */}
          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 11, color: C.amber,
            marginBottom: 6, letterSpacing: 0.5,
          }}>📋 Tâches</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {members.map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color ?? C.amber }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>
                  {m.display_name}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Terminée</Text>
            </View>
          </View>

          {/* Séparateur */}
          <View style={{ height: 1, backgroundColor: 'rgba(245,166,35,0.10)', marginBottom: 10 }} />

          {/* Aliments */}
          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 11, color: C.amber,
            marginBottom: 6, letterSpacing: 0.5,
          }}>🍎 Aliments (péremption)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4444' }} />
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Expiré</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8C00' }} />
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Urgent (≤2j)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F5A623' }} />
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Bientôt (≤5j)</Text>
            </View>
          </View>

          {/* Séparateur */}
          <View style={{ height: 1, backgroundColor: 'rgba(245,166,35,0.10)', marginBottom: 10 }} />

          {/* Événements */}
          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 11, color: C.amber,
            marginBottom: 6, letterSpacing: 0.5,
          }}>📅 Événements</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#A78BFA' }} />
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Événement</Text>
            </View>
          </View>
        </Animated.View>

        {/* ══════ 4. SECTION ÉVÉNEMENTS ══════ */}
        <Animated.View entering={FadeInUp.delay(280).duration(400)}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginHorizontal: 16, marginTop: 10, marginBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Canvas style={{ width: 18, height: 18 }}>
                <RoundedRect x={1} y={0} width={16} height={18} r={3}
                  style="stroke" strokeWidth={1.3} color={C.amber} />
                <SkLine p1={vec(1, 6)} p2={vec(17, 6)}
                  style="stroke" strokeWidth={1} color={C.amber} />
              </Canvas>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 13, color: C.amber,
                letterSpacing: 2, textTransform: 'uppercase',
              }}>Événements</Text>
              {upcomingEvents.length > 0 && (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.5, elevation: 4,
                }}>
                  <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 11, color: C.bgDeep }}>
                    {upcomingEvents.length}
                  </Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => (navigation as any).navigate('More', { screen: 'Events' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.6)' }}>
                  Voir tout
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(245,166,35,0.5)' }}>›</Text>
              </View>
            </Pressable>
          </View>

          {/* Event cards */}
          {upcomingEvents.length === 0 ? (
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1,
              borderColor: 'rgba(245,166,35,0.15)', marginHorizontal: 16, marginBottom: 8,
              padding: 24, alignItems: 'center',
            }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>
                Aucun événement cette semaine
              </Text>
            </View>
          ) : (
            upcomingEvents.map((ev, idx) => {
              const cat = (ev.category ?? 'other') as string;
              const catCfg = EVT_CAT[cat] ?? EVT_CAT.other;
              const creator = findMember(ev.created_by);
              const assignedIds: string[] = (ev as any).assigned_members ?? [];
              const assigned = assignedIds.length > 0
                ? assignedIds.map(id => findMember(id)).filter(Boolean)
                : null;
              const displayMembers = assigned && assigned.length > 0 ? assigned : (creator ? [creator] : []);
              const time = ev.is_all_day ? 'Journée'
                : new Date(ev.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const endTime = ev.end_at && !ev.is_all_day
                ? new Date(ev.end_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <Animated.View key={ev.id}
                  entering={FadeInUp.delay(360 + idx * 60).duration(350)}
                >
                  <View style={{
                    backgroundColor: C.bgSurface, borderRadius: 18,
                    borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
                    marginHorizontal: 16, marginBottom: 8, overflow: 'hidden',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.30, shadowRadius: 12, elevation: 6,
                  }}>
                    {/* Highlight line */}
                    <LinearGradient
                      colors={['transparent', 'rgba(245,166,35,0.28)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 1 }}
                    />
                    {/* Left edge bar */}
                    <View style={{
                      position: 'absolute', left: 0, top: 10, bottom: 10, width: 3.5,
                      borderRadius: 2, backgroundColor: catCfg.color,
                      shadowColor: catCfg.color, shadowRadius: 8, shadowOpacity: 0.9, elevation: 3,
                    }} />

                    <View style={{ padding: 14, paddingLeft: 18 }}>
                      {/* Row 1: Category badge + time */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <View style={{
                          backgroundColor: catCfg.color + '22',
                          borderWidth: 1, borderColor: catCfg.color + '47',
                          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                          flexDirection: 'row', alignItems: 'center', gap: 3,
                        }}>
                          <Text style={{ fontSize: 10 }}>{catCfg.emoji}</Text>
                          <Text style={{
                            fontFamily: 'DMSans-Medium', fontSize: 10, color: catCfg.color,
                            textTransform: 'uppercase', letterSpacing: 0.8,
                          }}>{catCfg.label}</Text>
                        </View>
                        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 13, color: C.amber }}>
                          {time}
                          {endTime && (
                            <Text style={{ color: 'rgba(245,166,35,0.5)' }}> → </Text>
                          )}
                          {endTime && (
                            <Text>{endTime}</Text>
                          )}
                        </Text>
                      </View>
                      {/* Row 2: Title */}
                      <Text numberOfLines={1} style={{
                        fontFamily: 'Nunito-SemiBold', fontSize: 16, color: C.textPrimary,
                      }}>{ev.title}</Text>
                      {/* Row 3: Location + Member */}
                      {(ev.location || displayMembers.length > 0) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          {ev.location ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Text style={{ fontSize: 10 }}>📍</Text>
                              <Text numberOfLines={1} style={{
                                fontFamily: 'DMSans-Regular', fontSize: 12,
                                color: 'rgba(255,255,255,0.45)',
                              }}>{ev.location}</Text>
                            </View>
                          ) : null}
                          {displayMembers.length > 0 && (
                            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {displayMembers.map((mem: any) => (
                                <View key={mem.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <View style={{
                                    width: 6, height: 6, borderRadius: 3,
                                    backgroundColor: mem.color || C.amber,
                                  }} />
                                  <Text style={{
                                    fontFamily: 'DMSans-Regular', fontSize: 12,
                                    color: mem.color || C.amber,
                                  }}>{mem.display_name}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </Animated.View>

        {/* ══════ 5. SECTION TÂCHES ══════ */}
        <Animated.View entering={FadeInUp.delay(460).duration(400)}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginHorizontal: 16, marginTop: 10, marginBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Canvas style={{ width: 18, height: 18 }}>
                <RoundedRect x={2} y={2} width={14} height={14} r={3}
                  style="stroke" strokeWidth={1.5} color={C.amber} />
                <Path path="M5 9 L8 12 L13 6" style="stroke" strokeWidth={1.5}
                  color={C.amber} strokeCap="round" />
              </Canvas>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 13, color: C.amber,
                letterSpacing: 2, textTransform: 'uppercase',
              }}>Tâches</Text>
              {selectedDayTasks.length > 0 && (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.5, elevation: 4,
                }}>
                  <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 11, color: C.bgDeep }}>
                    {selectedDayTasks.length}
                  </Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => (navigation as any).navigate('Tasks')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.6)' }}>
                  Voir tout
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(245,166,35,0.5)' }}>›</Text>
              </View>
            </Pressable>
          </View>

          {/* Task cards */}
          {selectedDayTasks.length === 0 ? (
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1,
              borderColor: 'rgba(245,166,35,0.14)', marginHorizontal: 16, marginBottom: 8,
              padding: 24, alignItems: 'center',
            }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>
                Aucune tâche ce jour
              </Text>
            </View>
          ) : (
            selectedDayTasks.map((task, idx) => {
              const isDone = !!task.completed_at;
              const isMissed = !!(task as any)._missed;
              const person = findMember(task.assigned_to) ?? findMember(task.created_by);
              const pc = isMissed ? '#FF4444' : priorityColor(task.priority);

              return (
                <Animated.View key={task.id + (isMissed ? '-missed' : '')}
                  entering={FadeInUp.delay(540 + idx * 50).duration(350)}
                >
                  <View style={{
                    backgroundColor: isMissed ? 'rgba(255,68,68,0.06)' : C.bgSurface,
                    borderRadius: 16,
                    borderWidth: 1, borderColor: isMissed ? 'rgba(255,68,68,0.22)' : 'rgba(245,166,35,0.14)',
                    marginHorizontal: 16, marginBottom: 7, overflow: 'hidden',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
                  }}>
                    {/* Highlight */}
                    <LinearGradient
                      colors={isMissed
                        ? ['transparent', 'rgba(255,68,68,0.25)', 'transparent']
                        : ['transparent', 'rgba(245,166,35,0.20)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 1 }}
                    />
                    {/* Priority edge */}
                    <View style={{
                      position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
                      borderRadius: 2, backgroundColor: pc,
                      shadowColor: pc, shadowRadius: 6, shadowOpacity: 0.8, elevation: 2,
                    }} />

                    <Pressable
                      onPress={() => toggleTask(task.id, !isDone)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 18 }}
                    >
                      {/* Checkbox */}
                      <View style={{
                        width: 26, height: 26, borderRadius: 8,
                        borderWidth: 2,
                        borderColor: isDone ? C.green : isMissed ? 'rgba(255,68,68,0.45)' : 'rgba(245,166,35,0.35)',
                        backgroundColor: isDone ? C.green : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isDone && <Text style={{ fontSize: 14, color: '#FFF', fontWeight: '700' }}>✓</Text>}
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text numberOfLines={1} style={{
                            fontFamily: 'Nunito-SemiBold', fontSize: 15,
                            color: isDone ? 'rgba(255,255,255,0.4)' : isMissed ? 'rgba(255,255,255,0.65)' : C.textPrimary,
                            textDecorationLine: isDone ? 'line-through' : 'none',
                            flex: 1,
                          }}>{task.title}</Text>
                          {isMissed && (
                            <View style={{
                              backgroundColor: 'rgba(255,68,68,0.15)',
                              borderWidth: 1, borderColor: 'rgba(255,68,68,0.30)',
                              borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
                            }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 9, color: '#FF6B6B', letterSpacing: 0.5 }}>
                                ⏰ MANQUÉE
                              </Text>
                            </View>
                          )}
                        </View>
                        {person && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: person.color || C.amber }} />
                            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: person.color || C.amber }}>
                              {person.display_name}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Priority indicator */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{
                          width: 3, height: 18, borderRadius: 2,
                          backgroundColor: pc,
                        }} />
                        <Text style={{ fontSize: 16 }}>
                          {task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '🍃'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })
          )}
        </Animated.View>

        {/* ══════ 6. SECTION ALIMENTS ══════ */}
        <Animated.View entering={FadeInUp.delay(620).duration(400)}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginHorizontal: 16, marginTop: 10, marginBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>🥬</Text>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 13, color: C.amber,
                letterSpacing: 2, textTransform: 'uppercase',
              }}>Aliments</Text>
              {foodItems.length > 0 && (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.5, elevation: 4,
                }}>
                  <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 11, color: C.bgDeep }}>
                    {foodItems.length}
                  </Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => (navigation as any).navigate('More', { screen: 'Food' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.6)' }}>
                  Voir tout
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(245,166,35,0.5)' }}>›</Text>
              </View>
            </Pressable>
          </View>

          {/* Quick stats */}
          {(foodStats.expired > 0 || foodStats.urgent > 0) && (
            <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
              {foodStats.expired > 0 && (
                <View style={{
                  backgroundColor: 'rgba(255,68,68,0.12)', borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 4,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
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
                  paddingHorizontal: 10, paddingVertical: 4,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  borderWidth: 1, borderColor: 'rgba(255,140,0,0.25)',
                }}>
                  <Text style={{ fontSize: 10 }}>🟠</Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: C.orange }}>
                    {foodStats.urgent} urgent{foodStats.urgent > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Food item cards */}
          {foodItems.length === 0 ? (
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1,
              borderColor: 'rgba(245,166,35,0.14)', marginHorizontal: 16, marginBottom: 8,
              padding: 24, alignItems: 'center',
            }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>
                Aucun aliment suivi
              </Text>
            </View>
          ) : (
            foodItems.slice(0, 5).map((item, idx) => {
              const st = getExpiry(item.expiry_date);
              const days = getExpiryDays(item.expiry_date);
              const col = expiryColor(st);
              const bCol = dlcBorderColor(st);
              const cat = FOOD_CAT[item.category] ?? FOOD_CAT.other;

              return (
                <Animated.View key={item.id}
                  entering={FadeInUp.delay(700 + idx * 50).duration(300)}
                >
                  <View style={{
                    backgroundColor: C.bgSurface, borderRadius: 16,
                    borderWidth: 1, borderColor: bCol,
                    marginHorizontal: 16, marginBottom: 7, overflow: 'hidden',
                    shadowColor: col, shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
                  }}>
                    {/* Highlight DLC color */}
                    <LinearGradient
                      colors={['transparent', col + '4D', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 1 }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                      {/* Category icon */}
                      <View style={{
                        width: 40, height: 40, borderRadius: 12,
                        backgroundColor: cat.color + '22',
                        borderWidth: 1, borderColor: cat.color + '40',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                      </View>
                      {/* Info */}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={{
                          fontFamily: 'Nunito-SemiBold', fontSize: 15, color: C.textPrimary,
                        }}>{item.name}</Text>
                        {item.quantity ? (
                          <Text style={{
                            fontFamily: 'DMSans-Regular', fontSize: 12,
                            color: 'rgba(255,255,255,0.45)',
                          }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                        ) : null}
                      </View>
                      {/* DLC badge */}
                      <View style={{
                        backgroundColor: col + '26',
                        borderWidth: 1, borderColor: col + '4D',
                        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
                      }}>
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 12, color: col,
                        }}>
                          {days < 0 ? 'Expiré' : days === 0 ? 'Auj.' : `${days}j`}
                          {(st === 'expired' || st === 'urgent') ? ' ⚠️' : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}

          {foodItems.length > 5 && (
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 12, color: C.amber,
              textAlign: 'center', marginBottom: 8,
            }}>
              +{foodItems.length - 5} autre{foodItems.length - 5 > 1 ? 's' : ''} produit{foodItems.length - 5 > 1 ? 's' : ''}
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* ══════ 8. FAB SPEED DIAL ══════ */}
      {/* Backdrop */}
      {fabOpen && (
        <Pressable
          onPress={() => setFabOpen(false)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
          }}
        >
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}
            style={{ flex: 1 }} />
        </Pressable>
      )}

      {/* Speed dial items */}
      {fabOpen && (
        <View style={{
          position: 'absolute', bottom: 160, right: 16, zIndex: 60,
          alignItems: 'flex-end', gap: 10,
        }}>
          {[
            { emoji: '📅', label: 'Événement', tab: 'Events', isMore: true, delay: 0 },
            { emoji: '✅', label: 'Tâche', tab: 'Tasks', isMore: false, delay: 60 },
            { emoji: '🥑', label: 'Aliment', tab: 'Food', isMore: true, delay: 120 },
          ].map((item, i) => (
            <Animated.View key={item.tab}
              entering={FadeInUp.delay(item.delay).duration(250).springify()}
              exiting={FadeOut.duration(100)}
            >
              <Pressable
                onPress={() => {
                  setFabOpen(false);
                  if (item.isMore) {
                    (navigation as any).navigate('More', { screen: item.tab });
                  } else {
                    (navigation as any).navigate(item.tab);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {/* Label */}
                <View style={{
                  backgroundColor: 'rgba(38,20,0,0.92)',
                  borderWidth: 1, borderColor: C.amberBorder,
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
                }}>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                    {item.label}
                  </Text>
                </View>
                {/* Mini FAB */}
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: C.bgElevated,
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Main FAB */}
      <Animated.View
        entering={FadeInUp.delay(700).duration(400).springify()}
        style={[fabGlowStyle, {
          position: 'absolute', bottom: 90, right: 16, zIndex: 60,
        }]}
      >
        <Pressable onPress={() => setFabOpen(prev => !prev)}>
          <LinearGradient
            colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 58, height: 58, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: C.amber,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.55, shadowRadius: 16, elevation: 12,
            }}
          >
            <Text style={{
              fontSize: 28, color: C.bgDeep, fontWeight: '700',
              transform: [{ rotate: fabOpen ? '45deg' : '0deg' }],
            }}>+</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};
