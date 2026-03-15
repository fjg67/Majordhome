import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Canvas, RoundedRect, Path, Line as SkLine, vec } from '@shopify/react-native-skia';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import type { Task } from '@appTypes/index';

// ─── Palette chocolat (existante) ───
const C = {
  bg: '#2C1810',
  bgLight: '#3D2418',
  card: '#4A2E1E',
  cardHigh: '#5A3828',
  border: 'rgba(255,200,130,0.12)',
  borderAccent: 'rgba(255,179,71,0.25)',
  accent: '#FFB347',
  accentSoft: 'rgba(255,179,71,0.15)',
  accentGlow: 'rgba(255,179,71,0.35)',
  cream: '#FFF5E6',
  creamSoft: 'rgba(255,245,230,0.7)',
  muted: 'rgba(255,245,230,0.35)',
  green: '#5CB85C',
  greenSoft: 'rgba(92,184,92,0.15)',
  red: '#E74C3C',
  redSoft: 'rgba(231,76,60,0.15)',
};

const PC: Record<string, string> = { high: C.red, medium: C.accent, low: C.green };
const PL: Record<string, string> = { high: '� Urgent', medium: '⚡ Moyen', low: '🍃 Non prioritaire' };
const CE: Record<string, string> = {
  cleaning: '🧹', cooking: '🍳', shopping: '🛒', general: '📋',
  garden: '🌿', repair: '🔧', pets: '🐾', health: '💊', storage: '📦', other: '⭐',
};
const CL: Record<string, string> = {
  cleaning: 'Ménage', cooking: 'Cuisine', shopping: 'Courses', general: 'Général',
  garden: 'Jardin', repair: 'Bricolage', pets: 'Animaux', health: 'Santé', storage: 'Rangement', other: 'Autre',
};

type Tab = 'today' | 'week' | 'all' | 'completed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Semaine' },
  { key: 'all', label: 'Toutes' },
  { key: 'completed', label: 'Faites ✓' },
];

