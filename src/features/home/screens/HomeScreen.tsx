import React, {
  useCallback, useState, useMemo, useEffect, useRef,
} from 'react';
import {
  View, Text, ScrollView, Pressable, TouchableOpacity,
  Dimensions, StatusBar, NativeSyntheticEvent, NativeScrollEvent,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, FadeOut,
  useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat,
  withSequence, interpolate, Easing, SlideInDown,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import { useCalendarData } from '@features/calendar/hooks/useCalendarData';
import { useCalendarStore } from '@features/calendar/store/calendarStore';
import { useHomeData } from '../hooks/useHomeData';
import type { FoodItem, Task, CalendarEvent } from '@appTypes/index';
import type { ActiveTimer, PinnedNote, ExpiringDoc } from '../hooks/useHomeData';

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
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted:     'rgba(255,255,255,0.32)',
  member1: '#FF6B6B',
  member2: '#4ECDC4',
  member3: '#A78BFA',
  member4: '#FFA07A',
  success: '#34D399',
  warning: '#FF8C00',
  danger:  '#FF4444',
  gold:    '#FFD700',
  teal:    '#4ECDC4',
  purple:  '#A78BFA',
  red:     '#FF6B6B',
  pink:    '#FFA07A',
  green:   '#34D399',
  orange:  '#FF8C00',
};

const DAYS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

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

const CHORE_CAT: Record<string, { emoji: string; color: string }> = {
  cleaning: { emoji: '🧹', color: C.teal },
  cooking:  { emoji: '🍳', color: C.orange },
  shopping: { emoji: '🛒', color: C.green },
  laundry:  { emoji: '👕', color: C.purple },
  dishes:   { emoji: '🍽️', color: '#87CEEB' },
  trash:    { emoji: '🗑️', color: C.red },
  other:    { emoji: '🔧', color: C.amber },
};

const NOTE_CAT: Record<string, { emoji: string; color: string }> = {
  note:     { emoji: '📝', color: C.amber },
  checklist:{ emoji: '✅', color: C.green },
  recipe:   { emoji: '🍳', color: C.orange },
  contact:  { emoji: '📞', color: C.teal },
  code:     { emoji: '🔑', color: C.purple },
  other:    { emoji: '📌', color: C.pink },
};

const DOC_CAT: Record<string, { emoji: string; color: string }> = {
  contract:    { emoji: '📋', color: C.teal },
  invoice:     { emoji: '🧾', color: C.orange },
  medical:     { emoji: '🏥', color: C.red },
  insurance:   { emoji: '🛡️', color: C.purple },
  identity:    { emoji: '🪪', color: C.amber },
  other:       { emoji: '📄', color: C.textSecondary },
};

const LEVEL_EMOJI = ['🌱','⭐','🔥','💎','👑'];

// ─── Helpers ──────────────────────────────────────────────
function getCalendarGrid(year: number, month: number): (number | null)[] {
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

function getExpiryStatus(dateStr: string): 'expired' | 'urgent' | 'warning' | 'ok' {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  const diff = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 2) return 'urgent';
  if (diff <= 5) return 'warning';
  return 'ok';
}

function getExpiryDays(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / 86400000);
}

const expiryColor = (s: string) =>
  s === 'expired' ? '#FF4444' : s === 'urgent' ? C.orange : s === 'warning' ? C.amber : C.green;

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return '🌅 Bonjour ! Belle journée à vous';
  if (h >= 12 && h < 18) return '☀️ Bon après-midi !';
  if (h >= 18 && h < 22) return '🌙 Bonsoir !';
  return '🌙 Bonne nuit !';
}

function priorityColor(p: string): string {
  return p === 'high' ? C.red : p === 'low' ? C.green : C.amber;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return 'Hier';
}

function formatCountdown(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getRemainingSeconds(timer: ActiveTimer): number {
  const dur = timer.duration_sec ?? 0;
  const el  = timer.elapsed_sec  ?? 0;
  if (timer.status === 'finished') return 0;
  if (timer.status === 'ready')    return dur;
  if (timer.status === 'paused')   return Math.max(0, dur - el);
  if (timer.status === 'running' && timer.started_at) {
    const sinceStart = Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
    return Math.max(0, dur - el - sinceStart);
  }
  return dur;
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

// ── Section Header ─────────────────────────────────────────
const SectionHeader: React.FC<{
  emoji: string; label: string; count?: number;
  onPress?: () => void;
}> = React.memo(({ emoji, label, count, onPress }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 20, marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 12, color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center', shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.5, elevation: 4 }}>
          <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: C.bgDeep }}>{count}</Text>
        </View>
      )}
    </View>
    {onPress && (
      <Pressable onPress={onPress}>
        <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.65)' }}>Voir tout ›</Text>
      </Pressable>
    )}
  </View>
));

