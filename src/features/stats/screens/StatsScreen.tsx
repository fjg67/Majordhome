import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Dimensions, StatusBar, Platform,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOut,
  useAnimatedStyle, useSharedValue, withTiming, withDelay,
  withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import {
  Canvas, Path, Circle, Group, vec, Line as SkiaLine, RoundedRect,
  LinearGradient as SkiaGradient,
} from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import type { Task, HouseholdMember, TaskCategory } from '@appTypes/index';

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

  chartGrid:   'rgba(255,255,255,0.06)',
  success:     '#34D399',
  warning:     '#FF8C00',
  danger:      '#FF6B6B',
};

const MEMBER_COLORS = [C.member1, C.member2, C.member3, C.member4, C.amber, '#87CEEB'];

// ═══════════════════════════════════════════════════════════
// TYPES & CONFIG
// ═══════════════════════════════════════════════════════════
type Period = 'week' | 'month' | '3months';

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'week', label: 'Semaine', days: 7 },
  { key: 'month', label: 'Mois', days: 30 },
  { key: '3months', label: '3 mois', days: 90 },
];

const DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

const TASK_CAT_CFG: Record<string, { emoji: string; label: string; color: string }> = {
  cleaning: { emoji: '🧹', label: 'Ménage', color: C.member2 },
  cooking:  { emoji: '🍳', label: 'Cuisine', color: C.amber },
  shopping: { emoji: '🛒', label: 'Courses', color: C.member3 },
  general:  { emoji: '📋', label: 'Général', color: C.member4 },
};

const rateColor = (r: number) => r <= 30 ? C.danger : r <= 70 ? C.amber : C.success;
const rateGradient = (r: number): [string, string] =>
  r <= 30 ? [C.danger, C.warning] : r <= 70 ? [C.amber, '#FFD700'] : [C.success, C.amber];

// ═══════════════════════════════════════════════════════════
// HELPER — Period subtitle
// ═══════════════════════════════════════════════════════════
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const periodSubtitle = (p: Period): string => {
  const now = new Date();
  if (p === 'week') {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `Cette semaine · du ${mon.getDate()} au ${sun.getDate()} ${MONTH_NAMES[sun.getMonth()]}`;
  }
  if (p === 'month') return `Ce mois · ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const start = new Date(now); start.setMonth(now.getMonth() - 2);
  return `3 derniers mois · ${MONTH_NAMES[start.getMonth()]}–${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Animated Counter
// ═══════════════════════════════════════════════════════════
const CountUp: React.FC<{
  to: number; suffix?: string; color: string; size?: number;
  delay?: number;
}> = ({ to, suffix = '', color, size = 38, delay = 0 }) => {
  const val = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    val.value = 0;
    val.value = withDelay(delay, withTiming(to, { duration: 600, easing: Easing.out(Easing.cubic) }));
    // Simple counter display update
    let frame: ReturnType<typeof setTimeout>;
    const start = Date.now();
    const dur = 600;
    const tick = () => {
      const elapsed = Date.now() - (start + delay);
      if (elapsed < 0) { frame = setTimeout(tick, 16); return; }
      const p = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * to));
      if (p < 1) frame = setTimeout(tick, 16);
    };
    frame = setTimeout(tick, 16);
    return () => clearTimeout(frame);
  }, [to, delay, val]);

  return (
    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: size, color, fontWeight: '800' }}>
      {display}{suffix}
    </Text>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Animated Bar