const fmtDate = (d: string): string => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tom = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const yest = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  if (d === today) return "Aujourd'hui";
  if (d === tom) return 'Demain';
  if (d === yest) return 'Hier';
  const diff = Math.round((new Date(d).getTime() - now.getTime()) / 86400000);
  if (diff > 0 && diff <= 7) return `Dans ${diff}j`;
  if (diff < 0 && diff >= -7) return `Il y a ${-diff}j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const dateColor = (d: string): string => {
  const today = new Date().toISOString().split('T')[0];
  if (d < today) return C.red;
  if (d === today) return C.accent;
  return C.muted;
};

// ─── Add Task Modal ───
const QUICK_DATES = [
  { label: "Aujourd'hui", offset: 0 },
  { label: 'Demain', offset: 1 },
  { label: 'Dans 7j', offset: 7 },
];
const CAT_GRID = ['cleaning', 'cooking', 'shopping', 'garden', 'repair', 'pets', 'health', 'storage', 'other'];
const PRIORITIES = ['high', 'medium', 'low'] as const;

export const TaskListScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user = useAuthStore(s => s.user);
  const members = useAuthStore(s => s.members);
  const [tab, setTab] = useState<Tab>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [prioFilter, setPrioFilter] = useState<'high' | 'medium' | 'low' | 'missed' | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Modal state
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mDueDate, setMDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mCalYear, setMCalYear] = useState(() => new Date().getFullYear());
  const [mCalMonth, setMCalMonth] = useState(() => new Date().getMonth());
  const [mAssign, setMAssign] = useState<string | null>(null);
  const [mPriority, setMPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [mCategory, setMCategory] = useState('general');

  const load = useCallback(async () => {
    if (!household?.id) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const wEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    let q = supabase.from('tasks').select('*').eq('household_id', household.id)
      .order('due_date', { ascending: true });
    if (tab === 'today') q = q.eq('due_date', today).is('completed_at', null);
    else if (tab === 'week') q = q.gte('due_date', today).lte('due_date', wEnd).is('completed_at', null);
    else if (tab === 'all') q = q.is('completed_at', null);
    else q = q.not('completed_at', 'is', null).order('completed_at', { ascending: false });
    const { data } = await q;
    setTasks((data ?? []) as Task[]);
  }, [household?.id, tab]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('tasks', household.id, () => { load(); });
  }, [household?.id, load]);

  const toggle = useCallback(async (id: string, done: boolean) => {
    // Find current user's member.id
    const myMember = members.find(m => m.user_id === user?.id);
    const myMemberId = myMember?.id ?? null;
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed_at: done ? new Date().toISOString() : null, completed_by: done ? myMemberId : null } : t,
    ));
    await supabase.from('tasks').update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? myMemberId : null,
    }).eq('id', id);
    load();
  }, [load, user?.id, members]);

  const deleteTask = useCallback(async (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette tâche ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setTasks(prev => prev.filter(t => t.id !== id));
        await supabase.from('tasks').delete().eq('id', id);
      }},
    ]);
  }, []);

  const createTask = useCallback(async () => {
    if (!mTitle.trim() || !household?.id) return;
    await supabase.from('tasks').insert({
      household_id: household.id,
      created_by: user?.id ?? '',
      assigned_to: mAssign,
      title: mTitle.trim(),
      description: mDesc.trim() || null,
      due_date: mDueDate,
      priority: mPriority,
      category: mCategory,
    });
    setShowModal(false);
    setMTitle(''); setMDesc(''); setMDueDate(new Date().toISOString().split('T')[0]);
    setMCalYear(new Date().getFullYear()); setMCalMonth(new Date().getMonth());
    setMAssign(null); setMPriority('medium'); setMCategory('general');
    load();
  }, [mTitle, mDesc, mDueDate, mAssign, mPriority, mCategory, household?.id, user?.id, load]);

  // Find member by id (new format) or user_id (old format / created_by)
  const findMember = useCallback((id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id) ?? members.find(m => m.user_id === id) ?? null;
  }, [members]);

  const mN = (u: string | null) => findMember(u)?.display_name ?? null;
  const mC = (u: string | null) => findMember(u)?.color ?? C.accent;
  const mInit = (u: string | null) => {
    const name = mN(u);
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Map member.id -> member for filter matching
  const memberById = useMemo(() => {
    const map: Record<string, typeof members[0]> = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  // Find which member.id a task belongs to (via assigned_to or created_by)
  const taskMemberId = useCallback((t: Task): string | null => {
    // assigned_to is now member.id (new) or user_id (old)
    if (t.assigned_to) {
      const m = findMember(t.assigned_to);
      return m?.id ?? null;
    }
    // fallback to created_by (always user_id)
    const m = members.find(mem => mem.user_id === t.created_by);
    return m?.id ?? null;
  }, [members, findMember]);

  // Today string
  const todayStr = new Date().toISOString().split('T')[0];

  // Filtered tasks
  const filtered = useMemo(() => {
    let list = memberFilter ? tasks.filter(t => taskMemberId(t) === memberFilter) : tasks;
    if (prioFilter === 'missed') {
      list = list.filter(t => !t.completed_at && t.due_date < todayStr);
    } else if (prioFilter) {
      list = list.filter(t => t.priority === prioFilter);
    }
    return list;
  }, [tasks, memberFilter, prioFilter, taskMemberId, todayStr]);
  const todayStats = useMemo(() => {
    if (tab !== 'today') return null;
    const allToday = tasks;
    const done = allToday.filter(t => !!t.completed_at).length;
    const remaining = allToday.length - done;
    return { remaining, done, total: allToday.length };
  }, [tasks, tab]);

  const emptyMsg = useMemo(() => {
    switch (tab) {
      case 'today': return { icon: '🌟', title: 'Journée libre !', sub: 'Profite de ce moment de calme' };
      case 'week': return { icon: '✨', title: 'Semaine parfaite !', sub: 'Aucune tâche cette semaine' };
      case 'completed': return { icon: '📋', title: 'Rien de complété encore', sub: 'Les tâches terminées apparaîtront ici' };
      default: return { icon: '🎯', title: 'Aucune tâche', sub: 'Crée ta première tâche !' };
    }
  }, [tab]);

  // Missed count for badge
  const missedCount = useMemo(() =>
    tasks.filter(t => !t.completed_at && t.due_date < todayStr).length,
    [tasks, todayStr],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#1A0E00' }}>
      {/* Deep layered bg */}
      <LinearGradient colors={['#1A0E00', '#241300', '#1A0E00']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* Ambient glow top */}
      <View style={{
        position: 'absolute', top: -80, left: '25%' as any, width: 200, height: 200,
        borderRadius: 100, backgroundColor: 'rgba(245,166,35,0.06)',
      }} />

      {/* ══ HEADER ══ */}
      <Animated.View entering={FadeInDown.duration(500)}>
        <LinearGradient
          colors={['rgba(245,166,35,0.08)', 'rgba(245,166,35,0.02)', 'transparent']}
          style={{ paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 12,
                  backgroundColor: 'rgba(245,166,35,0.12)',
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 18 }}>✅</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: '#FFF5E6', letterSpacing: -0.8 }}>
                    Tâches
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: 'rgba(255,245,230,0.35)', marginTop: 6, marginLeft: 48 }}>
                {filtered.length === 0
                  ? 'Tout est fait · bravo ✨'
                  : `${filtered.length} tâche${filtered.length !== 1 ? 's' : ''}`}
                {missedCount > 0 ? ` · ${missedCount} en retard` : ''}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ══ STATS BAR (today only) ══ */}
      {todayStats && (
        <Animated.View entering={FadeInDown.delay(80).duration(500)}
          style={{ marginHorizontal: 16, marginBottom: 6 }}>
          <View style={{
            borderRadius: 20, overflow: 'hidden',
            borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
            shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
          }}>
            <LinearGradient
              colors={['rgba(245,166,35,0.08)', 'rgba(62,34,0,0.6)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 10 }}>
              {/* Remaining */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: 'rgba(245,166,35,0.12)',
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: '#FFB347' }}>{todayStats.remaining}</Text>
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito-SemiBold', color: 'rgba(255,245,230,0.40)', letterSpacing: 0.5 }}>RESTANTES</Text>
              </View>
              {/* Divider */}
              <View style={{ width: 1, backgroundColor: 'rgba(245,166,35,0.12)', marginVertical: 4 }} />
              {/* Completed */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: 'rgba(92,184,92,0.10)',
                  borderWidth: 1, borderColor: 'rgba(92,184,92,0.25)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: '#5CB85C' }}>{todayStats.done}</Text>
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito-SemiBold', color: 'rgba(255,245,230,0.40)', letterSpacing: 0.5 }}>FAITES</Text>
              </View>
              {/* Divider */}
              <View style={{ width: 1, backgroundColor: 'rgba(245,166,35,0.12)', marginVertical: 4 }} />
              {/* Total */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: '#FFF5E6' }}>{todayStats.total}</Text>
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito-SemiBold', color: 'rgba(255,245,230,0.40)', letterSpacing: 0.5 }}>TOTAL</Text>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      )}

      {/* ══ TAB FILTERS ══ */}
      <Animated.View entering={FadeInDown.delay(120).duration(500)}>
        <View style={{
          marginHorizontal: 16, marginTop: 6, marginBottom: 8,
          backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 4,
          borderWidth: 1, borderColor: 'rgba(245,166,35,0.08)',
          flexDirection: 'row',
        }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  backgroundColor: active ? '#FFB347' : 'transparent',
                  ...(active ? {
                    shadowColor: '#FFB347', shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                  } : {}),
                }}>
                <Text style={{
                  fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Medium',
                  color: active ? '#1A0E00' : 'rgba(255,245,230,0.45)',
                }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* ══ MEMBER + PRIORITY FILTER ROW ══ */}
      <Animated.View entering={FadeInDown.delay(180).duration(500)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
          {/* Member chips */}
          {members.length > 1 && (
            <>
              {members.map(m => {
                const sel = memberFilter === m.id;
                return (
                  <Pressable key={m.id} onPress={() => setMemberFilter(sel ? null : m.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 24,
                      backgroundColor: sel ? m.color + '20' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1.5, borderColor: sel ? m.color + '60' : 'rgba(255,255,255,0.08)',
                      ...(sel ? { shadowColor: m.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 } : {}),
                    }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: m.color + '40', borderWidth: 1.5, borderColor: m.color,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Nunito-Bold', color: m.color }}>
                        {m.display_name?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Medium', color: sel ? m.color : 'rgba(255,245,230,0.40)' }}>
                      {m.display_name}
                    </Text>
                  </Pressable>
                );
              })}
              {/* Divider dot */}
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(245,166,35,0.25)', alignSelf: 'center' }} />
            </>
          )}
          {/* Priority/status chips */}
          {[
            { key: 'high' as const, label: 'Urgent', emoji: '🔥', color: '#E74C3C' },
            { key: 'medium' as const, label: 'Moyen', emoji: '⚡', color: '#FFB347' },
            { key: 'low' as const, label: 'Tranquille', emoji: '🍃', color: '#5CB85C' },
            { key: 'missed' as const, label: 'En retard', emoji: '⏰', color: '#FF6B6B' },
          ].map(f => {
            const sel = prioFilter === f.key;
            const count = f.key === 'missed' ? missedCount :
              tasks.filter(t => t.priority === f.key && !t.completed_at).length;
            return (
              <Pressable key={f.key} onPress={() => setPrioFilter(sel ? null : f.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 11, paddingVertical: 7, borderRadius: 24,
                  backgroundColor: sel ? f.color + '20' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1.5, borderColor: sel ? f.color + '60' : 'rgba(255,255,255,0.08)',
                  ...(sel ? { shadowColor: f.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 } : {}),
                }}>
                <Text style={{ fontSize: 11 }}>{f.emoji}</Text>
                <Text style={{ fontSize: 11, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Medium', color: sel ? f.color : 'rgba(255,245,230,0.40)' }}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={{
                    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
                    backgroundColor: sel ? f.color + '35' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: sel ? f.color : 'rgba(255,245,230,0.40)' }}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ══ TASK LIST ══ */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}>
        {filtered.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(300).duration(600)} style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View style={{
              width: 110, height: 110, borderRadius: 30,
              backgroundColor: 'rgba(245,166,35,0.08)',
              borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              shadowColor: '#F5A623', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15, shadowRadius: 24, elevation: 4,
            }}>
              <Text style={{ fontSize: 48 }}>{emptyMsg.icon}</Text>
            </View>
            <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: '#FFF5E6', letterSpacing: -0.3 }}>{emptyMsg.title}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,245,230,0.35)', marginTop: 6 }}>{emptyMsg.sub}</Text>
            {tab !== 'completed' && (
              <Pressable onPress={() => setShowModal(true)} style={({ pressed }) => ({
                marginTop: 24, borderRadius: 16, overflow: 'hidden',
                transform: [{ scale: pressed ? 0.96 : 1 }],
                shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
              })}>
                <LinearGradient colors={['rgba(245,166,35,0.20)', 'rgba(245,166,35,0.08)']}
                  style={{
                    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16,
                    borderWidth: 1, borderColor: 'rgba(245,166,35,0.30)',
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}>
                  <Text style={{ fontSize: 16 }}>✨</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: '#FFB347' }}>Créer une tâche</Text>
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>
        ) : filtered.map((item, idx) => {
          const done = !!item.completed_at;
          const isMissed = !done && item.due_date < todayStr;
          const pc = isMissed ? '#FF6B6B' : (PC[item.priority] ?? C.accent);
          const assignee = findMember(item.assigned_to);
          const creator = members.find(m => m.user_id === item.created_by) ?? null;
          const person = assignee ?? creator;
          const personName = person?.display_name ?? null;
          const personColor = person?.color ?? C.accent;
          const personInitial = personName ? personName.charAt(0).toUpperCase() : '?';
          const completer = item.completed_by ? findMember(item.completed_by) : null;
          const completerName = completer && completer.id !== person?.id ? completer.display_name : null;
          const dueStr = fmtDate(item.due_date);
          const dc = isMissed ? '#FF6B6B' : dateColor(item.due_date);
          const catEmoji = CE[item.category] ?? '📋';

          return (
            <Animated.View key={item.id} entering={FadeInUp.delay(200 + idx * 35).duration(400).springify()}>
              <Pressable
                onPress={() => toggle(item.id, !done)}
                onLongPress={() => deleteTask(item.id)}
                style={({ pressed }) => ({
                  marginBottom: 10, borderRadius: 20, overflow: 'hidden',
                  backgroundColor: isMissed ? 'rgba(255,68,68,0.06)' : done ? 'rgba(255,255,255,0.02)' : '#2E1A00',
                  borderWidth: 1,
                  borderColor: isMissed ? 'rgba(255,107,107,0.22)' : done ? 'rgba(255,255,255,0.06)' : 'rgba(245,166,35,0.12)',
                  shadowColor: isMissed ? '#FF6B6B' : '#000',
                  shadowOffset: { width: 0, height: isMissed ? 4 : 6 },
                  shadowOpacity: isMissed ? 0.15 : 0.35, shadowRadius: isMissed ? 12 : 14, elevation: 5,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}>
                {/* Top highlight */}
                <LinearGradient
                  colors={isMissed
                    ? ['transparent', 'rgba(255,107,107,0.30)', 'transparent']
                    : done ? ['transparent', 'rgba(92,184,92,0.15)', 'transparent']
                    : ['transparent', 'rgba(245,166,35,0.25)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1 }}
                />

                {/* Left accent bar */}
                <View style={{
                  position: 'absolute', left: 0, top: 12, bottom: 12, width: 3.5, borderRadius: 2,
                  backgroundColor: pc,
                  shadowColor: pc, shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9, shadowRadius: 8, elevation: 3,
                }} />

                <View style={{ padding: 16, paddingLeft: 20 }}>
                  {/* Row 1: Category icon + Title + Checkbox */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Category circle */}
                    <View style={{
                      width: 36, height: 36, borderRadius: 12,
                      backgroundColor: done ? 'rgba(92,184,92,0.08)' : isMissed ? 'rgba(255,107,107,0.10)' : 'rgba(245,166,35,0.08)',
                      borderWidth: 1,
                      borderColor: done ? 'rgba(92,184,92,0.20)' : isMissed ? 'rgba(255,107,107,0.20)' : 'rgba(245,166,35,0.15)',
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 16 }}>{catEmoji}</Text>
                    </View>

                    {/* Title + badges */}
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text numberOfLines={1} style={{
                          fontSize: 15, fontFamily: 'Nunito-Bold', letterSpacing: -0.2,
                          color: done ? 'rgba(255,245,230,0.30)' : isMissed ? 'rgba(255,245,230,0.70)' : '#FFF5E6',
                          textDecorationLine: done ? 'line-through' : 'none',
                          flex: 1,
                        }}>{item.title}</Text>
                        {isMissed && (
                          <View style={{
                            backgroundColor: 'rgba(255,107,107,0.15)',
                            borderWidth: 1, borderColor: 'rgba(255,107,107,0.30)',
                            borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                          }}>
                            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 8, color: '#FF6B6B', letterSpacing: 0.8 }}>
                              EN RETARD
                            </Text>
                          </View>
                        )}
                      </View>
                      {item.description ? (
                        <Text numberOfLines={1} style={{
                          fontSize: 12, fontFamily: 'DMSans-Regular', color: 'rgba(255,245,230,0.30)', marginTop: 2,
                        }}>{item.description}</Text>
                      ) : null}
                    </View>

                    {/* Checkbox */}
                    <View style={{
                      width: 30, height: 30, borderRadius: 10, borderWidth: 2,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: done ? '#5CB85C' : 'transparent',
                      borderColor: done ? '#5CB85C' : isMissed ? 'rgba(255,107,107,0.35)' : 'rgba(245,166,35,0.30)',
                      ...(done ? { shadowColor: '#5CB85C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 } : {}),
                    }}>
                      {done && <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                    </View>
                  </View>

                  {/* Row 2: Metadata chips */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginLeft: 48, gap: 6, flexWrap: 'wrap' }}>
                    {/* Date chip */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: isMissed ? 'rgba(255,107,107,0.10)' : 'rgba(255,255,255,0.04)',
                      borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: isMissed ? 'rgba(255,107,107,0.18)' : 'rgba(255,255,255,0.06)',
                    }}>
                      <Text style={{ fontSize: 10 }}>📅</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Medium', color: dc }}>{dueStr}</Text>
                    </View>

                    {/* Category chip */}
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
                      paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
                    }}>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Medium', color: 'rgba(255,245,230,0.40)' }}>
                        {CL[item.category] ?? 'Général'}
                      </Text>
                    </View>

                    {/* Priority chip */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: pc + '12', borderRadius: 10,
                      paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: pc + '25',
                    }}>
                      <Text style={{ fontSize: 10 }}>
                        {item.priority === 'high' ? '🔥' : item.priority === 'medium' ? '⚡' : '🍃'}
                      </Text>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Medium', color: pc }}>
                        {item.priority === 'high' ? 'Urgent' : item.priority === 'medium' ? 'Moyen' : 'Tranquille'}
                      </Text>
                    </View>

                    {/* Assignee */}
                    {personName && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 5 }}>
                        <View style={{
                          width: 22, height: 22, borderRadius: 8,
                          backgroundColor: personColor + '25',
                          borderWidth: 1.5, borderColor: personColor + '60',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: personColor }}>{personInitial}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Medium', color: personColor + 'CC' }}>
                          {personName}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Completed by */}
                  {completerName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 48, gap: 4 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Medium', color: completer?.color ?? C.accent }}>
                        ✓ fait par {completerName}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* ══ FAB ══ */}
      <Animated.View entering={FadeInUp.delay(400).duration(500).springify()}
        style={{ position: 'absolute', bottom: 90, right: 20 }}>
        <Pressable onPress={() => setShowModal(true)} style={({ pressed }) => ({
          width: 60, height: 60, borderRadius: 20,
          shadowColor: '#F5A623', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6, shadowRadius: 20, elevation: 14,
          transform: [{ scale: pressed ? 0.90 : 1 }],
        })}>
          <LinearGradient colors={['#FFB347', '#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 60, height: 60, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
            }}>
            <Text style={{ fontSize: 30, color: '#1A0E00', fontWeight: '800', marginTop: -2 }}>+</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ── Add Task Modal — Premium Dark Amber ── */}
      <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#261400', borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingBottom: 40, maxHeight: '90%',
            borderTopWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
          }}>
            {/* Highlight line */}
            <LinearGradient
              colors={['transparent', 'rgba(245,166,35,0.40)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1, position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
            />

            {/* Drag indicator */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,166,35,0.30)' }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {/* Title */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Canvas style={{ width: 24, height: 24 }}>
                  <RoundedRect x={2} y={2} width={20} height={20} r={5}
                    style="stroke" strokeWidth={1.8} color="#F5A623" />
                  <Path path="M7 12 L10 15 L17 8" style="stroke" strokeWidth={1.8}
                    color="#F5A623" strokeCap="round" />
                </Canvas>
                <Text style={{ fontSize: 24, fontFamily: 'Nunito-Bold', color: '#FFFFFF', letterSpacing: -0.5 }}>
                  Nouvelle tâche
                </Text>
              </View>

              {/* ── NOM ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>NOM</Text>
              <TextInput
                style={{
                  backgroundColor: '#2E1A00', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15,
                  color: '#FFFFFF', fontFamily: 'DMSans-Regular', fontSize: 15,
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', marginBottom: 18,
                }}
                placeholder="Ex: Faire la vaisselle..." placeholderTextColor="rgba(255,255,255,0.25)"
                value={mTitle} onChangeText={setMTitle}
              />

              {/* ── DESCRIPTION ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>DESCRIPTION (optionnel)</Text>
              <TextInput
                style={{
                  backgroundColor: '#2E1A00', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15,
                  color: '#FFFFFF', fontFamily: 'DMSans-Regular', fontSize: 14,
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', marginBottom: 18, minHeight: 70,
                  textAlignVertical: 'top',
                }}
                placeholder="Détails..." placeholderTextColor="rgba(255,255,255,0.25)"
                value={mDesc} onChangeText={setMDesc} multiline numberOfLines={3}
              />

              {/* ── ÉCHÉANCE — Quick presets + Calendar ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>ÉCHÉANCE</Text>

              {/* Quick presets */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {QUICK_DATES.map((d) => {
                  const dateStr = new Date(Date.now() + d.offset * 86400000).toISOString().split('T')[0];
                  const sel = mDueDate === dateStr;
                  return (
                    <Pressable key={d.label} onPress={() => {
                      setMDueDate(dateStr);
                      const dt = new Date(dateStr);
                      setMCalYear(dt.getFullYear()); setMCalMonth(dt.getMonth());
                    }}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
                        backgroundColor: sel ? '#F5A623' : '#2E1A00',
                        borderWidth: 1.5, borderColor: sel ? '#F5A623' : 'rgba(245,166,35,0.22)',
                        ...(sel ? { shadowColor: '#F5A623', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 } : {}),
                      }}>
                      <Text style={{
                        fontSize: 12, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Medium',
                        color: sel ? '#1A0E00' : 'rgba(255,255,255,0.6)',
                      }}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Inline mini calendar */}
              {(() => {
                const DAYS_H = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                const firstDay = new Date(mCalYear, mCalMonth, 1);
                let startDay = firstDay.getDay() - 1;
                if (startDay < 0) startDay = 6;
                const daysInMonth = new Date(mCalYear, mCalMonth + 1, 0).getDate();
                const grid: (number | null)[] = [];
                for (let i = 0; i < startDay; i++) grid.push(null);
                for (let d = 1; d <= daysInMonth; d++) grid.push(d);
                while (grid.length % 7 !== 0) grid.push(null);
                const todayStr2 = new Date().toISOString().split('T')[0];

                return (
                  <View style={{
                    backgroundColor: '#2E1A00', borderRadius: 20,
                    borderWidth: 1, borderColor: 'rgba(245,166,35,0.20)',
                    padding: 14, marginBottom: 18,
                  }}>
                    {/* Month nav */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Pressable onPress={() => {
                        if (mCalMonth === 0) { setMCalYear(y => y - 1); setMCalMonth(11); }
                        else setMCalMonth(m => m - 1);
                      }} style={{
                        width: 30, height: 30, borderRadius: 10,
                        backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.22)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#F5A623', fontSize: 12 }}>◀</Text>
                      </Pressable>
                      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 15, color: '#F5A623' }}>
                        {MONTHS_FR[mCalMonth]} {mCalYear}
                      </Text>
                      <Pressable onPress={() => {
                        if (mCalMonth === 11) { setMCalYear(y => y + 1); setMCalMonth(0); }
                        else setMCalMonth(m => m + 1);
                      }} style={{
                        width: 30, height: 30, borderRadius: 10,
                        backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.22)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#F5A623', fontSize: 12 }}>▶</Text>
                      </Pressable>
                    </View>

                    {/* Day headers */}
                    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                      {DAYS_H.map((d, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                          <Text style={{
                            fontFamily: 'Nunito-SemiBold', fontSize: 10, letterSpacing: 1,
                            color: i >= 5 ? 'rgba(245,166,35,0.45)' : 'rgba(255,255,255,0.30)',
                          }}>{d}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {grid.map((day, i) => {
                        if (day === null) return <View key={i} style={{ width: '14.28%' as any, height: 38 }} />;
                        const dateStr = `${mCalYear}-${String(mCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateStr === mDueDate;
                        const isToday = dateStr === todayStr2;
                        const isPast = dateStr < todayStr2;
                        const isWeekend = (i % 7) >= 5;

                        return (
                          <Pressable key={i} onPress={() => !isPast && setMDueDate(dateStr)}
                            style={{
                              width: '14.28%' as any, height: 38,
                              alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                              backgroundColor: isSelected ? '#F5A623' : 'transparent',
                              borderWidth: isToday && !isSelected ? 1.5 : 0,
                              borderColor: 'rgba(245,166,35,0.55)',
                              ...(isSelected ? { shadowColor: '#F5A623', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 } : {}),
                            }}>
                            <Text style={{
                              fontFamily: isToday || isSelected ? 'Nunito-Bold' : 'DMSans-Regular',
                              fontSize: 14,
                              color: isSelected ? '#1A0E00'
                                : isPast ? 'rgba(255,255,255,0.15)'
                                : isToday ? '#F5A623'
                                : isWeekend ? 'rgba(245,166,35,0.50)'
                                : 'rgba(255,255,255,0.70)',
                            }}>{day}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Selected date display */}
                    <View style={{
                      marginTop: 10, paddingTop: 10,
                      borderTopWidth: 1, borderTopColor: 'rgba(245,166,35,0.12)',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#F5A623' }}>
                        📅 {new Date(mDueDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* ── ASSIGNER À ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>ASSIGNER À</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}
                contentContainerStyle={{ gap: 8 }}>
                <Pressable onPress={() => setMAssign(null)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14,
                    backgroundColor: !mAssign ? 'rgba(245,166,35,0.15)' : '#2E1A00',
                    borderWidth: 1.5, borderColor: !mAssign ? 'rgba(245,166,35,0.35)' : 'rgba(245,166,35,0.18)',
                  }}>
                  <Text style={{ fontSize: 13, fontFamily: !mAssign ? 'Nunito-Bold' : 'DMSans-Medium', color: !mAssign ? '#F5A623' : 'rgba(255,255,255,0.35)' }}>Personne</Text>
                </Pressable>
                {members.map(m => {
                  const sel = mAssign === m.id;
                  const mc = m.color || '#F5A623';
                  return (
                    <Pressable key={m.id} onPress={() => setMAssign(m.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
                        backgroundColor: sel ? mc + '22' : '#2E1A00',
                        borderWidth: 1.5, borderColor: sel ? mc : 'rgba(245,166,35,0.18)',
                        ...(sel ? { shadowColor: mc, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3 } : {}),
                      }}>
                      <View style={{
                        width: 24, height: 24, borderRadius: 8,
                        backgroundColor: mc + '30', borderWidth: 1.5, borderColor: mc,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 11 }}>{m.avatar_emoji ?? '👤'}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: sel ? 'Nunito-SemiBold' : 'DMSans-Medium', color: sel ? mc : 'rgba(255,255,255,0.45)' }}>{m.display_name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ── PRIORITÉ ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>PRIORITÉ</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {PRIORITIES.map(p => {
                  const sel = mPriority === p;
                  const col = PC[p];
                  return (
                    <Pressable key={p} onPress={() => setMPriority(p)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
                        backgroundColor: sel ? col + '22' : '#2E1A00',
                        borderWidth: 1.5, borderColor: sel ? col : 'rgba(245,166,35,0.18)',
                        ...(sel ? { shadowColor: col, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3 } : {}),
                      }}>
                      <Text style={{ fontSize: 13, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Medium', color: sel ? col : 'rgba(255,255,255,0.35)' }}>{PL[p]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ── CATÉGORIE ── */}
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.65)', letterSpacing: 2.5, marginBottom: 8 }}>CATÉGORIE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {CAT_GRID.map(cat => {
                  const sel = mCategory === cat;
                  return (
                    <Pressable key={cat} onPress={() => setMCategory(cat)}
                      style={{
                        width: '30%' as any, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
                        backgroundColor: sel ? 'rgba(245,166,35,0.15)' : '#2E1A00',
                        borderWidth: 1.5, borderColor: sel ? 'rgba(245,166,35,0.35)' : 'rgba(245,166,35,0.18)',
                        ...(sel ? { shadowColor: '#F5A623', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 } : {}),
                      }}>
                      <Text style={{ fontSize: 20, marginBottom: 3 }}>{CE[cat]}</Text>
                      <Text style={{ fontSize: 10, fontFamily: sel ? 'Nunito-SemiBold' : 'DMSans-Regular', color: sel ? '#F5A623' : 'rgba(255,255,255,0.35)' }}>{CL[cat]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ── Submit ── */}
              <Pressable onPress={createTask} style={({ pressed }) => ({
                borderRadius: 18, overflow: 'hidden', marginBottom: 16, opacity: !mTitle.trim() ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                shadowColor: '#F5A623', shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
              })}>
                <LinearGradient colors={['#F5A623', '#E8920A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 17, alignItems: 'center', borderRadius: 18, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>✨</Text>
                  <Text style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Créer la tâche</Text>
                </LinearGradient>
              </Pressable>

              {/* ── Cancel ── */}
              <Pressable onPress={() => setShowModal(false)} style={{ alignItems: 'center', paddingBottom: 10 }}>
                <Text style={{ fontSize: 14, fontFamily: 'DMSans-Medium', color: 'rgba(255,255,255,0.30)' }}>Annuler</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