// ── Highlight Line ─────────────────────────────────────────
const HighlightLine: React.FC<{ color?: string }> = ({ color = C.amber }) => (
  <LinearGradient
    colors={['transparent', color + '66', 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={{ height: 1 }}
  />
);

// ── Day Cell ───────────────────────────────────────────────
const DayCell: React.FC<{
  day: number | null; dateString: string;
  isToday: boolean; isSelected: boolean; isWeekend: boolean;
  dots: Array<{ color: string }>;
  onPress: (d: string) => void;
}> = React.memo(({ day, dateString, isToday, isSelected, isWeekend, dots, onPress }) => {
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
        ...(isSelected ? { shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 } : {}),
      }}
    >
      <Text style={{
        fontFamily: isToday || isSelected ? 'Outfit-Bold' : 'DMSans-Regular',
        fontSize: 15,
        color: isSelected ? C.bgDeep : isToday ? C.amber : isWeekend ? 'rgba(245,166,35,0.55)' : 'rgba(255,255,255,0.80)',
      }}>{day}</Text>
      {dots.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, position: 'absolute', bottom: 3 }}>
          {dots.slice(0, 4).map((d, i) => (
            <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: isSelected ? 'rgba(26,14,0,0.5)' : d.color }} />
          ))}
        </View>
      )}
    </Pressable>
  );
});

