import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  Alert, StatusBar, Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence,
  Easing, interpolate, cancelAnimation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Circle, Path, Skia, Group,
} from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type { TimerV2, TimerStatus, TimerCategory } from '@appTypes/index';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:    '#1A0E00',
  bgMid:     '#261400',
  bgSurface: '#2E1A00',
  bgElev:    '#3A2200',
  amber:     '#F5A623',
  amberSoft: 'rgba(245,166,35,0.15)',
  amberBrd:  'rgba(245,166,35,0.22)',
  border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF',
  textSec:   'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  green:     '#34D399',
  teal:      '#4ECDC4',
  purple:    '#A78BFA',
  orange:    '#FF8C00',
  danger:    '#FF4444',
};

const STATUS_COLORS: Record<TimerStatus, string> = {
  ready:    '#F5A623',
  running:  '#34D399',
  paused:   '#FF8C00',
  finished: '#FF4444',
};

const CAT_CFG: Record<TimerCategory, { label: string; emoji: string; color: string }> = {
  cuisine:   { label: 'Cuisine',   emoji: '🍳', color: '#FF6B6B' },
  lessive:   { label: 'Lessive',   emoji: '👕', color: '#4ECDC4' },
  menage:    { label: 'Ménage',    emoji: '🧹', color: '#A78BFA' },
  sport:     { label: 'Sport',     emoji: '🏃', color: '#34D399' },
  bricolage: { label: 'Bricolage', emoji: '🔧', color: '#FFA07A' },
  autre:     { label: 'Autre',     emoji: '⏱️', color: '#F5A623' },
};
const CATS = Object.keys(CAT_CFG) as TimerCategory[];

const PRESETS: { label: string; emoji: string; seconds: number; category: TimerCategory }[] = [
  { label: '5 min',  emoji: '☕', seconds: 300,  category: 'cuisine'  },
  { label: '10 min', emoji: '🍳', seconds: 600,  category: 'cuisine'  },
  { label: '15 min', emoji: '🍲', seconds: 900,  category: 'cuisine'  },
  { label: '30 min', emoji: '👕', seconds: 1800, category: 'lessive'  },
  { label: '45 min', emoji: '🏃', seconds: 2700, category: 'sport'    },
  { label: '1h',     emoji: '🧹', seconds: 3600, category: 'menage'   },
  { label: '2h',     emoji: '🔧', seconds: 7200, category: 'bricolage'},
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const pad = (n: number) => n.toString().padStart(2, '0');
const formatSecs = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const calcRemaining = (timer: TimerV2): number => {
  if (timer.status === 'ready') return timer.duration_sec;
  if (timer.status === 'finished') return 0;
  if (timer.status === 'paused') return Math.max(0, timer.duration_sec - timer.elapsed_sec);
  // running
  const startedAt = timer.started_at ? new Date(timer.started_at).getTime() : Date.now();
  const elapsed   = timer.elapsed_sec + Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, timer.duration_sec - elapsed);
};

const calcProgress = (timer: TimerV2, remaining: number): number => {
  if (timer.duration_sec === 0) return 1;
  return 1 - remaining / timer.duration_sec;
};

const estimatedEnd = (timer: TimerV2, remaining: number): string => {
  if (timer.status !== 'running') return '';
  return dayjs().add(remaining, 'second').format('HH:mm');
};

const getMemberName = (id: string, members: { user_id?: string; id?: string; display_name: string }[]): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m ? m.display_name.split(' ')[0] : 'Toi';
};
const getMemberColor = (id: string, members: { user_id?: string; id?: string; color?: string }[]): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m?.color ?? C.amber;
};

// ═══════════════════════════════════════════════════════════
// TIMER RING — Skia
// ═══════════════════════════════════════════════════════════
const RING_SIZE = 176;
const RING_CX   = RING_SIZE / 2;
const RING_CY   = RING_SIZE / 2;
const RING_R    = RING_SIZE / 2 - 18;
const STROKE_W  = 11;
const CIRC      = 2 * Math.PI * RING_R;

interface TimerRingProps {
  progress: number;   // 0→1
  status: TimerStatus;
  size?: number;
}

