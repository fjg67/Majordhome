import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal, Switch,
  Dimensions, StatusBar,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  Easing, interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, RoundedRect, Circle, Line as SkLine, vec, Rect,
} from '@shopify/react-native-skia';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import type { CalendarEvent, EventCategory, RecurrenceType } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep: '#1A0E00',
  bgMid: '#261400',
  bgSurface: '#2E1A00',
  bgElevated: '#3A2200',
  amber: '#F5A623',
  amberSoft: 'rgba(245,166,35,0.15)',
  amberGlow: 'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',
  tabInactive: '#3A2200',
  border: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted: 'rgba(255,255,255,0.32)',
  catBirthday: '#FF6B6B',
  catWork: '#4ECDC4',
  catHealth: '#34D399',
  catFamily: '#A78BFA',
  catSport: '#FFA07A',
  catOther: '#F5A623',
};

// ═══════════════════════════════════════════════════════════
// CATEGORY CONFIG
// ═══════════════════════════════════════════════════════════
const CAT_CFG: Record<EventCategory, { emoji: string; label: string; color: string }> = {
  birthday: { emoji: '🎂', label: 'Anniversaire', color: C.catBirthday },
  work: { emoji: '💼', label: 'Travail', color: C.catWork },
  health: { emoji: '🏥', label: 'Santé', color: C.catHealth },
  family: { emoji: '👨‍👩‍👧', label: 'Famille', color: C.catFamily },
  sport: { emoji: '🏃', label: 'Sport', color: C.catSport },
  other: { emoji: '⭐', label: 'Autre', color: C.catOther },
};

const RECURRENCES: { key: RecurrenceType; label: string }[] = [
  { key: 'none', label: 'Jamais' },
  { key: 'weekly', label: 'Hebdo' },
  { key: 'monthly', label: 'Mensuel' },
];

type FilterTab = 'all' | 'week' | 'month';
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Ce mois' },
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const fmtDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === tomorrow) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const dayAbbr = (d: Date): string => {
  const names = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  return names[d.getDay()];
};