// ═══════════════════════════════════════════════════════════
const AnimBar: React.FC<{
  pct: number; h: number; color: string; colorEnd?: string;
  delay?: number; radius?: number;
}> = ({ pct, h, color, colorEnd, delay = 0, radius = 3 }) => {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = 0;
    w.value = withDelay(delay, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }));
    return () => { w.value = 0; };
  }, [pct, delay, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` as unknown as number }));
  return (
    <View style={{ height: h, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <Animated.View style={[style, { height: '100%', borderRadius: radius, overflow: 'hidden' }]}>
        <LinearGradient
          colors={[color, colorEnd ?? color]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Skia Donut
// ═══════════════════════════════════════════════════════════
const donutArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number): string => {
  const toRad = (a: number) => (a - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

const SkiaDonut: React.FC<{
  data: { value: number; color: string }[];
  size: number; thickness: number;
}> = ({ data, size, thickness }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  let startAngle = 0;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Track */}
      <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={thickness} color="rgba(255,255,255,0.06)" />
      {/* Segments */}
      {data.map((d, i) => {
        const sweep = (d.value / total) * 359.9;
        const endAngle = startAngle + sweep;
        const path = donutArc(cx, cy, r, startAngle, endAngle);
        startAngle = endAngle;
        return (
          <Path key={i} path={path} style="stroke"
            strokeWidth={thickness} strokeCap="round" color={d.color}
          />
        );
      })}
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Skia Bar Chart
// ═══════════════════════════════════════════════════════════
const SkiaBarChart: React.FC<{
  data: { label: string; values: { color: string; count: number }[] }[];
  height: number;
}> = ({ data, height }) => {
  const chartW = SW - 72;
  const maxVal = Math.max(...data.flatMap(d => d.values.map(v => v.count)), 1);
  const groupW = chartW / data.length;
  const barW = data.length > 0 && data[0].values.length > 0
    ? Math.min(12, (groupW - 8) / Math.max(data[0].values.length, 1))
    : 10;

  return (
    <View>
      <Canvas style={{ width: chartW, height, alignSelf: 'center' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <SkiaLine key={f}
            p1={vec(0, height * (1 - f))} p2={vec(chartW, height * (1 - f))}
            style="stroke" strokeWidth={1} color="rgba(255,255,255,0.04)"
          />
        ))}
        {/* Bars */}
        {data.map((group, gi) => {
          const gx = gi * groupW + groupW / 2;
          return group.values.map((v, vi) => {
            const bh = maxVal > 0 ? (v.count / maxVal) * (height - 20) : 0;
            const totalBarsW = group.values.length * barW + (group.values.length - 1) * 2;
            const bx = gx - totalBarsW / 2 + vi * (barW + 2);
            return (
              <RoundedRect key={`${gi}-${vi}`}
                x={bx} y={height - bh} width={barW} height={Math.max(bh, 2)} r={3}
                color={v.color} opacity={0.85}
              />
            );
          });
        })}
        {/* X axis line */}
        <SkiaLine p1={vec(0, height)} p2={vec(chartW, height)}
          style="stroke" strokeWidth={1} color="rgba(255,255,255,0.1)" />
      </Canvas>
      {/* X labels */}
      <View style={{ flexDirection: 'row', width: chartW, alignSelf: 'center', marginTop: 4 }}>
        {data.map((g, i) => (
          <Text key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'DMSans-Regular', fontSize: 9, color: 'rgba(255,255,255,0.35)',
          }}>{g.label}</Text>
        ))}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPONENT — Insight Card
// ═══════════════════════════════════════════════════════════
const InsightCard: React.FC<{ emoji: string; text: string }> = ({ emoji, text }) => (
  <View style={{
    width: 220, borderRadius: 16, borderWidth: 1,
    borderColor: C.amberBorder, backgroundColor: 'rgba(245,166,35,0.06)',
    padding: 14, marginRight: 10,
  }}>
    <Text style={{ fontSize: 24 }}>{emoji}</Text>
    <Text numberOfLines={3} style={{
      fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.75)',
      marginTop: 8, lineHeight: 18,
    }}>{text}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const StatsScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const members: HouseholdMember[] = useAuthStore(s => s.members) ?? [];
  const [period, setPeriod] = useState<Period>('month');
  const [tasks, setTasks] = useState<Task[]>([]);

  // ─── Data Loading ──────────────────────────────────────
  const load = useCallback(async () => {
    if (!household?.id) return;
    const days = PERIODS.find(p => p.key === period)?.days ?? 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase.from('tasks').select('*')
      .eq('household_id', household.id)
      .gte('created_at', since);
    setTasks((data ?? []) as Task[]);
  }, [household?.id, period]);

  useEffect(() => { load(); }, [load]);

  // ─── Real-time subscription ─────────────────────────────
  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('tasks', household.id, () => { load(); });
  }, [household?.id, load]);

  // ─── Computed Stats ────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed_at).length;
    const rate = total ? Math.round((done / total) * 100) : 0;

    const byMember: Record<string, { total: number; done: number; byCat: Record<string, number> }> = {};
    tasks.forEach(t => {
      const uid = t.assigned_to ?? t.created_by;
      if (!byMember[uid]) byMember[uid] = { total: 0, done: 0, byCat: {} };
      byMember[uid].total++;
      if (t.completed_at) {
        byMember[uid].done++;
        const cat = t.category || 'general';
        byMember[uid].byCat[cat] = (byMember[uid].byCat[cat] || 0) + 1;
      }
    });

    const memberStats = members.map((m, idx) => {
      const s = byMember[m.user_id] ?? { total: 0, done: 0, byCat: {} };
      return {
        ...m,
        total: s.total,
        done: s.done,
        rate: s.total ? Math.round((s.done / s.total) * 100) : 0,
        byCat: s.byCat,
        memberColor: m.color || MEMBER_COLORS[idx % MEMBER_COLORS.length],
      };
    }).sort((a, b) => b.done - a.done);

    const topMember = memberStats[0];
    const topCount = topMember?.done ?? 0;

    return { total, done, rate, topMember, topCount, memberStats, byMember };
  }, [tasks, members]);

  // ─── Weekly/daily breakdown ────────────────────────────
  const barData = useMemo(() => {
    if (tasks.length === 0) return [];
    const labels = period === 'week' ? DAY_LABELS : period === 'month'
      ? ['S1', 'S2', 'S3', 'S4'] : ['M1', 'M2', 'M3'];

    const memberList = stats.memberStats.slice(0, 4);

    return labels.map((label, li) => ({
      label,
      values: memberList.map(m => {
        const memberTasks = tasks.filter(t => {
          const uid = t.assigned_to ?? t.created_by;
          if (uid !== m.user_id || !t.completed_at) return false;
          const d = new Date(t.completed_at);
          if (period === 'week') {
            return d.getDay() === ((li + 1) % 7); // Mon=0→Sun=6
          } else if (period === 'month') {
            const weekNum = Math.floor((d.getDate() - 1) / 7);
            return weekNum === li;
          } else {
            const monthsAgo = (new Date().getMonth() - d.getMonth() + 12) % 12;
            return monthsAgo === (2 - li);
          }
        });
        return { color: m.memberColor, count: memberTasks.length };
      }),
    }));
  }, [tasks, period, stats.memberStats]);

  // ─── Donut data ────────────────────────────────────────
  const donutData = useMemo(() =>
    stats.memberStats.filter(m => m.done > 0).map(m => ({
      value: m.done, color: m.memberColor, name: m.display_name,
    })),
  [stats.memberStats]);

  // ─── Insights ──────────────────────────────────────────
  const insights = useMemo(() => {
    const ins: { emoji: string; text: string }[] = [];
    if (stats.topMember && stats.topCount > 0) {
      ins.push({ emoji: '🏆', text: `${stats.topMember.display_name} mène avec ${stats.topCount} tâches complétées cette période` });
    }
    if (stats.rate >= 80) {
      ins.push({ emoji: '🔥', text: `Le foyer est à ${stats.rate}% de complétion — excellent travail d'équipe !` });
    }
    if (stats.rate > 0 && stats.rate < 50) {
      ins.push({ emoji: '📈', text: `${stats.rate}% de complétion — il reste ${stats.total - stats.done} tâches à terminer` });
    }
    const topCat = Object.entries(
      tasks.filter(t => t.completed_at).reduce<Record<string, number>>((a, t) => {
        a[t.category || 'general'] = (a[t.category || 'general'] || 0) + 1;
        return a;
      }, {})
    ).sort(([, a], [, b]) => b - a)[0];
    if (topCat) {
      const cfg = TASK_CAT_CFG[topCat[0]];
      ins.push({ emoji: cfg?.emoji ?? '📋', text: `La catégorie "${cfg?.label ?? topCat[0]}" est la plus active avec ${topCat[1]} tâches` });
    }
    if (ins.length === 0) {
      ins.push({ emoji: '✨', text: 'Ajoute plus de tâches pour voir tes insights personnalisés' });
    }
    return ins;
  }, [stats, tasks]);

  // ─── Crown pulse animation ─────────────────────────────
  const crownScale = useSharedValue(1);
  useEffect(() => {
    crownScale.value = withRepeat(withSequence(
      withTiming(1.15, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
    ), -1, true);
    return () => { crownScale.value = 1; };
  }, [crownScale]);
  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: crownScale.value }],
  }));

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* ══════ HEADER ══════ */}
      <Animated.View entering={FadeInDown.duration(400)} style={{
        paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingHorizontal: 20, paddingBottom: 6,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Canvas style={{ width: 28, height: 28 }}>
            <RoundedRect x={2} y={12} width={6} height={14} r={2} color="rgba(255,107,107,0.85)" />
            <RoundedRect x={11} y={4} width={6} height={22} r={2} color={C.amber} />
            <RoundedRect x={20} y={8} width={6} height={18} r={2} color="rgba(52,211,153,0.85)" />
            <SkiaLine p1={vec(0, 27)} p2={vec(28, 27)}
              style="stroke" strokeWidth={1} color="rgba(255,255,255,0.3)" />
          </Canvas>
          <Text style={{
            fontFamily: 'Nunito-Bold', fontSize: 30, color: C.textPrimary,
            letterSpacing: -0.5, marginLeft: 10,
          }}>Statistiques</Text>
        </View>
        <Text style={{
          fontFamily: 'DMSans-Regular', fontSize: 13,
          color: 'rgba(255,255,255,0.45)', marginTop: 2, marginLeft: 38,
        }}>{periodSubtitle(period)}</Text>
      </Animated.View>

      {/* ══════ PERIOD SELECTOR ══════ */}
      <Animated.View entering={FadeIn.delay(80).duration(300)}
        style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}
      >
        {PERIODS.map(p => {
          const active = period === p.key;
          return (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={{
              borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
              backgroundColor: active ? C.amber : C.bgElevated,
              borderWidth: active ? 0 : 1,
              borderColor: 'rgba(245,166,35,0.18)',
              ...(active ? {
                shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
              } : {}),
            }}>
              <Text style={{
                fontFamily: active ? 'Nunito-Bold' : 'DMSans-Medium',
                fontSize: 13, color: active ? C.bgDeep : 'rgba(255,255,255,0.48)',
              }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* ══════ MAIN SCROLL ══════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        {/* ══════ SECTION 1 — VUE D'ENSEMBLE ══════ */}
        <Animated.View entering={FadeInUp.delay(160).duration(400)} style={{
          backgroundColor: C.bgSurface, borderRadius: 22, borderWidth: 1,
          borderColor: 'rgba(245,166,35,0.20)', overflow: 'hidden', marginBottom: 14,
          shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
        }}>
          <LinearGradient colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
          <View style={{ padding: 20 }}>
            {/* Section title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <Canvas style={{ width: 16, height: 16 }}>
                <Circle cx={8} cy={8} r={6} style="stroke" strokeWidth={1.5} color="rgba(245,166,35,0.7)" />
                <Circle cx={8} cy={8} r={2} color="rgba(245,166,35,0.7)" />
              </Canvas>
              <Text style={{
                fontFamily: 'Nunito-SemiBold', fontSize: 15,
                color: 'rgba(255,255,255,0.7)', marginLeft: 8,
              }}>Vue d'ensemble</Text>
            </View>

            {tasks.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 20 }}>
                Aucune donnée pour cette période
              </Text>
            ) : (
              <>
                {/* Stats row */}
                <View style={{ flexDirection: 'row', marginBottom: 18 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <CountUp to={stats.total} color={C.textPrimary} delay={200} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Canvas style={{ width: 12, height: 12 }}>
                        <Path path="M3 3 L9 3 M3 6 L9 6 M3 9 L9 9" style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.3)" strokeCap="round" />
                      </Canvas>
                      <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Total</Text>
                    </View>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <CountUp to={stats.done} color={C.success} delay={300} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Canvas style={{ width: 12, height: 12 }}>
                        <Path path="M2 6 L5 9 L10 3" style="stroke" strokeWidth={1.5} color={C.success} strokeCap="round" />
                      </Canvas>
                      <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Terminées</Text>
                    </View>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <CountUp to={stats.rate} suffix="%" color={rateColor(stats.rate)} delay={400} />
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Complétion</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={{ marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Progression globale</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: rateColor(stats.rate) }}>{stats.rate}%</Text>
                  </View>
                  <AnimBar pct={stats.rate} h={8} color={rateGradient(stats.rate)[0]} colorEnd={rateGradient(stats.rate)[1]} delay={400} radius={4} />
                </View>

                {/* Mini sparkline (daily completions) */}
                <View style={{ marginTop: 16 }}>
                  <Canvas style={{ width: SW - 72, height: 50, alignSelf: 'center' }}>
                    {/* Grid */}
                    {[0.33, 0.66].map(f => (
                      <SkiaLine key={f}
                        p1={vec(0, 50 * (1 - f))} p2={vec(SW - 72, 50 * (1 - f))}
                        style="stroke" strokeWidth={1} color="rgba(255,255,255,0.04)"
                      />
                    ))}
                    {/* Simple dots for last 7 days */}
                    {(() => {
                      const w = SW - 72;
                      const pts: number[] = [];
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date(); d.setDate(d.getDate() - i);
                        const ds = d.toISOString().split('T')[0];
                        const ct = tasks.filter(t => t.completed_at?.startsWith(ds)).length;
                        pts.push(ct);
                      }
                      const max = Math.max(...pts, 1);
                      return pts.map((v, i) => {
                        const x = (i / 6) * (w - 16) + 8;
                        const y = 46 - (v / max) * 40;
                        return <Circle key={i} cx={x} cy={y} r={3} color={C.amber} />;
                      });
                    })()}
                  </Canvas>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 }}>
                    {DAY_LABELS.map(l => (
                      <Text key={l} style={{ fontFamily: 'DMSans-Regular', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{l}</Text>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* ══════ SECTION 2 — TOP CONTRIBUTEUR ══════ */}
        {stats.topMember && stats.topCount > 0 && (
          <Animated.View entering={FadeInUp.delay(320).duration(400)} style={{
            backgroundColor: C.bgSurface, borderRadius: 22, borderWidth: 1,
            borderColor: C.amberBorder, overflow: 'hidden', marginBottom: 14,
            shadowColor: C.amber, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18, shadowRadius: 20, elevation: 8,
          }}>
            <LinearGradient colors={['transparent', 'rgba(245,166,35,0.5)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
            <View style={{ padding: 20 }}>
              {/* Title */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Canvas style={{ width: 20, height: 20 }}>
                  <Path path="M3 8 L5 3 L10 5 L15 3 L17 8 L14 14 L6 14 Z"
                    color={C.amber} />
                  <Path path="M6 14 L6 17 L14 17 L14 14" style="stroke" strokeWidth={1.5} color={C.amber} />
                </Canvas>
                <Text style={{
                  fontFamily: 'Nunito-SemiBold', fontSize: 15,
                  color: 'rgba(255,255,255,0.7)', marginLeft: 8,
                }}>Top contributeur</Text>
              </View>

              {/* Winner card */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(245,166,35,0.06)', borderRadius: 16,
                borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', padding: 14,
              }}>
                {/* Avatar + crown */}
                <View style={{ position: 'relative' }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: (stats.topMember.memberColor || C.amber) + '33',
                    borderWidth: 2, borderColor: stats.topMember.memberColor || C.amber,
                  }}>
                    <Text style={{ fontSize: 24 }}>{stats.topMember.avatar_emoji || '👤'}</Text>
                  </View>
                  <Animated.View style={[crownStyle, {
                    position: 'absolute', top: -10, right: -6,
                  }]}>
                    <Text style={{ fontSize: 16 }}>👑</Text>
                  </Animated.View>
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 20, color: C.textPrimary }}>
                    {stats.topMember.display_name}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                    {stats.topCount} tâche{stats.topCount !== 1 ? 's' : ''} terminée{stats.topCount !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Score */}
                <View style={{ alignItems: 'center' }}>
                  <CountUp to={stats.topCount} color={C.amber} size={36} delay={400} />
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(245,166,35,0.6)' }}>pts</Text>
                </View>
              </View>

              {/* Mini podium */}
              {stats.memberStats.length >= 2 && (
                <View style={{
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
                  gap: 12, marginTop: 18,
                }}>
                  {stats.memberStats.slice(0, 3).map((m, i) => {
                    const heights = [80, 64, 52];
                    const medals = ['🥇', '🥈', '🥉'];
                    const order = stats.memberStats.length >= 3 ? [1, 0, 2] : [1, 0];
                    const displayIdx = order[i];
                    if (displayIdx === undefined) return null;
                    const mem = stats.memberStats[displayIdx];
                    if (!mem) return null;
                    return (
                      <Animated.View key={mem.user_id}
                        entering={FadeInUp.delay(450 + displayIdx * 100).duration(400).springify()}
                        style={{ alignItems: 'center' }}
                      >
                        <View style={{
                          width: 32, height: 32, borderRadius: 10,
                          backgroundColor: (mem.memberColor) + '33',
                          borderWidth: 1.5, borderColor: mem.memberColor,
                          alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                        }}>
                          <Text style={{ fontSize: 14 }}>{mem.avatar_emoji || '👤'}</Text>
                        </View>
                        <Text style={{ fontSize: 14 }}>{medals[displayIdx]}</Text>
                        <View style={{
                          width: 50, height: heights[displayIdx],
                          borderTopLeftRadius: 8, borderTopRightRadius: 8,
                          backgroundColor: mem.memberColor + '22',
                          borderWidth: 1, borderBottomWidth: 0,
                          borderColor: mem.memberColor + '44',
                          alignItems: 'center', justifyContent: 'center', marginTop: 4,
                        }}>
                          <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: mem.memberColor }}>
                            {mem.done}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ══════ SECTION 3 — PAR MEMBRE ══════ */}
        <Animated.View entering={FadeInUp.delay(480).duration(350)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
            <Canvas style={{ width: 16, height: 16 }}>
              <Circle cx={5} cy={6} r={3} style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.5)" />
              <Circle cx={11} cy={6} r={3} style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.5)" />
              <Path path="M1 14 Q5 10 8 14 M8 14 Q11 10 15 14" style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.5)" strokeCap="round" />
            </Canvas>
            <Text style={{
              fontFamily: 'Nunito-SemiBold', fontSize: 16, color: 'rgba(255,255,255,0.75)', marginLeft: 8,
            }}>Par membre</Text>
          </View>
        </Animated.View>

        {stats.memberStats.length === 0 ? (
          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 20 }}>
            Aucun membre trouvé
          </Text>
        ) : stats.memberStats.map((m, mi) => (
          <Animated.View key={m.user_id}
            entering={FadeInUp.delay(520 + mi * 80).duration(350)}
            style={{
              backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1,
              borderColor: m.memberColor + '38', marginBottom: 10, overflow: 'hidden',
              shadowColor: m.memberColor, shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
            }}
          >
            {/* Highlight line */}
            <LinearGradient colors={['transparent', m.memberColor + '59', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />

            {/* Left edge bar */}
            <View style={{
              position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2,
              backgroundColor: m.memberColor,
              shadowColor: m.memberColor, shadowRadius: 6, shadowOpacity: 0.8, elevation: 2,
            }} />

            <View style={{ padding: 16, paddingLeft: 20 }}>
              {/* Row 1: Avatar + Name + Score */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ position: 'relative' }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 14,
                    backgroundColor: m.memberColor + '2E',
                    borderWidth: 2, borderColor: m.memberColor,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 18 }}>{m.avatar_emoji || '👤'}</Text>
                  </View>
                  {/* Rank badge */}
                  <View style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: mi === 0 ? C.amber : 'rgba(255,255,255,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontFamily: 'Nunito-Bold', fontSize: 9,
                      color: mi === 0 ? C.bgDeep : 'rgba(255,255,255,0.6)',
                    }}>{mi + 1}</Text>
                  </View>
                </View>

                {/* Name + sub-stats */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 17, color: C.textPrimary }}>
                    {m.display_name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: m.memberColor }}>
                      {m.done} terminée{m.done !== 1 ? 's' : ''}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</Text>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {m.total} assignée{m.total !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Ratio */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22 }}>
                    <Text style={{ color: m.memberColor }}>{m.done}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)' }}>/</Text>
                    <Text style={{ color: m.memberColor }}>{m.total}</Text>
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>tâches</Text>
                </View>
              </View>

              {/* Row 2: Progress bar */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Complétion</Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: m.memberColor }}>{m.rate}%</Text>
                </View>
                <AnimBar pct={m.rate} h={6} color={m.memberColor} delay={600 + mi * 150} />
              </View>

              {/* Row 3: Category breakdown */}
              {Object.keys(m.byCat).length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {Object.entries(m.byCat).map(([cat, count]) => {
                    const cfg = TASK_CAT_CFG[cat] ?? TASK_CAT_CFG.general;
                    return (
                      <View key={cat} style={{
                        backgroundColor: (cfg.color) + '1A',
                        borderWidth: 1, borderColor: (cfg.color) + '33',
                        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                      }}>
                        <Text style={{ fontSize: 10 }}>{cfg.emoji}</Text>
                        <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: cfg.color }}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        ))}

        {/* ══════ SECTION 4 — GRAPHIQUE BARRES ══════ */}
        {barData.length > 0 && (
          <Animated.View entering={FadeInUp.delay(640).duration(400)} style={{
            backgroundColor: C.bgSurface, borderRadius: 22, borderWidth: 1,
            borderColor: C.amberBorder, overflow: 'hidden', marginTop: 4, marginBottom: 14,
            shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
          }}>
            <LinearGradient colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Canvas style={{ width: 16, height: 16 }}>
                  <RoundedRect x={1} y={1} width={14} height={14} r={3}
                    style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.5)" />
                  <SkiaLine p1={vec(4, 6)} p2={vec(12, 6)} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.3)" />
                  <SkiaLine p1={vec(4, 10)} p2={vec(12, 10)} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.3)" />
                </Canvas>
                <Text style={{
                  fontFamily: 'Nunito-SemiBold', fontSize: 15,
                  color: 'rgba(255,255,255,0.7)', marginLeft: 8,
                }}>Activité {period === 'week' ? 'hebdomadaire' : period === 'month' ? 'mensuelle' : 'trimestrielle'}</Text>
              </View>

              <SkiaBarChart data={barData} height={160} />

              {/* Legend */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                {stats.memberStats.slice(0, 4).map(m => (
                  <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.memberColor }} />
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                      {m.display_name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ══════ SECTION 5 — DONUT CHART ══════ */}
        {donutData.length > 0 && (
          <Animated.View entering={FadeInUp.delay(760).duration(400)} style={{
            backgroundColor: C.bgSurface, borderRadius: 22, borderWidth: 1,
            borderColor: C.amberBorder, overflow: 'hidden', marginBottom: 14,
            shadowColor: C.amber, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
          }}>
            <LinearGradient colors={['transparent', 'rgba(245,166,35,0.35)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Canvas style={{ width: 16, height: 16 }}>
                  <Circle cx={8} cy={8} r={6} style="stroke" strokeWidth={2.5} color={C.amber} />
                  <Circle cx={8} cy={8} r={2} color="rgba(255,255,255,0.3)" />
                </Canvas>
                <Text style={{
                  fontFamily: 'Nunito-SemiBold', fontSize: 15,
                  color: 'rgba(255,255,255,0.7)', marginLeft: 8,
                }}>Répartition des tâches</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Donut */}
                <View style={{ position: 'relative', width: 130, height: 130 }}>
                  <SkiaDonut data={donutData} size={130} thickness={16} />
                  {/* Center text */}
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 24, color: C.textPrimary }}>
                      {stats.done}
                    </Text>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      tâches
                    </Text>
                  </View>
                </View>

                {/* Legend */}
                <View style={{ flex: 1, marginLeft: 16 }}>
                  {donutData.map((d, i) => {
                    const pct = stats.done > 0 ? Math.round((d.value / stats.done) * 100) : 0;
                    return (
                      <View key={i} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                          <Text style={{
                            fontFamily: 'DMSans-Regular', fontSize: 13,
                            color: 'rgba(255,255,255,0.7)', marginLeft: 8, flex: 1,
                          }}>{d.name}</Text>
                          <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 14, color: d.color }}>
                            {pct}%
                          </Text>
                        </View>
                        <View style={{
                          height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)',
                          marginTop: 4, width: 60, marginLeft: 18,
                          overflow: 'hidden',
                        }}>
                          <View style={{
                            height: 3, borderRadius: 2, backgroundColor: d.color,
                            width: `${pct}%`,
                          }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ══════ SECTION 6 — INSIGHTS ══════ */}
        <Animated.View entering={FadeIn.delay(880).duration(400)} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 14 }}>💡</Text>
            <Text style={{
              fontFamily: 'Nunito-SemiBold', fontSize: 15,
              color: 'rgba(255,255,255,0.7)', marginLeft: 6,
            }}>Insights</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {insights.map((ins, i) => (
              <InsightCard key={i} emoji={ins.emoji} text={ins.text} />
            ))}
          </ScrollView>
        </Animated.View>
      </ScrollView>
    </View>
  );
};