// ── Timer Countdown ────────────────────────────────────────
const TimerCountdown: React.FC<{ timer: ActiveTimer; onFinished: (id: string) => void }> = ({ timer, onFinished }) => {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(timer));
  const finishedRef = React.useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    if (timer.status !== 'running') {
      setRemaining(getRemainingSeconds(timer));
      return;
    }
    const interval = setInterval(() => {
      const r = getRemainingSeconds(timer);
      setRemaining(r);
      if (r <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        // Marquer terminé en base
        supabase.from('timers').update({ status: 'finished' }).eq('id', timer.id).then(() => {});
        // Retirer du widget d'accueil
        onFinished(timer.id);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, onFinished]);

  const dur = timer.duration_sec ?? 0;
  const pct = dur > 0 ? 1 - (remaining / dur) : 0;

  return (
    <View>
      <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 28, color: timer.status === 'running' ? C.success : C.amber, letterSpacing: 1 }}>
        {formatCountdown(remaining)}
      </Text>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 8, overflow: 'hidden' }}>
        <Animated.View style={{
          height: 4, borderRadius: 2,
          backgroundColor: timer.status === 'running' ? C.success : C.amber,
          width: `${Math.min(100, Math.round(pct * 100))}%`,
        }} />
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const household = useAuthStore(s => s.household);
  const members = useAuthStore(s => s.members);
  const user = useAuthStore(s => s.user);

  const { dayData, markedDates, selectedDate } = useCalendarData(members);
  const setSelectedDate = useCalendarStore(s => s.setSelectedDate);
  const calStore = useCalendarStore();

  const { data: hd, refetch } = useHomeData(household?.id, user?.id);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [showPanel, setShowPanel] = useState(false);
  const [panelPage, setPanelPage] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const scrollY = useSharedValue(0);
  const flamePulse = useSharedValue(1);

  const todayStr = useMemo(() =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today],
  );

  // ─── Load calendar data ──────────────────────────────
  useEffect(() => {
    if (household?.id) calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
  }, [household?.id, viewYear, viewMonth]);

  useFocusEffect(useCallback(() => {
    if (household?.id) calStore.fetchMonthData(household.id, viewYear, viewMonth + 1);
    refetch();
  }, [household?.id, viewYear, viewMonth, refetch]));

  useEffect(() => {
    if (!household?.id) return;
    return calStore.subscribeRealtime(household.id);
  }, [household?.id]);

  // ─── Flame pulse animation ───────────────────────────
  useEffect(() => {
    if ((hd.myStats?.streak_days ?? 0) > 0) {
      flamePulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        ), -1,
      );
    }
    return () => { flamePulse.value = 1; };
  }, [hd.myStats?.streak_days]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flamePulse.value }],
  }));

  // ─── Sticky header ───────────────────────────────────
  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 80], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [40, 80], [-10, 0], 'clamp') }],
  }));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, [scrollY]);

  // ─── Calendar helpers ────────────────────────────────
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
    if (dateString === selectedDate && showPanel) setShowPanel(false);
    else { setSelectedDate(dateString); setShowPanel(true); setPanelPage(0); }
  }, [selectedDate, showPanel, setSelectedDate]);

  const taskDates = useMemo(() => {
    const s = new Set<string>();
    calStore.tasks.forEach(t => { if (!t.completed_at) s.add(t.due_date); });
    return s;
  }, [calStore.tasks]);

  // ─── Panel data ──────────────────────────────────────
  const panelDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(selectedDate + 'T12:00:00');
    return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()].toLowerCase()}`;
  }, [selectedDate]);

  const panelEvents = useMemo(() => {
    const dayEnd = selectedDate + 'T23:59:59';
    const dayStart = selectedDate + 'T00:00:00';
    return calStore.events.filter(e => {
      const s = e.start_at; const end = e.end_at || e.start_at;
      return s <= dayEnd && end >= dayStart;
    }).sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [calStore.events, selectedDate]);

  const panelTasks = useMemo(() =>
    calStore.tasks.filter(t => t.due_date === selectedDate)
      .sort((a, b) => (a.completed_at ? 1 : -1) - (b.completed_at ? 1 : -1)),
    [calStore.tasks, selectedDate],
  );

  // ─── Upcoming events ─────────────────────────────────
  const upcomingEvents = useMemo(() => hd.upcomingEvents.slice(0, 4), [hd.upcomingEvents]);

  // ─── Today tasks from calendar ────────────────────────
  const todayTasks = useMemo(() => {
    const dayTasks = calStore.tasks.filter(t => t.due_date === todayStr);
    const overdue = calStore.tasks.filter(t => !t.completed_at && t.due_date < todayStr)
      .map(t => ({ ...t, _missed: true }));
    return [...dayTasks, ...overdue].sort((a, b) => (!a.completed_at && (b as any).completed_at ? -1 : 1));
  }, [calStore.tasks, todayStr]);

  // ─── Member helpers ──────────────────────────────────
  const findMember = useCallback((id: string | null | undefined) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  }, [members]);

  const getMemberMood = useCallback((m: { user_id: string | null }) => {
    if (!m.user_id) return null;
    return hd.todayMoods[m.user_id] ?? null;
  }, [hd.todayMoods]);

  // ─── Toggle task ─────────────────────────────────────
  const toggleTask = useCallback(async (taskId: string, done: boolean) => {
    const myMember = members.find(m => m.user_id === user?.id);
    const updatedTasks = calStore.tasks.map(t =>
      t.id === taskId ? { ...t, completed_at: done ? new Date().toISOString() : null, completed_by: done ? myMember?.id ?? null : null } : t,
    );
    useCalendarStore.setState({ tasks: updatedTasks });
    await supabase.from('tasks').update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? myMember?.id ?? null : null,
    }).eq('id', taskId);
  }, [calStore.tasks, user?.id, members]);

  // ─── Mark chore complete ─────────────────────────────
  const markChoreComplete = useCallback(async (occurrenceId: string) => {
    await supabase.from('chore_occurrences').update({ completed_at: new Date().toISOString() }).eq('id', occurrenceId);
    refetch();
  }, [refetch]);

  // ─── FAB pulse ───────────────────────────────────────
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

  // ─── Nav helpers ─────────────────────────────────────
  const goMore = useCallback((screen: string, params?: object) =>
    navigation.navigate('More', { screen, ...params }), [navigation]);

  // ─── Minuteurs : filtrer localement les terminés ──────
  const [finishedTimerIds, setFinishedTimerIds] = useState<Set<string>>(new Set());
  const handleTimerFinished = useCallback((id: string) => {
    setFinishedTimerIds(prev => new Set([...prev, id]));
  }, []);
  const visibleTimers = useMemo(
    () => hd.activeTimers.filter(t => !finishedTimerIds.has(t.id)),
    [hd.activeTimers, finishedTimerIds],
  );
  // Reset finishedTimerIds quand les données sont rechargées depuis la BDD
  useEffect(() => { setFinishedTimerIds(new Set()); }, [hd.activeTimers]);

  // ─── Conditionals ────────────────────────────────────
  const showTimers   = visibleTimers.length > 0;
  const showPoll     = hd.activePoll !== null && !hd.activePoll.hasVoted;
  const showBudget   = hd.monthBudget !== null;
  const showChores   = hd.todayChores.filter(c => !c.completed).length > 0;
  const showDocs     = hd.expiringDocs.length > 0;
  const showShopping = hd.shoppingList.length > 0;
  const showNotes    = hd.pinnedNotes.length > 0;
  const showChat     = hd.unreadMessages > 0;

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  // ─── Level config ────────────────────────────────────
  const levelEmoji = useMemo(() => {
    const lvl = hd.myStats?.level ?? 1;
    return LEVEL_EMOJI[Math.min(Math.floor(lvl / 5), LEVEL_EMOJI.length - 1)];
  }, [hd.myStats?.level]);

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* ══ STICKY COMPACT HEADER ══ */}
      <Animated.View style={[stickyStyle, {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        height: insets.top + 50,
        backgroundColor: 'rgba(26,14,0,0.94)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(245,166,35,0.15)',
        alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
      }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 14, color: C.textPrimary }}>
            {household?.name ?? 'Mon foyer'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {members.slice(0, 4).map((m) => (
              <View key={m.id} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color || C.amber }} />
            ))}
          </View>
          {showChat && (
            <View style={{ backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: '#fff' }}>
                {hd.unreadMessages > 9 ? '9+' : hd.unreadMessages}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ══ MAIN SCROLL ══ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* ══════ 1. HEADER FOYER ══════ */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={['rgba(245,166,35,0.09)', 'transparent']}
            style={{ paddingTop: insets.top + 10, paddingBottom: 14, alignItems: 'center' }}
          >
            <Text style={{
              fontFamily: 'Outfit-ExtraBold', fontSize: 26, color: C.textPrimary,
              letterSpacing: -0.5, textAlign: 'center',
              textShadowColor: 'rgba(245,166,35,0.25)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
            }}>
              {household?.name ?? 'Mon foyer'}
            </Text>

            {/* Avatars membres + humeurs */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: 16 }}>
              {members.map((m, idx) => {
                const mc = m.color || C.amber;
                const mood = getMemberMood(m);
                return (
                  <Animated.View key={m.id} entering={FadeIn.delay(200 + idx * 60).duration(300)}>
                    <TouchableOpacity
                      onPress={() => goMore('Mood')}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: mc + '1F', borderWidth: 1, borderColor: mc + '4D',
                        shadowColor: mc, shadowRadius: 6, shadowOpacity: 0.25, elevation: 3,
                      }}
                    >
                      {/* Avatar */}
                      <View style={{ position: 'relative' }}>
                        <View style={{
                          width: 28, height: 28, borderRadius: 9,
                          backgroundColor: mc + '40', borderWidth: 1.5, borderColor: mc,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 14 }}>{m.avatar_emoji || m.display_name.charAt(0)}</Text>
                        </View>
                        {/* Mood badge */}
                        <View style={{
                          position: 'absolute', bottom: -3, right: -3,
                          width: 16, height: 16, borderRadius: 8,
                          backgroundColor: C.bgDeep, borderWidth: 1, borderColor: mc,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 9 }}>{mood ?? '○'}</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: '#fff' }}>{m.display_name}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* Salutation */}
            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.40)', textAlign: 'center', marginTop: 6 }}>
              {greeting()}
            </Text>

            {/* Streak / XP pill */}
            {hd.myStats && (
              <Animated.View entering={FadeIn.delay(300).duration(400)}>
                <TouchableOpacity
                  onPress={() => goMore('Rewards')}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    marginTop: 10, paddingHorizontal: 16, paddingVertical: 8,
                    backgroundColor: 'rgba(255,140,0,0.10)', borderRadius: 16,
                    borderWidth: 1, borderColor: 'rgba(255,140,0,0.25)',
                  }}
                >
                  <Animated.Text style={[{ fontSize: 16 }, flameStyle]}>🔥</Animated.Text>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 14, color: C.warning }}>
                    {hd.myStats.streak_days}j
                  </Text>
                  <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  <Text style={{ fontSize: 13 }}>{levelEmoji}</Text>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 13, color: C.gold }}>
                    Niv. {hd.myStats.level}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                    · {hd.myStats.xp_total} pts
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ══════ 2. CALENDRIER ══════ */}
        <Animated.View entering={FadeInUp.delay(100).duration(500).springify()} style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <View style={{
            backgroundColor: C.bgSurface, borderRadius: 24, borderWidth: 1,
            borderColor: 'rgba(245,166,35,0.20)', overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
          }}>
            <HighlightLine />
            {/* Month nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
              <Pressable onPress={goToPrev} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: C.amberBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.amber, fontSize: 14 }}>◀</Text>
              </Pressable>
              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 18, color: C.amber }}>{MONTHS_FR[viewMonth]} {viewYear}</Text>
              <Pressable onPress={goToNext} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: C.amberBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.amber, fontSize: 14 }}>▶</Text>
              </Pressable>
            </View>
            {/* Day headers */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8 }}>
              {DAYS_HEADER.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 11, letterSpacing: 1, color: i >= 5 ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.35)' }}>{d}</Text>
                </View>
              ))}
            </View>
            {/* Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 12 }}>
              {grid.map((day, i) => {
                const dateStr = day
                  ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : '';
                const mark = dateStr ? markedDates[dateStr] : undefined;
                const dots = mark?.dots ?? [];
                return (
                  <DayCell key={i} day={day} dateString={dateStr}
                    isToday={dateStr === todayStr} isSelected={dateStr === selectedDate}
                    isWeekend={(i % 7) >= 5} dots={dots} onPress={onDayPress}
                  />
                );
              })}
            </View>
            {/* Légende collapsable */}
            <Pressable onPress={() => setLegendOpen(v => !v)} style={{ paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {legendOpen ? '▲' : '▼'} Légende
              </Text>
            </Pressable>
            {legendOpen && (
              <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {members.map(m => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: m.color ?? C.amber }} />
                      <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>{m.display_name}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.purple }} />
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Événement</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red }} />
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Aliment expiré</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.teal }} />
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textSecondary }}>Corvée</Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {/* ══════ 3. PANEL JOUR SÉLECTIONNÉ ══════ */}
        {showPanel && selectedDate && (
          <Animated.View entering={SlideInDown.duration(300).springify()} style={{ marginHorizontal: 16, marginBottom: 10 }}>
            <View style={{ backgroundColor: C.bgMid, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', overflow: 'hidden' }}>
              <HighlightLine />
              {/* Panel header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 16, color: '#fff' }}>{panelDateLabel}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {/* Pagination dots */}
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {[0, 1].map(p => (
                      <Pressable key={p} onPress={() => setPanelPage(p)}>
                        <View style={{ width: p === panelPage ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: p === panelPage ? C.amber : 'rgba(255,255,255,0.20)' }} />
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => setShowPanel(false)} style={{ padding: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(245,166,35,0.10)', marginHorizontal: 16 }} />

              {panelPage === 0 ? (
                /* Page 1: Événements */
                <View style={{ padding: 12 }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: C.amber, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>📅 Événements</Text>
                  {panelEvents.length === 0 ? (
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 10 }}>Aucun événement ce jour</Text>
                  ) : panelEvents.map(ev => {
                    const cat = EVT_CAT[ev.category ?? 'other'] ?? EVT_CAT.other;
                    const time = ev.is_all_day ? 'Journée'
                      : new Date(ev.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: cat.color + '30', padding: 10, marginBottom: 6 }}>
                        <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: cat.color }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: '#fff' }} numberOfLines={1}>{ev.title}</Text>
                          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.amber }}>{time}</Text>
                        </View>
                        <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* Page 2: Tâches */
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>✅ Tâches</Text>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted }}>← swipe</Text>
                  </View>
                  {panelTasks.length === 0 ? (
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 10 }}>Aucune tâche ce jour</Text>
                  ) : panelTasks.map(task => {
                    const isDone = !!task.completed_at;
                    const person = findMember(task.assigned_to) ?? findMember(task.created_by);
                    return (
                      <Pressable key={task.id} onPress={() => toggleTask(task.id, !isDone)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, marginBottom: 6 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: isDone ? C.success : 'rgba(245,166,35,0.35)', backgroundColor: isDone ? C.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {isDone && <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', textDecorationLine: isDone ? 'line-through' : 'none' }} numberOfLines={1}>{task.title}</Text>
                          {person && <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: person.color || C.amber }}>{person.display_name}</Text>}
                        </View>
                        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: priorityColor(task.priority) }} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ══════ 4. MINUTEURS ACTIFS [CONDITIONNEL] ══════ */}
        {showTimers && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <SectionHeader emoji="⏱️" label="Minuteurs" count={visibleTimers.length} onPress={() => goMore('Timers')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {visibleTimers.map((timer, idx) => {
                const isRunning = timer.status === 'running';
                return (
                  <Animated.View key={timer.id} entering={FadeIn.delay(idx * 80).duration(300)}>
                    <TouchableOpacity onPress={() => goMore('Timers')} style={{
                      backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1,
                      borderColor: isRunning ? 'rgba(52,211,153,0.28)' : 'rgba(245,166,35,0.22)',
                      padding: 14, width: 200, overflow: 'hidden',
                    }}>
                      <LinearGradient
                        colors={[isRunning ? 'rgba(52,211,153,0.25)' : 'rgba(245,166,35,0.20)', 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Text style={{ fontSize: 18 }}>{(CHORE_CAT[timer.category] ?? CHORE_CAT.other).emoji}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 14, color: '#fff', flex: 1 }}>{timer.title}</Text>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isRunning ? C.success : C.amber }} />
                      </View>
                      <TimerCountdown timer={timer} onFinished={handleTimerFinished} />
                      {(() => {
                        const creator = findMember(timer.created_by);
                        if (!creator) return null;
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: creator.color || C.amber }} />
                            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: C.textMuted }}>par {creator.display_name}</Text>
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ══════ 5. SONDAGE EN COURS [CONDITIONNEL] ══════ */}
        {showPoll && hd.activePoll && (
          <Animated.View entering={FadeInUp.delay(240).duration(400)} style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => goMore('Polls')} style={{
              backgroundColor: C.bgSurface, borderRadius: 20, borderWidth: 1,
              borderColor: 'rgba(245,166,35,0.25)', overflow: 'hidden',
            }}>
              <LinearGradient
                colors={['rgba(245,166,35,0.20)', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }}
              />
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>
                    🗳️ Sondage en cours
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }} />
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: C.success }}>ACTIF</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 20 }}>{hd.activePoll.emoji}</Text>
                  <Text numberOfLines={2} style={{ fontFamily: 'Outfit-Bold', fontSize: 16, color: '#fff', flex: 1 }}>{hd.activePoll.question}</Text>
                </View>
                {hd.activePoll.options.slice(0, 3).map(opt => {
                  const total = hd.activePoll!.total_votes;
                  const pct = total > 0 ? Math.round((opt.votes_count / total) * 100) : 0;
                  return (
                    <View key={opt.id} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: opt.color || C.amber }} />
                        <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textSecondary, flex: 1 }}>{opt.text}</Text>
                        <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: opt.color || C.amber }}>
                          {opt.votes_count} vote{opt.votes_count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: opt.color || C.amber, width: `${pct}%` as any, minWidth: pct > 0 ? 4 : 0 }} />
                      </View>
                    </View>
                  );
                })}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted }}>
                    {hd.activePoll.total_votes} vote{hd.activePoll.total_votes !== 1 ? 's' : ''} au total
                  </Text>
                  <View style={{ backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,166,35,0.30)', paddingHorizontal: 14, paddingVertical: 6 }}>
                    <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 12, color: C.amber }}>Voter →</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ══════ 6. SECTION ÉVÉNEMENTS ══════ */}
        <Animated.View entering={FadeInUp.delay(280).duration(400)}>
          <SectionHeader emoji="📅" label="Événements" count={upcomingEvents.length} onPress={() => goMore('Events')} />
          {upcomingEvents.length === 0 ? (
            <View style={{ backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)', marginHorizontal: 16, marginBottom: 8, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>Aucun événement cette semaine</Text>
            </View>
          ) : upcomingEvents.map((ev, idx) => {
            const cat = EVT_CAT[ev.category ?? 'other'] ?? EVT_CAT.other;
            const creator = findMember(ev.created_by);
            const time = ev.is_all_day ? 'Journée' : new Date(ev.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return (
              <Animated.View key={ev.id} entering={FadeInUp.delay(360 + idx * 60).duration(350)}>
                <View style={{ backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)', marginHorizontal: 16, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 6 }}>
                  <HighlightLine />
                  <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3.5, borderRadius: 2, backgroundColor: cat.color, shadowColor: cat.color, shadowRadius: 8, shadowOpacity: 0.9, elevation: 3 }} />
                  <View style={{ padding: 14, paddingLeft: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={{ backgroundColor: cat.color + '22', borderWidth: 1, borderColor: cat.color + '47', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={{ fontSize: 10 }}>{cat.emoji}</Text>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: cat.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{cat.label}</Text>
                      </View>
                      <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: C.amber }}>{time}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 16, color: C.textPrimary }}>{ev.title}</Text>
                    {(ev.location || creator) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                        {ev.location && <Text numberOfLines={1} style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', flex: 1 }}>📍 {ev.location}</Text>}
                        {creator && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: creator.color || C.amber }} />
                            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: creator.color || C.amber }}>{creator.display_name}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* ══════ 7. SECTION TÂCHES + CORVÉES ══════ */}
        <Animated.View entering={FadeInUp.delay(460).duration(400)}>
          <SectionHeader emoji="✅" label="Tâches du jour" count={todayTasks.filter(t => !t.completed_at).length} onPress={() => navigation.navigate('Tasks')} />

          {todayTasks.length === 0 ? (
            <View style={{ backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,166,35,0.14)', marginHorizontal: 16, marginBottom: 8, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>Aucune tâche aujourd'hui 🎉</Text>
            </View>
          ) : todayTasks.slice(0, 5).map((task, idx) => {
            const isDone = !!task.completed_at;
            const isMissed = !!(task as any)._missed;
            const person = findMember(task.assigned_to) ?? findMember(task.created_by);
            const pc = isMissed ? '#FF4444' : priorityColor(task.priority);
            return (
              <Animated.View key={task.id} entering={FadeInUp.delay(540 + idx * 50).duration(350)}>
                <View style={{ backgroundColor: isMissed ? 'rgba(255,68,68,0.06)' : C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: isMissed ? 'rgba(255,68,68,0.22)' : 'rgba(245,166,35,0.14)', marginHorizontal: 16, marginBottom: 7, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}>
                  <HighlightLine color={isMissed ? '#FF4444' : C.amber} />
                  <View style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: pc }} />
                  <Pressable onPress={() => toggleTask(task.id, !isDone)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 18 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: isDone ? C.success : isMissed ? 'rgba(255,68,68,0.45)' : 'rgba(245,166,35,0.35)', backgroundColor: isDone ? C.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isDone && <Text style={{ fontSize: 14, color: '#FFF', fontWeight: '700' }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 15, color: isDone ? 'rgba(255,255,255,0.4)' : isMissed ? 'rgba(255,255,255,0.65)' : C.textPrimary, textDecorationLine: isDone ? 'line-through' : 'none', flex: 1 }}>{task.title}</Text>
                        {isMissed && <View style={{ backgroundColor: 'rgba(255,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.30)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontFamily: 'DMSans-Medium', fontSize: 9, color: '#FF6B6B', letterSpacing: 0.5 }}>⏰ MANQUÉE</Text></View>}
                      </View>
                      {person && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}><View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: person.color || C.amber }} /><Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: person.color || C.amber }}>{person.display_name}</Text></View>}
                    </View>
                    <Text style={{ fontSize: 16 }}>{task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '🍃'}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })}

          {/* ── Corvées du jour ── */}
          {showChores && (
            <>
              <View style={{ marginHorizontal: 16, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 0.5, borderColor: 'rgba(245,166,35,0.25)' }} />
                <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: 1.5, textTransform: 'uppercase' }}>🔄 Corvées du jour</Text>
                <View style={{ flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 0.5, borderColor: 'rgba(245,166,35,0.25)' }} />
              </View>
              {hd.todayChores.filter(c => !c.completed).map((chore, idx) => {
                const choreCat = CHORE_CAT[chore.category] ?? CHORE_CAT.other;
                const assignedMember = findMember(chore.assigned_to);
                const isMe = assignedMember?.user_id === user?.id;
                return (
                  <Animated.View key={chore.id} entering={FadeInUp.delay(idx * 60).duration(300)}>
                    <View style={{ backgroundColor: 'rgba(78,205,196,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(78,205,196,0.18)', marginHorizontal: 16, marginBottom: 7, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: choreCat.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{choreCat.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Outfit-SemiBold', fontSize: 14, color: '#fff' }}>{chore.title}</Text>
                        {assignedMember && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: assignedMember.color || C.teal }} />
                            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: assignedMember.color || C.teal }}>
                              {isMe ? '⭐ C\'est votre tour' : `Tour de ${assignedMember.display_name}`}
                            </Text>
                          </View>
                        )}
                      </View>
                      {isMe && (
                        <Pressable onPress={() => markChoreComplete(chore.occurrence_id)} style={{ backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.success }}>Fait ✓</Text>
                        </Pressable>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </>
          )}
        </Animated.View>

        {/* ══════ 8. WIDGET BUDGET [CONDITIONNEL] ══════ */}
        {showBudget && hd.monthBudget && (
          <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => goMore('Budget')} style={{ backgroundColor: C.bgSurface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,166,35,0.20)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
              <LinearGradient colors={['rgba(245,166,35,0.20)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>💸 Budget du mois</Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.65)' }}>Voir tout ›</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View>
                    <Text style={{ fontFamily: 'Outfit-ExtraBold', fontSize: 30, color: C.red, letterSpacing: -1 }}>
                      {hd.monthBudget.total_spent.toFixed(0)}€
                    </Text>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted }}>dépensés ce mois</Text>
                  </View>
                  {hd.monthBudget.by_member.length > 0 && (
                    <>
                      <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                      <View style={{ flex: 1, gap: 4 }}>
                        {hd.monthBudget.by_member.slice(0, 3).map(bm => {
                          const mem = findMember(bm.member_id);
                          if (!mem) return null;
                          return (
                            <View key={bm.member_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mem.color || C.amber }} />
                              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: mem.color || C.amber, flex: 1 }}>{mem.display_name}</Text>
                              <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 12, color: mem.color || C.amber }}>{bm.amount.toFixed(0)}€</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ══════ 9. SECTION ALIMENTS + DOCUMENTS ══════ */}
        <Animated.View entering={FadeInUp.delay(560).duration(400)}>
          <SectionHeader emoji="🥑" label="Aliments" count={hd.urgentFood.length} onPress={() => goMore('Food')} />

          {hd.urgentFood.length === 0 ? (
            <View style={{ backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,166,35,0.14)', marginHorizontal: 16, marginBottom: 8, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>Aucun aliment à surveiller 🎉</Text>
            </View>
          ) : hd.urgentFood.map((item, idx) => {
            const st = getExpiryStatus(item.expiry_date);
            const days = getExpiryDays(item.expiry_date);
            const col = expiryColor(st);
            const cat = FOOD_CAT[item.category] ?? FOOD_CAT.other;
            return (
              <Animated.View key={item.id} entering={FadeInUp.delay(640 + idx * 50).duration(300)}>
                <View style={{ backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: col + '59', marginHorizontal: 16, marginBottom: 7, overflow: 'hidden' }}>
                  <LinearGradient colors={['transparent', col + '4D', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cat.color + '22', borderWidth: 1, borderColor: cat.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 15, color: C.textPrimary }}>{item.name}</Text>
                      {item.quantity && <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>}
                    </View>
                    <View style={{ backgroundColor: col + '26', borderWidth: 1, borderColor: col + '4D', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 12, color: col }}>{days < 0 ? 'Expiré ⚠️' : days === 0 ? 'Auj. ⚠️' : `${days}j`}</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}

          {/* Documents expirant */}
          {showDocs && (
            <>
              <View style={{ marginHorizontal: 16, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,140,0,0.20)' }} />
                <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: 'rgba(255,140,0,0.60)', letterSpacing: 1.5, textTransform: 'uppercase' }}>📋 Documents expirant</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,140,0,0.20)' }} />
              </View>
              {hd.expiringDocs.map((doc, idx) => {
                const isExpired = doc.days_until_expiry < 0;
                const isUrgent = doc.days_until_expiry < 7;
                const docCat = DOC_CAT[doc.category] ?? DOC_CAT.other;
                const badgeColor = isExpired ? '#FF4444' : isUrgent ? C.orange : C.amber;
                return (
                  <Animated.View key={doc.id} entering={FadeInUp.delay(idx * 60).duration(300)}>
                    <TouchableOpacity onPress={() => goMore('Documents')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `rgba(255,140,0,0.06)`, borderRadius: 12, borderWidth: 1, borderColor: `rgba(255,140,0,0.22)`, padding: 10, marginHorizontal: 16, marginBottom: 6, gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: docCat.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16 }}>{docCat.emoji}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: '#fff', flex: 1 }}>{doc.title}</Text>
                      <View style={{ backgroundColor: badgeColor + '26', borderWidth: 1, borderColor: badgeColor + '60', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: badgeColor }}>
                          {isExpired ? '❌ Expiré' : isUrgent ? `⚠️ ${doc.days_until_expiry}j` : `📅 ${doc.days_until_expiry}j`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </>
          )}
        </Animated.View>

        {/* ══════ 10. WIDGET COURSES [CONDITIONNEL] ══════ */}
        {showShopping && (
          <Animated.View entering={FadeInUp.delay(640).duration(400)} style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Shopping')} style={{ backgroundColor: C.bgSurface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 }}>
              <LinearGradient colors={['rgba(245,166,35,0.18)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 11, color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>🛒 Courses</Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.textMuted }}>{hd.shoppingList.length} articles › </Text>
                </View>
                {/* Progress bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 13, color: C.success }}>{hd.shoppingCheckedCount}</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{
                      height: 5, borderRadius: 3,
                      backgroundColor: hd.shoppingCheckedCount === hd.shoppingList.length && hd.shoppingList.length > 0 ? C.success : C.amber,
                      width: hd.shoppingList.length > 0 ? `${Math.round((hd.shoppingCheckedCount / hd.shoppingList.length) * 100)}%` : '0%',
                    }} />
                  </View>
                  <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 13, color: C.textMuted }}>{hd.shoppingList.length}</Text>
                </View>
                {hd.shoppingList.slice(0, 3).map(item => (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, borderColor: item.checked ? C.success : 'rgba(245,166,35,0.35)', backgroundColor: item.checked ? C.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {item.checked && <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: item.checked ? 'rgba(255,255,255,0.40)' : '#fff', textDecorationLine: item.checked ? 'line-through' : 'none', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                    {item.emoji && <Text style={{ fontSize: 14 }}>{item.emoji}</Text>}
                  </View>
                ))}
                {hd.shoppingList.length > 3 && (
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    +{hd.shoppingList.length - 3} autres articles
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ══════ 11. WIDGET NOTES ÉPINGLÉES [CONDITIONNEL] ══════ */}
        {showNotes && (
          <Animated.View entering={FadeInUp.delay(680).duration(400)}>
            <SectionHeader emoji="📝" label="Notes épinglées" count={hd.pinnedNotes.length} onPress={() => goMore('Notes')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {hd.pinnedNotes.map((note, idx) => {
                const noteCat = NOTE_CAT[note.category] ?? NOTE_CAT.other;
                return (
                  <Animated.View key={note.id} entering={FadeIn.delay(idx * 80).duration(300)}>
                    <TouchableOpacity onPress={() => goMore('NoteEditor', { noteId: note.id })} style={{ width: 155, borderRadius: 16, borderWidth: 1, borderColor: noteCat.color + '38', backgroundColor: C.bgSurface, overflow: 'hidden' }}>
                      <LinearGradient colors={[noteCat.color, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3 }} />
                      <View style={{ padding: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Text style={{ fontSize: 16 }}>{noteCat.emoji}</Text>
                          <Text numberOfLines={1} style={{ fontFamily: 'Outfit-SemiBold', fontSize: 13, color: '#fff', flex: 1 }}>{note.title}</Text>
                        </View>
                        {note.content && <Text numberOfLines={2} style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 }}>{note.content}</Text>}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          {(() => {
                            const creator = findMember(note.created_by);
                            return creator ? <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: creator.color || C.amber }} /> : null;
                          })()}
                          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 9, color: 'rgba(255,255,255,0.30)' }}>
                            {timeAgo(note.updated_at)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ══════ 12. WIDGET CHAT [CONDITIONNEL] ══════ */}
        {showChat && hd.lastMessage && (
          <Animated.View entering={FadeInUp.delay(720).duration(400)} style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Chat')} style={{ backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(78,205,196,0.25)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <LinearGradient colors={['rgba(78,205,196,0.25)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />
              {/* Avatar */}
              {(() => {
                const sender = findMember(hd.lastMessage!.sender_id);
                const mc = sender?.color || C.teal;
                return (
                  <View style={{ position: 'relative' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: mc + '33', borderWidth: 1.5, borderColor: mc, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>{sender?.avatar_emoji || '👤'}</Text>
                    </View>
                    <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bgDeep }}>
                      <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 10, color: '#fff' }}>
                        {hd.unreadMessages > 9 ? '9+' : hd.unreadMessages}
                      </Text>
                    </View>
                  </View>
                );
              })()}
              {/* Content */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 14, color: '#fff' }}>
                  {findMember(hd.lastMessage.sender_id)?.display_name ?? 'Membre'}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.textSecondary }}>
                  {hd.lastMessage.type === 'image' ? '📷 Photo' : hd.lastMessage.type === 'audio' ? '🎤 Message vocal' : hd.lastMessage.content ?? '...'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: C.textMuted }}>{timeAgo(hd.lastMessage.created_at)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>›</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>

      {/* ══════ FAB SPEED DIAL ══════ */}
      {fabOpen && (
        <Pressable
          onPress={() => setFabOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.50)', zIndex: 50 }}
        >
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }} />
        </Pressable>
      )}

      {fabOpen && (
        <View style={{ position: 'absolute', bottom: 165, right: 16, zIndex: 60, alignItems: 'flex-end', gap: 10 }}>
          {[
            { emoji: '📅', label: 'Événement', screen: 'Events', isMore: true, delay: 0 },
            { emoji: '✅', label: 'Tâche', screen: 'Tasks', isMore: false, delay: 60 },
            { emoji: '💸', label: 'Dépense', screen: 'Budget', isMore: true, delay: 120 },
            { emoji: '🗳️', label: 'Sondage', screen: 'Polls', isMore: true, delay: 180 },
          ].map(item => (
            <Animated.View key={item.screen} entering={FadeInUp.delay(item.delay).duration(250).springify()} exiting={FadeOut.duration(100)}>
              <Pressable
                onPress={() => { setFabOpen(false); item.isMore ? goMore(item.screen) : navigation.navigate(item.screen as any); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View style={{ backgroundColor: 'rgba(38,20,0,0.94)', borderWidth: 1, borderColor: C.amberBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: 'rgba(255,255,255,0.80)' }}>{item.label}</Text>
                </View>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)', alignItems: 'center', justifyContent: 'center', shadowColor: C.amber, shadowRadius: 6, shadowOpacity: 0.20, elevation: 4 }}>
                  <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Main FAB */}
      <Animated.View entering={FadeInUp.delay(900).duration(400).springify()} style={[fabGlowStyle, { position: 'absolute', bottom: 90, right: 16, zIndex: 60 }]}>
        <Pressable onPress={() => setFabOpen(prev => !prev)}>
          <LinearGradient
            colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 12 }}
          >
            <Text style={{ fontSize: 28, color: C.bgDeep, fontWeight: '700', transform: [{ rotate: fabOpen ? '45deg' : '0deg' }] }}>+</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};