const TimerRing: React.FC<TimerRingProps> = React.memo(({ progress, status, size = RING_SIZE }) => {
  const cx = size / 2, cy = size / 2;
  const r  = size / 2 - 18;
  const sw = size === RING_SIZE ? STROKE_W : 7;

  const statusColor = STATUS_COLORS[status] ?? C.amber;

  // Tick marks sont statiques → mémorisés une seule fois par (size)
  const ticks = useMemo(() => {
    const ticksPath = Skia.Path.Make();
    const mainTicksPath = Skia.Path.Make();
    for (let i = 0; i < 60; i++) {
      const angle  = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const isMain = i % 15 === 0;
      const innerR = r - (isMain ? 10 : 6);
      const outerR = r - 2;
      const path = isMain ? mainTicksPath : ticksPath;
      path.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
      path.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
    }
    return { ticksPath, mainTicksPath };
  }, [cx, cy, r]);

  // Arc paths recomputés seulement quand progress change
  const { arcPath, dotX, dotY } = useMemo(() => {
    const clampedProgress = Math.min(Math.max(progress, 0), 0.9999);
    const sweepAngle = (1 - clampedProgress) * 360;
    const startAngle = -90;
    const rect = Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2);

    const arc = Skia.Path.Make();
    if (sweepAngle > 0.5) arc.addArc(rect, startAngle, sweepAngle);

    const endAngleRad = ((startAngle + sweepAngle) * Math.PI) / 180;
    return {
      arcPath: arc,
      dotX: cx + r * Math.cos(endAngleRad),
      dotY: cy + r * Math.sin(endAngleRad),
    };
  }, [progress, cx, cy, r]);

  const isFinished = progress >= 1;
  const hasArc = !isFinished && progress < 0.9999;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Track */}
      <Circle cx={cx} cy={cy} r={r} color="rgba(255,255,255,0.06)" style="stroke" strokeWidth={sw} />

      {/* Tick marks (2 paths au lieu de 60) */}
      <Path path={ticks.ticksPath} color="rgba(255,255,255,0.07)" style="stroke" strokeWidth={1} />
      <Path path={ticks.mainTicksPath} color="rgba(255,255,255,0.14)" style="stroke" strokeWidth={1.5} />

      {/* Glow arc */}
      {hasArc && (
        <Path path={arcPath} color={`${statusColor}22`} style="stroke" strokeWidth={sw + 10} strokeCap="round" />
      )}

      {/* Main arc */}
      {hasArc && (
        <Path path={arcPath} color={statusColor} style="stroke" strokeWidth={sw} strokeCap="round" />
      )}

      {/* Dot at arc end */}
      {hasArc && (
        <Circle cx={dotX} cy={dotY} r={sw / 2 + 1} color={statusColor} />
      )}

      {/* Finished — full red ring */}
      {isFinished && (
        <Circle cx={cx} cy={cy} r={r} color={C.danger} style="stroke" strokeWidth={sw} />
      )}

      {/* Center dot */}
      <Circle cx={cx} cy={cy} r={4} color={statusColor} />
    </Canvas>
  );
});