const QUICK_DATES = [
  { label: "Aujourd'hui", offset: 0 },
  { label: 'Demain', offset: 1 },
  { label: 'Dans 3j', offset: 3 },
  { label: 'Dans 1 sem.', offset: 7 },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const EventListScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const members = useAuthStore(s => s.members);
  const user = useAuthStore(s => s.user);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  // Modal state
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mCategory, setMCategory] = useState<EventCategory>('other');
  const [mLocation, setMLocation] = useState('');
  const [mAllDay, setMAllDay] = useState(false);
  const [mDateIdx, setMDateIdx] = useState(0);
  const [mRecurrence, setMRecurrence] = useState<RecurrenceType>('none');
  const [mStartH, setMStartH] = useState(10);
  const [mStartM, setMStartM] = useState(0);
  const [mEndH, setMEndH] = useState(11);
  const [mEndM, setMEndM] = useState(0);
  const [mAssignedMembers, setMAssignedMembers] = useState<string[]>([]);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // FAB pulse
  const fabPulse = useSharedValue(0);
  useEffect(() => {
    fabPulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
  }, [fabPulse]);
  const fabStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(fabPulse.value, [0, 1], [0.55, 0.75]),
  }));

  // ─── DATA ───
  const load = useCallback(async () => {
    if (!household?.id) return;
    const now = new Date();
    const todayStr = now.toISOString();
    const wEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    let q = supabase.from('events').select('*')
      .eq('household_id', household.id)
      .order('start_at', { ascending: true });

    if (filter === 'week') q = q.gte('start_at', todayStr).lte('start_at', wEnd);
    else if (filter === 'month') q = q.gte('start_at', todayStr).lte('start_at', mEnd);

    const { data } = await q;
    setEvents((data ?? []) as CalendarEvent[]);
  }, [household?.id, filter]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!household?.id) return;
    const unsub = subscribeToTable('events', household.id, () => load());
    return unsub;
  }, [household?.id, load]);

  // ─── SECTIONS ───
  const sections = useMemo(() => {
    const g: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = ev.start_at.split('T')[0];
      if (!g[d]) g[d] = [];
      g[d].push(ev);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
      date,
      label: fmtDateLabel(date),
      data,
    }));
  }, [events]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString();
    const wEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    return {
      all: events.length,
      week: events.filter(e => e.start_at >= todayStr && e.start_at <= wEnd).length,
      month: events.filter(e => e.start_at >= todayStr && e.start_at <= mEnd).length,
    };
  }, [events]);

  // ─── TIMELINE DAYS ───
  const timelineDays = useMemo(() => {
    const days: { date: string; day: number; abbr: string; isToday: boolean; hasEvent: boolean }[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const eventDates = new Set(events.map(e => e.start_at.split('T')[0]));
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const ds = d.toISOString().split('T')[0];
      days.push({
        date: ds,
        day: d.getDate(),
        abbr: dayAbbr(d),
        isToday: ds === todayStr,
        hasEvent: eventDates.has(ds),
      });
    }
    return days;
  }, [events]);

  // ─── MEMBER HELPERS ───
  const findMember = useCallback((id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  }, [members]);

  // ─── CLOSE MODAL ───
  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingEvent(null);
    setMTitle(''); setMDesc(''); setMCategory('other');
    setMLocation(''); setMAllDay(false); setMDateIdx(0); setMRecurrence('none');
    setMStartH(10); setMStartM(0); setMEndH(11); setMEndM(0);
    setMAssignedMembers([]);
  }, []);

  // ─── CREATE EVENT ───
  const createEvent = useCallback(async () => {
    if (!mTitle.trim() || !household?.id) return;
    const startDate = new Date(Date.now() + QUICK_DATES[mDateIdx].offset * 86400000);
    if (mAllDay) {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setHours(mStartH, mStartM, 0, 0);
    }
    const endDate = mAllDay ? null : (() => {
      const d = new Date(startDate);
      d.setHours(mEndH, mEndM, 0, 0);
      return d;
    })();
    const catColor = CAT_CFG[mCategory].color;

    await supabase.from('events').insert({
      household_id: household.id,
      created_by: user?.id ?? '',
      title: mTitle.trim(),
      description: mDesc.trim() || null,
      start_at: startDate.toISOString(),
      end_at: endDate ? endDate.toISOString() : null,
      color: catColor,
      is_all_day: mAllDay,
      recurrence: mRecurrence,
      category: mCategory,
      location: mLocation.trim() || null,
      assigned_members: mAssignedMembers.length > 0 ? mAssignedMembers : [],
    });

    closeModal();
    load();
  }, [mTitle, mDesc, mCategory, mLocation, mAllDay, mDateIdx, mRecurrence, mAssignedMembers, household?.id, user?.id, load, closeModal]);

  // ─── OPEN EDIT ───
  const openEdit = useCallback((ev: CalendarEvent) => {
    setEditingEvent(ev);
    setMTitle(ev.title);
    setMDesc(ev.description ?? '');
    setMCategory((ev.category ?? 'other') as EventCategory);
    setMLocation(ev.location ?? '');
    setMAllDay(ev.is_all_day);
    setMRecurrence(ev.recurrence ?? 'none');
    setMAssignedMembers(ev.assigned_members ?? []);
    setMDateIdx(0); // not applicable for edit
    const s = new Date(ev.start_at);
    setMStartH(s.getHours()); setMStartM(s.getMinutes());
    if (ev.end_at) {
      const e = new Date(ev.end_at);
      setMEndH(e.getHours()); setMEndM(e.getMinutes());
    } else {
      setMEndH(s.getHours() + 1); setMEndM(s.getMinutes());
    }
    setShowModal(true);
  }, []);

  // ─── UPDATE EVENT ───
  const updateEvent = useCallback(async () => {
    if (!editingEvent || !mTitle.trim()) return;
    const orig = new Date(editingEvent.start_at);
    const startDate = new Date(orig);
    if (mAllDay) {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setHours(mStartH, mStartM, 0, 0);
    }
    const endDate = mAllDay ? null : (() => {
      const d = new Date(startDate);
      d.setHours(mEndH, mEndM, 0, 0);
      return d;
    })();
    const catColor = CAT_CFG[mCategory].color;
    await supabase.from('events').update({
      title: mTitle.trim(),
      description: mDesc.trim() || null,
      start_at: startDate.toISOString(),
      end_at: endDate ? endDate.toISOString() : null,
      color: catColor,
      is_all_day: mAllDay,
      recurrence: mRecurrence,
      category: mCategory,
      location: mLocation.trim() || null,
      assigned_members: mAssignedMembers.length > 0 ? mAssignedMembers : [],
    }).eq('id', editingEvent.id);
    closeModal();
    load();
  }, [editingEvent, mTitle, mDesc, mCategory, mLocation, mAllDay, mRecurrence, mAssignedMembers, mStartH, mStartM, mEndH, mEndM, load]);

  // ─── DELETE EVENT ───
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await supabase.from('events').delete().eq('id', deleteConfirm.id);
    setDeleteConfirm(null);
    load();
  }, [deleteConfirm, load]);

  const counterText = events.length === 0
    ? 'Aucun événement à venir'
    : events.length === 1 ? '1 événement' : `${events.length} événements`;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* ─── HEADER ─── */}
      <Animated.View entering={FadeInDown.duration(500).springify()}>
        <LinearGradient
          colors={[C.bgDeep, C.bgMid]}
          style={{ paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Calendar icon Skia */}
            <Canvas style={{ width: 32, height: 32 }}>
              <RoundedRect x={2} y={6} width={28} height={24} r={5}
                color="rgba(255,255,255,0.85)" style="stroke" strokeWidth={1.8} />
              <RoundedRect x={2} y={6} width={28} height={8} r={5} color={C.amber} />
              <Rect x={2} y={11} width={28} height={3} color={C.amber} />
              <Circle cx={9} cy={3.5} r={1.5} color="rgba(255,255,255,0.8)" />
              <Circle cx={23} cy={3.5} r={1.5} color="rgba(255,255,255,0.8)" />
              <SkLine p1={vec(9, 0)} p2={vec(9, 7)} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
              <SkLine p1={vec(23, 0)} p2={vec(23, 7)} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
            </Canvas>
            <View>
              <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: C.textPrimary, letterSpacing: -0.5 }}>
                Événements
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSecondary, marginTop: 1 }}>
                {counterText}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ─── MINI TIMELINE ─── */}
      <Animated.View entering={FadeInDown.delay(80).duration(500).springify()}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
        >
          {timelineDays.map((td) => {
            const sel = td.date === selectedTimeline;
            return (
              <Pressable
                key={td.date}
                onPress={() => setSelectedTimeline(td.date)}
                style={[{
                  width: 48, alignItems: 'center', paddingVertical: 8,
                  borderRadius: 14, marginRight: 8,
                }, sel ? {
                  backgroundColor: C.amber,
                  shadowColor: C.amber,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
                } : {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: C.border,
                }]}
              >
                {td.isToday && (
                  <Text style={{
                    fontSize: 7, fontFamily: 'DMSans-Medium',
                    color: sel ? C.bgDeep : C.amber,
                    letterSpacing: 1, marginBottom: 2,
                  }}>AUJ.</Text>
                )}
                <Text style={{
                  fontSize: 9, fontFamily: 'DMSans-Medium',
                  color: sel ? C.bgDeep : 'rgba(255,255,255,0.35)',
                  letterSpacing: 1.5,
                }}>{td.abbr}</Text>
                <Text style={{
                  fontSize: 18, fontFamily: 'Nunito-Bold',
                  color: sel ? C.bgDeep : C.textPrimary, marginTop: 2,
                }}>{td.day}</Text>
                {td.hasEvent && (
                  <View style={{
                    width: 5, height: 5, borderRadius: 2.5, marginTop: 3,
                    backgroundColor: sel ? 'rgba(26,14,0,0.5)' : C.amber,
                  }} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ─── FILTER TABS ─── */}
      <Animated.View entering={FadeInDown.delay(160).duration(500).springify()}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6, gap: 8 }}
        >
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            const count = tabCounts[tab.key];
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                }, active ? {
                  backgroundColor: C.amber,
                  shadowColor: C.amber,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
                } : {
                  backgroundColor: C.tabInactive,
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
                }]}
              >
                <Text style={{
                  fontSize: 13,
                  fontFamily: active ? 'Nunito-Bold' : 'DMSans-Medium',
                  color: active ? C.bgDeep : 'rgba(255,255,255,0.48)',
                }}>{tab.label}</Text>
                {count > 0 && (
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: active ? 'rgba(26,14,0,0.2)' : C.amberSoft,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 10, fontFamily: 'Nunito-Bold',
                      color: active ? C.bgDeep : C.amber,
                    }}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ─── EVENT LIST ─── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 }}
      >
        {events.length === 0 ? (
          <Animated.View entering={FadeIn.delay(300).duration(600)}
            style={{ alignItems: 'center', paddingTop: 60 }}
          >
            {/* Empty state Skia */}
            <Canvas style={{ width: 220, height: 180 }}>
              <Circle cx={110} cy={90} r={80} color="rgba(245,166,35,0.05)" />
              <RoundedRect x={60} y={40} width={100} height={90} r={10}
                color="rgba(245,166,35,0.25)" style="stroke" strokeWidth={1.5} />
              <RoundedRect x={60} y={40} width={100} height={22} r={10}
                color="rgba(245,166,35,0.3)" />
              <Rect x={60} y={52} width={100} height={10} color="rgba(245,166,35,0.3)" />
              <Circle cx={80} cy={37} r={2} color="rgba(255,255,255,0.5)" />
              <Circle cx={140} cy={37} r={2} color="rgba(255,255,255,0.5)" />
              <SkLine p1={vec(80, 32)} p2={vec(80, 42)}
                color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
              <SkLine p1={vec(140, 32)} p2={vec(140, 42)}
                color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
              <SkLine p1={vec(75, 78)} p2={vec(145, 78)}
                color="rgba(245,166,35,0.15)" strokeWidth={1} />
              <SkLine p1={vec(75, 92)} p2={vec(145, 92)}
                color="rgba(245,166,35,0.15)" strokeWidth={1} />
              <SkLine p1={vec(75, 106)} p2={vec(145, 106)}
                color="rgba(245,166,35,0.15)" strokeWidth={1} />
              <Circle cx={45} cy={55} r={3} color="rgba(245,166,35,0.3)" />
              <Circle cx={175} cy={65} r={2.5} color="rgba(78,205,196,0.3)" />
              <Circle cx={50} cy={120} r={2} color="rgba(167,139,250,0.3)" />
            </Canvas>
            <Text style={{
              fontSize: 18, fontFamily: 'Nunito-Bold', color: C.textPrimary,
              textAlign: 'center', marginTop: 8,
            }}>
              {filter === 'all' ? 'Aucun événement\nà venir'
                : filter === 'week' ? 'Semaine tranquille !'
                : 'Mois calme en perspective'}
            </Text>
            <Text style={{
              fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMuted,
              textAlign: 'center', marginTop: 8,
            }}>
              Ajoutez des événements pour organiser votre foyer
            </Text>
            <Pressable
              onPress={() => setShowModal(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                marginTop: 24, paddingHorizontal: 24, paddingVertical: 14,
                borderRadius: 16, backgroundColor: C.amberSoft,
                borderWidth: 1, borderColor: C.amberBorder,
              }}
            >
              <Text style={{ fontSize: 18, color: C.amber }}>+</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: C.amber }}>
                Créer un événement
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          sections.map((sec, secIdx) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = sec.date === todayStr;
            return (
              <Animated.View
                key={sec.date}
                entering={FadeInUp.delay(240 + secIdx * 60).duration(500).springify()}
              >
                {/* Section header */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  marginTop: secIdx === 0 ? 8 : 20, marginBottom: 10,
                }}>
                  <View style={{
                    backgroundColor: isToday ? C.amber : 'rgba(245,166,35,0.12)',
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5,
                    borderWidth: isToday ? 0 : 1,
                    borderColor: 'rgba(245,166,35,0.25)',
                  }}>
                    <Text style={{
                      fontSize: 12, fontFamily: 'Nunito-Bold',
                      color: isToday ? C.bgDeep : C.amber,
                      textTransform: 'capitalize',
                    }}>{sec.label}</Text>
                  </View>
                  <LinearGradient
                    colors={['rgba(245,166,35,0.2)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1, height: 1, marginLeft: 10 }}
                  />
                  <Text style={{
                    fontSize: 11, fontFamily: 'DMSans-Regular',
                    color: 'rgba(255,255,255,0.3)', marginLeft: 8,
                  }}>
                    {sec.data.length} event{sec.data.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Event cards */}
                {sec.data.map((item) => {
                  const cat = (item.category ?? 'other') as EventCategory;
                  const catCfg = CAT_CFG[cat] ?? CAT_CFG.other;
                  const catColor = catCfg.color;
                  const creator = findMember(item.created_by);
                  const assignedIds: string[] = item.assigned_members ?? [];
                  const assignedMembers = assignedIds.length > 0
                    ? assignedIds.map(id => findMember(id)).filter(Boolean) as NonNullable<ReturnType<typeof findMember>>[]
                    : null;

                  return (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: item.is_all_day ? catColor + '14' : C.bgSurface,
                        borderRadius: 20, borderWidth: 1,
                        borderColor: item.is_all_day ? catColor + '4D' : C.amberBorder,
                        marginBottom: 10, overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 5 },
                        shadowOpacity: 0.35, shadowRadius: 14, elevation: 7,
                      }}
                    >
                      {/* Top highlight line */}
                      <LinearGradient
                        colors={['transparent', catColor + '59', 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1 }}
                      />

                      {/* Category bar left edge */}
                      <View style={{
                        position: 'absolute', left: 0, top: 10, bottom: 10,
                        width: 3.5, borderRadius: 2, backgroundColor: catColor,
                        shadowColor: catColor, shadowRadius: 8, shadowOpacity: 0.9,
                        shadowOffset: { width: 0, height: 0 },
                      }} />

                      <View style={{ flexDirection: 'row', padding: 16, paddingLeft: 20 }}>
                        {/* Time column */}
                        <View style={{
                          width: 52, alignItems: 'center', marginRight: 14,
                          justifyContent: 'center',
                        }}>
                          {item.is_all_day ? (
                            <View style={{
                              backgroundColor: catColor + '22',
                              borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4,
                            }}>
                              <Text style={{
                                fontSize: 9, fontFamily: 'DMSans-Medium',
                                color: catColor, textAlign: 'center', lineHeight: 13,
                              }}>{'Toute\nla journée'}</Text>
                            </View>
                          ) : (
                            <>
                              <Text style={{
                                fontSize: 15, fontFamily: 'Nunito-Bold', color: C.amber,
                              }}>{fmtTime(item.start_at)}</Text>
                              <View style={{
                                width: 1, height: 16, marginVertical: 3,
                                borderLeftWidth: 1, borderStyle: 'dashed',
                                borderColor: 'rgba(245,166,35,0.3)',
                              }} />
                              {item.end_at && (
                                <Text style={{
                                  fontSize: 12, fontFamily: 'DMSans-Regular',
                                  color: 'rgba(255,255,255,0.35)',
                                }}>{fmtTime(item.end_at)}</Text>
                              )}
                            </>
                          )}
                        </View>

                        {/* Content column */}
                        <View style={{ flex: 1 }}>
                          {/* Category badge */}
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            gap: 8, marginBottom: 4,
                          }}>
                            <View style={{
                              backgroundColor: catColor + '26',
                              borderWidth: 1, borderColor: catColor + '59',
                              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                            }}>
                              <Text style={{ fontSize: 10 }}>{catCfg.emoji}</Text>
                              <Text style={{
                                fontSize: 9, fontFamily: 'DMSans-Medium',
                                color: catColor, textTransform: 'uppercase',
                                letterSpacing: 0.8,
                              }}>{catCfg.label}</Text>
                            </View>
                          </View>

                          <Text style={{
                            fontSize: 16, fontFamily: 'Nunito-SemiBold',
                            color: C.textPrimary, marginBottom: 2,
                          }} numberOfLines={1}>{item.title}</Text>

                          {item.description ? (
                            <Text style={{
                              fontSize: 13, fontFamily: 'DMSans-Regular',
                              color: 'rgba(255,255,255,0.48)', marginBottom: 4,
                            }} numberOfLines={2}>{item.description}</Text>
                          ) : null}

                          {/* Location + creator */}
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            marginTop: 6, gap: 10,
                          }}>
                            {item.location ? (
                              <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                gap: 4, flex: 1,
                              }}>
                                <Text style={{ fontSize: 12 }}>📍</Text>
                                <Text style={{
                                  fontSize: 12, fontFamily: 'DMSans-Regular',
                                  color: 'rgba(255,255,255,0.45)',
                                }} numberOfLines={1}>{item.location}</Text>
                              </View>
                            ) : null}

                            {(assignedMembers && assignedMembers.length > 0 ? assignedMembers : (creator ? [creator] : [])).length > 0 && (
                              <View style={{
                                marginLeft: 'auto', flexDirection: 'row',
                                alignItems: 'center',
                              }}>
                                {(assignedMembers && assignedMembers.length > 0 ? assignedMembers : (creator ? [creator] : [])).map((mem, mi) => (
                                  <View key={mem.id} style={{
                                    width: 26, height: 26, borderRadius: 13,
                                    backgroundColor: (mem.color ?? C.amber) + '33',
                                    borderWidth: 1.5,
                                    borderColor: mem.color ?? C.amber,
                                    alignItems: 'center', justifyContent: 'center',
                                    marginLeft: mi > 0 ? -8 : 0,
                                    zIndex: 10 - mi,
                                  }}>
                                    <Text style={{
                                      fontSize: 10, fontFamily: 'Nunito-Bold',
                                      color: mem.color ?? C.amber,
                                    }}>
                                      {mem.display_name.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* Edit & Delete buttons */}
                            <View style={{ flexDirection: 'row', gap: 8, marginLeft: assignedMembers || creator ? 10 : 'auto' }}>
                              <Pressable onPress={() => openEdit(item)} hitSlop={8}
                                style={{
                                  width: 30, height: 30, borderRadius: 10,
                                  backgroundColor: 'rgba(245,166,35,0.12)',
                                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                <Text style={{ fontSize: 13 }}>✏️</Text>
                              </Pressable>
                              <Pressable onPress={() => setDeleteConfirm({ id: item.id, title: item.title })} hitSlop={8}
                                style={{
                                  width: 30, height: 30, borderRadius: 10,
                                  backgroundColor: 'rgba(255,80,80,0.12)',
                                  borderWidth: 1, borderColor: 'rgba(255,80,80,0.25)',
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                <Text style={{ fontSize: 13 }}>🗑️</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* ─── FAB ─── */}
      <Animated.View
        entering={FadeInUp.delay(500).duration(400).springify()}
        style={[{
          position: 'absolute', bottom: 90, right: 20,
          width: 58, height: 58, borderRadius: 18,
          shadowColor: C.amber,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16, elevation: 12,
        }, fabStyle]}
      >
        <Pressable
          onPress={() => setShowModal(true)}
          style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              flex: 1, alignItems: 'center', justifyContent: 'center',
              borderRadius: 18,
            }}
          >
            <Text style={{
              fontSize: 28, color: '#FFFFFF', fontFamily: 'Nunito-Bold',
              marginTop: -2,
            }}>+</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ─── CREATION MODAL ─── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{
          flex: 1, justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}>
          <Pressable style={{ flex: 1 }} onPress={closeModal} />
          <View style={{
            backgroundColor: C.bgMid,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            maxHeight: '82%',
          }}>
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignSelf: 'center', marginTop: 12, marginBottom: 16,
            }} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            >
              <Text style={{
                fontSize: 22, fontFamily: 'Nunito-Bold',
                color: C.textPrimary, marginBottom: 20,
              }}>{editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</Text>

              {/* Title */}
              <Text style={labelStyle}>TITRE</Text>
              <TextInput
                value={mTitle} onChangeText={setMTitle}
                placeholder="Ex: Anniversaire de Marie..."
                placeholderTextColor={C.textMuted}
                style={inputStyle}
              />

              {/* Date */}
              <Text style={labelStyle}>DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 16 }}
              >
                {QUICK_DATES.map((qd, i) => {
                  const sel = mDateIdx === i;
                  return (
                    <Pressable key={qd.label} onPress={() => setMDateIdx(i)} style={{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                      backgroundColor: sel ? C.amber : C.bgSurface,
                      borderWidth: 1, borderColor: sel ? C.amber : C.border,
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                        color: sel ? C.bgDeep : C.textSecondary,
                      }}>{qd.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* All day toggle */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 16, paddingVertical: 8,
              }}>
                <Text style={{
                  fontSize: 14, fontFamily: 'DMSans-Medium', color: C.textSecondary,
                }}>Toute la journée</Text>
                <Switch
                  value={mAllDay} onValueChange={setMAllDay}
                  trackColor={{ false: C.bgElevated, true: C.amberGlow }}
                  thumbColor={mAllDay ? C.amber : 'rgba(255,255,255,0.4)'}
                />
              </View>

              {/* ═══ TIME PICKER (shown when not all-day) ═══ */}
              {!mAllDay && (
                <Animated.View entering={FadeInDown.duration(300).springify()}>
                  <Text style={labelStyle}>HORAIRES</Text>
                  <View style={{
                    flexDirection: 'row', gap: 12, marginBottom: 16,
                  }}>
                    {/* ── START TIME ── */}
                    <View style={{
                      flex: 1, backgroundColor: C.bgSurface,
                      borderRadius: 18, borderWidth: 1, borderColor: C.amberBorder,
                      padding: 14, alignItems: 'center',
                      shadowColor: C.amber, shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
                    }}>
                      {/* Label */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Canvas style={{ width: 14, height: 14 }}>
                          <Circle cx={7} cy={7} r={6} style="stroke" strokeWidth={1.3} color="rgba(245,166,35,0.6)" />
                          <SkLine p1={vec(7, 7)} p2={vec(7, 4)} style="stroke" strokeWidth={1.3} color={C.amber} strokeCap="round" />
                          <SkLine p1={vec(7, 7)} p2={vec(10, 7)} style="stroke" strokeWidth={1.3} color={C.amber} strokeCap="round" />
                        </Canvas>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: 'rgba(245,166,35,0.65)', letterSpacing: 1 }}>DÉBUT</Text>
                      </View>
                      {/* Time display */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Hour */}
                        <View style={{ alignItems: 'center' }}>
                          <Pressable onPress={() => setMStartH(h => (h + 1) % 24)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▲</Text>
                          </Pressable>
                          <View style={{
                            backgroundColor: 'rgba(245,166,35,0.10)', borderRadius: 12,
                            borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                            paddingHorizontal: 14, paddingVertical: 8, minWidth: 50, alignItems: 'center',
                          }}>
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: C.amber }}>
                              {String(mStartH).padStart(2, '0')}
                            </Text>
                          </View>
                          <Pressable onPress={() => setMStartH(h => (h - 1 + 24) % 24)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▼</Text>
                          </Pressable>
                        </View>
                        {/* Colon */}
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 28, color: C.amber,
                          marginHorizontal: 4, marginBottom: 2,
                        }}>:</Text>
                        {/* Minute */}
                        <View style={{ alignItems: 'center' }}>
                          <Pressable onPress={() => setMStartM(m => (m + 5) % 60)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▲</Text>
                          </Pressable>
                          <View style={{
                            backgroundColor: 'rgba(245,166,35,0.10)', borderRadius: 12,
                            borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                            paddingHorizontal: 14, paddingVertical: 8, minWidth: 50, alignItems: 'center',
                          }}>
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: C.amber }}>
                              {String(mStartM).padStart(2, '0')}
                            </Text>
                          </View>
                          <Pressable onPress={() => setMStartM(m => (m - 5 + 60) % 60)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▼</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {/* ── Arrow connector ── */}
                    <View style={{ justifyContent: 'center', paddingTop: 18 }}>
                      <Canvas style={{ width: 24, height: 24 }}>
                        <SkLine p1={vec(2, 12)} p2={vec(20, 12)} style="stroke" strokeWidth={1.5} color="rgba(245,166,35,0.4)" strokeCap="round" />
                        <SkLine p1={vec(15, 7)} p2={vec(21, 12)} style="stroke" strokeWidth={1.5} color="rgba(245,166,35,0.4)" strokeCap="round" />
                        <SkLine p1={vec(15, 17)} p2={vec(21, 12)} style="stroke" strokeWidth={1.5} color="rgba(245,166,35,0.4)" strokeCap="round" />
                      </Canvas>
                    </View>

                    {/* ── END TIME ── */}
                    <View style={{
                      flex: 1, backgroundColor: C.bgSurface,
                      borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                      padding: 14, alignItems: 'center',
                    }}>
                      {/* Label */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Canvas style={{ width: 14, height: 14 }}>
                          <Circle cx={7} cy={7} r={6} style="stroke" strokeWidth={1.3} color="rgba(255,255,255,0.3)" />
                          <SkLine p1={vec(7, 7)} p2={vec(7, 4)} style="stroke" strokeWidth={1.3} color="rgba(255,255,255,0.45)" strokeCap="round" />
                          <SkLine p1={vec(7, 7)} p2={vec(10, 9)} style="stroke" strokeWidth={1.3} color="rgba(255,255,255,0.45)" strokeCap="round" />
                        </Canvas>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: 'rgba(255,255,255,0.40)', letterSpacing: 1 }}>FIN</Text>
                      </View>
                      {/* Time display */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Hour */}
                        <View style={{ alignItems: 'center' }}>
                          <Pressable onPress={() => setMEndH(h => (h + 1) % 24)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▲</Text>
                          </Pressable>
                          <View style={{
                            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                            paddingHorizontal: 14, paddingVertical: 8, minWidth: 50, alignItems: 'center',
                          }}>
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: C.textPrimary }}>
                              {String(mEndH).padStart(2, '0')}
                            </Text>
                          </View>
                          <Pressable onPress={() => setMEndH(h => (h - 1 + 24) % 24)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▼</Text>
                          </Pressable>
                        </View>
                        {/* Colon */}
                        <Text style={{
                          fontFamily: 'Nunito-Bold', fontSize: 28, color: 'rgba(255,255,255,0.65)',
                          marginHorizontal: 4, marginBottom: 2,
                        }}>:</Text>
                        {/* Minute */}
                        <View style={{ alignItems: 'center' }}>
                          <Pressable onPress={() => setMEndM(m => (m + 5) % 60)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▲</Text>
                          </Pressable>
                          <View style={{
                            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                            paddingHorizontal: 14, paddingVertical: 8, minWidth: 50, alignItems: 'center',
                          }}>
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: C.textPrimary }}>
                              {String(mEndM).padStart(2, '0')}
                            </Text>
                          </View>
                          <Pressable onPress={() => setMEndM(m => (m - 5 + 60) % 60)}
                            style={{ padding: 4 }}>
                            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>▼</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Quick time presets */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                    {[
                      { label: '☀️ Matin', sh: 9, sm: 0, eh: 10, em: 0 },
                      { label: '🌤️ Midi', sh: 12, sm: 0, eh: 13, em: 0 },
                      { label: '🌅 Après-midi', sh: 14, sm: 0, eh: 16, em: 0 },
                      { label: '🌙 Soir', sh: 19, sm: 0, eh: 21, em: 0 },
                    ].map(p => {
                      const active = mStartH === p.sh && mStartM === p.sm && mEndH === p.eh && mEndM === p.em;
                      return (
                        <Pressable key={p.label} onPress={() => {
                          setMStartH(p.sh); setMStartM(p.sm); setMEndH(p.eh); setMEndM(p.em);
                        }} style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                          backgroundColor: active ? 'rgba(245,166,35,0.15)' : C.bgElevated,
                          borderWidth: 1, borderColor: active ? C.amberBorder : C.border,
                        }}>
                          <Text style={{
                            fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular',
                            color: active ? C.amber : C.textMuted,
                          }}>{p.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              )}

              {/* Category */}
              <Text style={labelStyle}>CATÉGORIE</Text>
              <View style={{
                flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
              }}>
                {(Object.entries(CAT_CFG) as [EventCategory, typeof CAT_CFG[EventCategory]][]).map(([key, cfg]) => {
                  const sel = mCategory === key;
                  return (
                    <Pressable key={key} onPress={() => setMCategory(key)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                      backgroundColor: sel ? cfg.color + '22' : C.bgSurface,
                      borderWidth: 1, borderColor: sel ? cfg.color : C.border,
                      width: (SW - 56) / 3 - 6,
                    }}>
                      <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                      <Text style={{
                        fontSize: 11,
                        fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                        color: sel ? cfg.color : C.textMuted,
                      }} numberOfLines={1}>{cfg.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Assigned members */}
              <Text style={labelStyle}>POUR QUI</Text>
              <View style={{
                flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
              }}>
                {/* "Tout le monde" chip */}
                <Pressable onPress={() => setMAssignedMembers([])}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: mAssignedMembers.length === 0 ? 'rgba(245,166,35,0.15)' : C.bgSurface,
                    borderWidth: 1.5,
                    borderColor: mAssignedMembers.length === 0 ? C.amber : C.border,
                  }}>
                  <Text style={{ fontSize: 14 }}>👨‍👩‍👧</Text>
                  <Text style={{
                    fontSize: 12, fontFamily: mAssignedMembers.length === 0 ? 'Nunito-Bold' : 'DMSans-Regular',
                    color: mAssignedMembers.length === 0 ? C.amber : C.textMuted,
                  }}>Tout le monde</Text>
                </Pressable>
                {/* Per-member chips */}
                {members.map(m => {
                  const sel = mAssignedMembers.includes(m.id);
                  return (
                    <Pressable key={m.id} onPress={() => {
                      setMAssignedMembers(prev =>
                        prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id],
                      );
                    }} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                      backgroundColor: sel ? (m.color ?? C.amber) + '22' : C.bgSurface,
                      borderWidth: 1.5,
                      borderColor: sel ? (m.color ?? C.amber) : C.border,
                    }}>
                      <Text style={{ fontSize: 14 }}>{m.avatar_emoji}</Text>
                      <Text style={{
                        fontSize: 12, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                        color: sel ? (m.color ?? C.amber) : C.textMuted,
                      }}>{m.display_name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Location */}
              <Text style={labelStyle}>LIEU</Text>
              <TextInput
                value={mLocation} onChangeText={setMLocation}
                placeholder="Optionnel..."
                placeholderTextColor={C.textMuted}
                style={inputStyle}
              />

              {/* Description */}
              <Text style={labelStyle}>DESCRIPTION</Text>
              <TextInput
                value={mDesc} onChangeText={setMDesc}
                placeholder="Optionnel..."
                placeholderTextColor={C.textMuted}
                multiline numberOfLines={3}
                style={[inputStyle, { height: 80, textAlignVertical: 'top' }]}
              />

              {/* Recurrence */}
              <Text style={labelStyle}>RÉCURRENCE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 24 }}
              >
                {RECURRENCES.map(r => {
                  const sel = mRecurrence === r.key;
                  return (
                    <Pressable key={r.key} onPress={() => setMRecurrence(r.key)} style={{
                      paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14,
                      backgroundColor: sel ? C.amber : C.bgSurface,
                      borderWidth: 1, borderColor: sel ? C.amber : C.border,
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular',
                        color: sel ? C.bgDeep : C.textSecondary,
                      }}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Submit */}
              <Pressable onPress={editingEvent ? updateEvent : createEvent} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient
                  colors={['#F5A623', '#E8920A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    height: 56, alignItems: 'center', justifyContent: 'center',
                    borderRadius: 16,
                    shadowColor: C.amber,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
                  }}
                >
                  <Text style={{
                    fontSize: 16, fontFamily: 'Nunito-Bold', color: C.bgDeep,
                  }}>{editingEvent ? 'Enregistrer' : 'Créer l\'événement'}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade">
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.75)',
        }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setDeleteConfirm(null)} />

          <Animated.View entering={FadeIn.duration(250)} style={{
            width: SW * 0.82, borderRadius: 28, overflow: 'hidden',
          }}>
            {/* Skia glow background */}
            <Canvas style={{ position: 'absolute', width: SW * 0.82, height: 280 }}>
              <RoundedRect x={0} y={0} width={SW * 0.82} height={280} r={28}
                color="#2A1600" />
              <Circle cx={SW * 0.41} cy={50} r={100}
                color="rgba(255,80,80,0.06)" />
              <Circle cx={SW * 0.41} cy={50} r={50}
                color="rgba(255,80,80,0.04)" />
            </Canvas>

            <View style={{ padding: 28, alignItems: 'center' }}>
              {/* Trash icon circle */}
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(255,80,80,0.12)',
                borderWidth: 1.5, borderColor: 'rgba(255,80,80,0.25)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
                shadowColor: '#FF5050', shadowRadius: 20, shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 0 }, elevation: 8,
              }}>
                <Text style={{ fontSize: 28 }}>🗑️</Text>
              </View>

              <Text style={{
                fontSize: 20, fontFamily: 'Nunito-Bold',
                color: C.textPrimary, marginBottom: 8, textAlign: 'center',
              }}>Supprimer l'événement</Text>

              <Text style={{
                fontSize: 14, fontFamily: 'DMSans-Regular',
                color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                marginBottom: 6, lineHeight: 20,
              }}>Êtes-vous sûr de vouloir supprimer</Text>
              <Text style={{
                fontSize: 15, fontFamily: 'Nunito-SemiBold',
                color: C.amber, textAlign: 'center',
                marginBottom: 24,
              }}>« {deleteConfirm?.title} »</Text>

              {/* Separator */}
              <LinearGradient
                colors={['transparent', 'rgba(255,80,80,0.25)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1, width: '100%', marginBottom: 20 }}
              />

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <Pressable
                  onPress={() => setDeleteConfirm(null)}
                  style={{
                    flex: 1, height: 50, borderRadius: 16,
                    backgroundColor: C.bgSurface,
                    borderWidth: 1, borderColor: C.amberBorder,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Text style={{
                    fontSize: 15, fontFamily: 'Nunito-Bold',
                    color: C.textSecondary,
                  }}>Annuler</Text>
                </Pressable>

                <Pressable
                  onPress={confirmDelete}
                  style={{
                    flex: 1, height: 50, borderRadius: 16,
                    overflow: 'hidden',
                  }}>
                  <LinearGradient
                    colors={['#FF5050', '#CC2020']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      flex: 1, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 16,
                      shadowColor: '#FF5050',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
                    }}>
                    <Text style={{
                      fontSize: 15, fontFamily: 'Nunito-Bold',
                      color: '#FFFFFF',
                    }}>Supprimer</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════
const labelStyle = {
  fontSize: 10,
  fontFamily: 'DMSans-Medium',
  color: 'rgba(245,166,35,0.6)',
  letterSpacing: 2,
  marginBottom: 8,
} as const;

const inputStyle = {
  backgroundColor: '#2E1A00',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(245,166,35,0.18)',
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 15,
  fontFamily: 'DMSans-Regular',
  color: '#FFFFFF',
  marginBottom: 16,
} as const;