// ═══════════════════════════════════════════════════════════
// useCountdown — countdown local précis
// ═══════════════════════════════════════════════════════════
const useCountdown = (timer: TimerV2, onFinished: (id: string) => void) => {
  const [remaining, setRemaining] = useState(() => calcRemaining(timer));

  useEffect(() => {
    setRemaining(calcRemaining(timer));
    if (timer.status !== 'running') return;

    const tick = () => {
      const r = calcRemaining(timer);
      setRemaining(r);
      if (r === 0) {
        supabase.from('timers').update({ status: 'finished' }).eq('id', timer.id).then(() => {});
        onFinished(timer.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer.status, timer.started_at, timer.elapsed_sec, timer.duration_sec]);

  return {
    remaining,
    progress:  calcProgress(timer, remaining),
    formatted: formatSecs(remaining),
  };
};

// ═══════════════════════════════════════════════════════════
// TIMER CARD
// ═══════════════════════════════════════════════════════════
interface CardProps {
  timer: TimerV2;
  memberName: string;
  memberColor: string;
  index: number;
  onStart:    (t: TimerV2) => void;
  onPause:    (t: TimerV2) => void;
  onResume:   (t: TimerV2) => void;
  onReset:    (t: TimerV2) => void;
  onAddMin:   (t: TimerV2) => void;
  onDelete:   (t: TimerV2) => void;
  onFinished: (id: string) => void;
}

const TimerCard: React.FC<CardProps> = ({
  timer, memberName, memberColor, index,
  onStart, onPause, onResume, onReset, onAddMin, onDelete, onFinished,
}) => {
  const { remaining, progress, formatted } = useCountdown(timer, onFinished);
  const statusColor = STATUS_COLORS[timer.status];
  const cat         = CAT_CFG[timer.category] ?? CAT_CFG.autre;
  const endTime     = estimatedEnd(timer, remaining);

  const scale     = useSharedValue(1);
  const borderPulse = useSharedValue(0.3);
  const addMinScale = useSharedValue(1);

  useEffect(() => {
    if (timer.status === 'finished') {
      borderPulse.value = withRepeat(withSequence(
        withTiming(0.9, { duration: 700 }),
        withTiming(0.3, { duration: 700 }),
      ), -1, false);
    } else {
      cancelAnimation(borderPulse);
      borderPulse.value = 0.3;
    }
  }, [timer.status, borderPulse]);

  const cardStyle     = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const borderStyle   = useAnimatedStyle(() => ({ borderColor: `rgba(${hexToRgb(statusColor)},${borderPulse.value})` }));
  const addMinStyle   = useAnimatedStyle(() => ({ transform: [{ scale: addMinScale.value }] }));

  const handlePlayPause = () => {
    scale.value = withSpring(0.96, { damping: 10 }, () => { scale.value = withSpring(1); });
    if (timer.status === 'ready')   onStart(timer);
    else if (timer.status === 'running') onPause(timer);
    else if (timer.status === 'paused')  onResume(timer);
    else if (timer.status === 'finished') onReset(timer);
  };

  const handleAddMin = () => {
    addMinScale.value = withSequence(withSpring(1.2, { damping: 8 }), withSpring(1));
    onAddMin(timer);
  };

  const playIcon  = timer.status === 'running' ? '⏸' : timer.status === 'finished' ? '↩' : '▶';
  const playLabel = timer.status === 'running' ? 'Pause' : timer.status === 'finished' ? 'Rejouer' : 'Démarrer';

  const gradColors: [string, string] =
    timer.status === 'running'  ? ['#FF8C00', '#FF6B00'] :
    timer.status === 'finished' ? ['#F5A623', '#E8920A'] :
                                  ['#34D399', '#20B076'];

  return (
    <Animated.View entering={FadeInUp.duration(380).delay(index * 80).springify()} style={[cardStyle, { marginHorizontal: 16, marginBottom: 12 }]}>
      <Animated.View style={[{
        backgroundColor: C.bgSurface, borderRadius: 24, borderWidth: 1.5, overflow: 'hidden',
        shadowColor: statusColor, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: timer.status === 'running' ? 0.35 : 0.18,
        shadowRadius: 16, elevation: 8,
      }, borderStyle]}>
        {/* Top highlight */}
        <LinearGradient
          colors={['transparent', `${statusColor}45`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1.5 }}
        />

        <View style={{ padding: 20 }}>
          {/* Row 1: Category + Title + Status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <View style={{
              width: 42, height: 42, borderRadius: 13,
              backgroundColor: `${cat.color}20`, borderWidth: 1, borderColor: `${cat.color}35`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
            </View>

            <Text style={{ flex: 1, fontSize: 17, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>
              {timer.title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Status badge */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: `${statusColor}20`, borderWidth: 1, borderColor: `${statusColor}45`,
                borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
              }}>
                {timer.status === 'running' && (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
                )}
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: statusColor }}>
                  {timer.status === 'running' ? '▶ En cours' :
                   timer.status === 'paused'  ? '⏸ Pause'   :
                   timer.status === 'finished'? '⏰ Terminé' : '⏱ Prêt'}
                </Text>
              </View>

              {/* Menu */}
              <Pressable onPress={() => Alert.alert(timer.title, '', [
                { text: 'Réinitialiser', onPress: () => onReset(timer) },
                { text: '🗑️ Supprimer', style: 'destructive', onPress: () => onDelete(timer) },
                { text: 'Annuler', style: 'cancel' },
              ])} hitSlop={8}>
                <Text style={{ fontSize: 18, color: C.textMut }}>⋮</Text>
              </Pressable>
            </View>
          </View>

          {/* Central ring + time */}
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <View style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
              <TimerRing progress={progress} status={timer.status} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 40, fontFamily: 'Nunito-Bold',
                  color: timer.status === 'paused' ? C.orange : timer.status === 'finished' ? C.danger : timer.status === 'running' ? C.text : C.amber,
                  includeFontPadding: false,
                }}>
                  {formatted}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 2 }}>
                  sur {formatSecs(timer.duration_sec)}
                </Text>
              </View>
            </View>
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            {/* Reset */}
            {timer.status !== 'ready' && (
              <Pressable onPress={() => onReset(timer)} style={{
                width: 44, height: 44, borderRadius: 13,
                backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.50)' }}>↺</Text>
              </Pressable>
            )}

            {/* Play/Pause */}
            <Pressable onPress={handlePlayPause} style={{
              width: 60, height: 60, borderRadius: 18, overflow: 'hidden',
              shadowColor: statusColor, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
            }}>
              <LinearGradient colors={gradColors} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }}>
                <Text style={{ fontSize: 24, color: '#FFFFFF' }}>{playIcon}</Text>
              </LinearGradient>
            </Pressable>

            {/* +1 min */}
            {(timer.status === 'running' || timer.status === 'paused') && (
              <Animated.View style={addMinStyle}>
                <Pressable onPress={handleAddMin} style={{
                  width: 44, height: 44, borderRadius: 13,
                  backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber }}>+1{'\n'}min</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 14 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: memberColor, marginRight: 5 }} />
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.38)' }}>par {memberName}</Text>

            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.28)' }}>
                {timer.is_shared ? '👥 Partagé' : '🔒 Privé'}
              </Text>
            </View>

            {endTime !== '' && (
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.40)', marginLeft: 'auto' }}>
                Fin à {endTime}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// EMPTY STATE — Skia chronomètre animé
// ═══════════════════════════════════════════════════════════
const TimersEmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const secondHand = useSharedValue(0);
  const pulse      = useSharedValue(1);
  const zOp        = useSharedValue(0);
  const zY         = useSharedValue(0);

  useEffect(() => {
    secondHand.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false);
    pulse.value      = withRepeat(withSequence(
      withTiming(1.18, { duration: 1400 }), withTiming(1, { duration: 1400 }),
    ), -1, false);
    zOp.value = withRepeat(withSequence(
      withTiming(0.6, { duration: 1200 }), withTiming(0, { duration: 1200 }),
    ), -1, false);
    zY.value  = withRepeat(withTiming(-28, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const S = 210;
  const cx = S / 2, cy = S / 2 + 6;
  const r = 68;

  // Clock body
  const body = Skia.Path.Make();
  body.addCircle(cx, cy, r);

  // Crown
  const crown = Skia.Path.Make();
  crown.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 10, cy - r - 12, 20, 14), 4, 4));

  // Button
  const btn = Skia.Path.Make();
  btn.addCircle(cx + 16, cy - r - 8, 6);

  // Inner dial
  const dial = Skia.Path.Make();
  dial.addCircle(cx, cy, r - 12);

  // Second hand (static at initial position)
  const secPath = Skia.Path.Make();
  secPath.moveTo(cx, cy);
  const secAngle = -Math.PI / 6; // ~10:00
  secPath.lineTo(cx + (r - 18) * Math.cos(secAngle), cy + (r - 18) * Math.sin(secAngle));

  // Minute hand
  const minPath = Skia.Path.Make();
  minPath.moveTo(cx, cy);
  minPath.lineTo(cx, cy - r + 22);

  // Center dot
  const center = Skia.Path.Make();
  center.addCircle(cx, cy, 4);

  // Tick marks
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
    const isMain = i % 3 === 0;
    const inner = r - (isMain ? 14 : 9);
    const outer = r - 4;
    const p = Skia.Path.Make();
    p.moveTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle));
    p.lineTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle));
    return { path: p, isMain };
  });

  return (
    <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingTop: 30, paddingBottom: 24 }}>
      <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        {/* Sparkles */}
        <Animated.Text style={[{ position: 'absolute', top: 14, right: 32, fontSize: 12, color: C.amber }, pulseStyle]}>✦</Animated.Text>
        <Animated.Text style={{ position: 'absolute', top: 32, left: 24, fontSize: 10, color: C.teal }}>✦</Animated.Text>
        <Animated.Text style={{ position: 'absolute', bottom: 36, right: 22, fontSize: 9, color: C.green }}>✦</Animated.Text>
        <Animated.Text style={{ position: 'absolute', bottom: 28, left: 30, fontSize: 9, color: C.amber, opacity: 0.5 }}>✦</Animated.Text>

        <Canvas style={{ width: S, height: S }}>
          {/* Ambient glow */}
          <Circle cx={cx} cy={cy} r={90} color="rgba(245,166,35,0.04)" />

          {/* Clock body */}
          <Path path={body} color="rgba(58,34,0,0.55)" />
          <Path path={body} color="rgba(245,166,35,0.28)" style="stroke" strokeWidth={2} />

          {/* Crown + button */}
          <Path path={crown} color="rgba(245,166,35,0.38)" />
          <Path path={btn}   color="rgba(245,166,35,0.42)" />

          {/* Inner dial */}
          <Path path={dial} color="rgba(255,255,255,0.06)" style="stroke" strokeWidth={1} />

          {/* Ticks */}
          {ticks.map((t, i) => (
            <Path key={i} path={t.path} color={t.isMain ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'} style="stroke" strokeWidth={t.isMain ? 2 : 1} />
          ))}

          {/* Minute hand */}
          <Path path={minPath} color="rgba(255,255,255,0.50)" style="stroke" strokeWidth={3} strokeCap="round" />

          {/* Second hand */}
          <Path path={secPath} color="#F5A623" style="stroke" strokeWidth={2} strokeCap="round" />

          {/* Center dot */}
          <Path path={center} color="#F5A623" />
        </Canvas>
      </View>

      <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, textAlign: 'center', marginBottom: 8 }}>
        Aucun minuteur actif
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 40 }}>
        Crée un minuteur partagé{'\n'}pour la lessive, cuisine...
      </Text>
      <Pressable onPress={onAdd} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
        borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13,
      }}>
        <Text style={{ fontSize: 16, color: C.amber }}>⏱️</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Créer un minuteur</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// ADD TIMER MODAL
// ═══════════════════════════════════════════════════════════
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, category: TimerCategory, seconds: number, startNow: boolean) => void;
}

const AddTimerModal: React.FC<AddModalProps> = ({ visible, onClose, onSave }) => {
  const [hours,    setHours]    = useState(0);
  const [minutes,  setMinutes]  = useState(5);
  const [secs,     setSecs]     = useState(0);
  const [title,    setTitle]    = useState('');
  const [category, setCategory] = useState<TimerCategory>('cuisine');
  const [isShared, setIsShared] = useState(true);

  const totalSeconds = hours * 3600 + minutes * 60 + secs;
  const displayTime  = `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;

  const applyPreset = (p: typeof PRESETS[0]) => {
    const h = Math.floor(p.seconds / 3600);
    const m = Math.floor((p.seconds % 3600) / 60);
    const s = p.seconds % 60;
    setHours(h); setMinutes(m); setSecs(s);
    setCategory(p.category);
    if (!title) setTitle(p.label + ' — ' + CAT_CFG[p.category].label);
  };

  const reset = () => { setHours(0); setMinutes(5); setSecs(0); setTitle(''); setCategory('cuisine'); };

  if (!visible) return null;

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 100 }}>
      <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', borderTopWidth: 1, borderTopColor: C.amberBrd }}>
        <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']} style={{ height: 2, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />

        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 18 }} />
          <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 20 }}>Nouveau minuteur</Text>

          {/* Duration display */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 52, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 2 }}>{displayTime}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 4 }}>H : M : S</Text>
          </View>

          {/* Duration picker row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
            {[
              { val: hours,   set: setHours,   label: 'Heures',   max: 23 },
              { val: minutes, set: setMinutes, label: 'Minutes',  max: 59 },
              { val: secs,    set: setSecs,    label: 'Secondes', max: 59 },
            ].map(({ val, set, label, max }) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Pressable onPress={() => set(v => Math.min(v + 1, max))} style={{ width: 36, height: 28, borderRadius: 8, backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.amber, fontSize: 14 }}>▲</Text>
                </Pressable>
                <Text style={{ fontSize: 26, fontFamily: 'Nunito-Bold', color: C.text }}>{pad(val)}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>{label}</Text>
                <Pressable onPress={() => set(v => Math.max(v - 1, 0))} style={{ width: 36, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.textMut, fontSize: 14 }}>▼</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Presets */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>DURÉES RAPIDES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {PRESETS.map(p => (
              <Pressable key={p.label} onPress={() => applyPreset(p)} style={{
                alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14,
                backgroundColor: C.bgElev, borderWidth: 1, borderColor: `${CAT_CFG[p.category].color}30`,
              }}>
                <Text style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.text }}>{p.label}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: CAT_CFG[p.category].color }}>{CAT_CFG[p.category].label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Title */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TITRE</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Ex: Lessive en cours, Pâtes..." placeholderTextColor={C.textMut}
            style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'Nunito-Bold', fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 18 }} />

          {/* Category */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>CATÉGORIE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {CATS.map(k => {
              const sel = category === k;
              const cfg = CAT_CFG[k];
              return (
                <Pressable key={k} onPress={() => setCategory(k)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: sel ? `${cfg.color}22` : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? cfg.color : 'rgba(245,166,35,0.12)',
                }}>
                  <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                  <Text style={{ fontSize: 12, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? cfg.color : C.textSec }}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => {
              if (totalSeconds === 0) { Alert.alert('', 'Choisis une durée.'); return; }
              if (!title.trim()) { Alert.alert('', 'Ajoute un titre.'); return; }
              onSave(title.trim(), category, totalSeconds, false);
              reset(); onClose();
            }} style={{ flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: C.amberBrd, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Créer</Text>
            </Pressable>
            <Pressable onPress={() => {
              if (totalSeconds === 0) { Alert.alert('', 'Choisis une durée.'); return; }
              if (!title.trim()) { Alert.alert('', 'Ajoute un titre.'); return; }
              onSave(title.trim(), category, totalSeconds, true);
              reset(); onClose();
            }} style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 15, alignItems: 'center', borderRadius: 14 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>▶ Créer et démarrer</Text>
              </LinearGradient>
            </Pressable>
          </View>
          <Pressable onPress={() => { reset(); onClose(); }} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>Annuler</Text>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════
// FINISHED BANNER
// ═══════════════════════════════════════════════════════════
const FinishedBanner: React.FC<{ title: string; onReset: () => void }> = ({ title, onReset }) => (
  <Animated.View entering={FadeInDown.springify()} style={{
    backgroundColor: 'rgba(255,68,68,0.12)', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,68,68,0.30)', padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  }}>
    <Text style={{ fontSize: 20 }}>⏰</Text>
    <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito-Bold', color: C.danger }} numberOfLines={1}>
      "{title}" est terminé !
    </Text>
    <Pressable onPress={onReset} style={{
      backgroundColor: 'rgba(255,68,68,0.20)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.35)',
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    }}>
      <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.danger }}>Réinitialiser</Text>
    </Pressable>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════
// hex to RGB helper
// ═══════════════════════════════════════════════════════════
const hexToRgb = (hex: string): string => {
  'worklet';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
};

// ═══════════════════════════════════════════════════════════
// FAB
// ═══════════════════════════════════════════════════════════
const TimerFAB: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const fabPulse = useSharedValue(0);
  useEffect(() => {
    fabPulse.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [fabPulse]);

  const fabStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.40 + fabPulse.value * 0.25,
    shadowRadius: 12 + fabPulse.value * 8,
  }));

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(400)} style={[fabStyle, {
      position: 'absolute', bottom: 90, right: 16, zIndex: 50,
      shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, elevation: 12, borderRadius: 18,
    }]}>
      <Pressable onPress={onPress} style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}>
        <LinearGradient colors={['#F5A623', '#E8920A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, color: '#1A0E00' }}>⏱️</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const SharedTimersScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [timers,    setTimers]    = useState<TimerV2[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const navigation = useNavigation();

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  // ── Load ──
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('timers').select('*')
      .eq('household_id', household.id)
      .neq('status', 'finished')
      .order('created_at', { ascending: false });
    setTimers((data ?? []) as TimerV2[]);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`timers-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timers', filter: `household_id=eq.${household.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, load]);

  // ── Derived ──
  const activeTimers  = useMemo(() => timers.filter(t => t.status === 'running'),  [timers]);
  const pausedTimers  = useMemo(() => timers.filter(t => t.status === 'paused'),   [timers]);
  const finishedTimer = useMemo(() => timers.find(t => t.id === finishedId),        [timers, finishedId]);

  // ── Timer actions ──
  const handleCreate = useCallback(async (title: string, category: TimerCategory, seconds: number, startNow: boolean) => {
    if (!household?.id || !myMember) return;
    const now = new Date().toISOString();
    const { data } = await supabase.from('timers').insert({
      household_id: household.id,
      created_by:   myMember.id ?? myMember.user_id,
      title, category,
      duration_sec: seconds,
      status: startNow ? 'running' : 'ready',
      started_at:   startNow ? now : null,
      elapsed_sec:  0,
      is_shared:    true,
    }).select().single();
    if (data) {
      setTimers(prev => [data as TimerV2, ...prev]);
      if (startNow) {
        notificationService.displayNotification({
          type: 'TIMER_STARTED' as any,
          householdId: household.id,
          triggeredByName: myMember.display_name,
          data: { title, duration: formatSecs(seconds) },
        }).catch(() => {});
      }
    }
  }, [household?.id, myMember]);

  const handleStart = useCallback(async (t: TimerV2) => {
    await supabase.from('timers').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', t.id);
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'running', started_at: new Date().toISOString() } : x));
  }, []);

  const handlePause = useCallback(async (t: TimerV2) => {
    const now = new Date();
    const elapsed = t.elapsed_sec + Math.floor((now.getTime() - new Date(t.started_at!).getTime()) / 1000);
    await supabase.from('timers').update({ status: 'paused', paused_at: now.toISOString(), elapsed_sec: elapsed }).eq('id', t.id);
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'paused', paused_at: now.toISOString(), elapsed_sec: elapsed } : x));
  }, []);

  const handleResume = useCallback(async (t: TimerV2) => {
    const now = new Date().toISOString();
    await supabase.from('timers').update({ status: 'running', started_at: now }).eq('id', t.id);
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'running', started_at: now } : x));
  }, []);

  const handleReset = useCallback(async (t: TimerV2) => {
    await supabase.from('timers').update({ status: 'ready', started_at: null, paused_at: null, elapsed_sec: 0 }).eq('id', t.id);
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'ready', started_at: null, paused_at: null, elapsed_sec: 0 } : x));
    if (finishedId === t.id) setFinishedId(null);
  }, [finishedId]);

  const handleAddMin = useCallback(async (t: TimerV2) => {
    const newDur = t.duration_sec + 60;
    await supabase.from('timers').update({ duration_sec: newDur }).eq('id', t.id);
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, duration_sec: newDur } : x));
  }, []);

  const handleDelete = useCallback((t: TimerV2) => {
    Alert.alert('Supprimer', `Supprimer "${t.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('timers').delete().eq('id', t.id);
        setTimers(prev => prev.filter(x => x.id !== t.id));
      }},
    ]);
  }, []);

  const handleFinished = useCallback((id: string) => {
    setFinishedId(id);
    notificationService.displayNotification({
      type: 'TIMER_FINISHED' as any,
      householdId: household?.id ?? '',
      triggeredByName: myMember?.display_name ?? '',
      data: { title: timers.find(t => t.id === id)?.title ?? '' },
    }).catch(() => {});
  }, [timers, household?.id, myMember]);

  const handlePresetCreate = useCallback(async (preset: typeof PRESETS[0]) => {
    if (!household?.id || !myMember) return;
    await handleCreate(
      `${preset.emoji} ${preset.label}`,
      preset.category,
      preset.seconds,
      true,
    );
  }, [household?.id, myMember, handleCreate]);

  // ── Status summary ──
  const statusText = useMemo(() => {
    if (finishedTimer) return `⏰ "${finishedTimer.title}" est terminé !`;
    if (activeTimers.length === 0 && timers.length === 0) return 'Aucun minuteur actif';
    if (activeTimers.length === 1) return `1 minuteur en cours · ${activeTimers[0].title}`;
    if (activeTimers.length > 1) return `${activeTimers.length} minuteurs actifs`;
    return 'Aucun minuteur en cours';
  }, [activeTimers, timers, finishedTimer]);

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245,166,35,0.04)' }} />

      {/* Finished banner */}
      {finishedTimer && (
        <FinishedBanner
          title={finishedTimer.title}
          onReset={() => handleReset(finishedTimer)}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(245,166,35,0.09)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Text style={{ fontSize: 28 }}>⏱️</Text>
              <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Minuteurs</Text>
            </View>
            <Text style={{
              fontSize: 13, fontFamily: 'DMSans-Regular',
              color: finishedTimer ? C.danger : 'rgba(255,255,255,0.45)',
              marginBottom: 14,
            }}>
              {statusText}
            </Text>

            {/* Stats card */}
            {timers.length > 0 && (
              <View style={{
                backgroundColor: C.bgSurface, borderRadius: 20, borderWidth: 1,
                borderColor: C.amberBrd, padding: 16, marginBottom: 14, overflow: 'hidden',
                flexDirection: 'row',
              }}>
                <LinearGradient colors={['transparent', 'rgba(245,166,35,0.28)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />
                {[
                  { count: activeTimers.length,             label: 'actifs',    color: C.green },
                  { count: pausedTimers.length,             label: 'en pause',  color: C.orange },
                  { count: timers.filter(t => t.status === 'ready').length, label: 'prêts', color: 'rgba(255,255,255,0.50)' },
                ].map((stat, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    {i > 0 && <View style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />}
                    <Text style={{ fontSize: 28, fontFamily: 'Nunito-Bold', color: stat.color }}>{stat.count}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ══ PRESETS RAPIDES ══ */}
        <Animated.View entering={FadeIn.duration(400).delay(80)}>
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginLeft: 16, marginBottom: 10, textTransform: 'uppercase' }}>
            Démarrage rapide
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10, marginBottom: 18 }}>
            {PRESETS.map((p, i) => {
              const cfg = CAT_CFG[p.category];
              return (
                <Animated.View key={p.label} entering={FadeIn.duration(300).delay(80 + i * 40)}>
                  <Pressable onPress={() => handlePresetCreate(p)} style={{
                    backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1,
                    borderColor: `${cfg.color}30`, paddingHorizontal: 14, paddingVertical: 12,
                    alignItems: 'center', minWidth: 78,
                  }}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{p.emoji}</Text>
                    <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>{p.label}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: cfg.color, marginTop: 2 }}>{cfg.label}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ══ TIMER CARDS ══ */}
        {timers.length === 0 ? (
          <TimersEmptyState onAdd={() => setShowModal(true)} />
        ) : (
          timers.map((t, i) => (
            <TimerCard
              key={t.id}
              timer={t}
              memberName={getMemberName(t.created_by, members)}
              memberColor={getMemberColor(t.created_by, members)}
              index={i}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onReset={handleReset}
              onAddMin={handleAddMin}
              onDelete={handleDelete}
              onFinished={handleFinished}
            />
          ))
        )}
      </ScrollView>

      {/* ══ FAB ══ */}
      <TimerFAB onPress={() => setShowModal(true)} />

      {/* ══ MODAL ══ */}
      <AddTimerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
      />
    </View>
  );
};
