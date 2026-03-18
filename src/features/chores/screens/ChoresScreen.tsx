import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, SectionList, Pressable, TextInput,
  Alert, StatusBar, Dimensions, FlatList,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Circle, Path, Skia, Group, BlurMask, RoundedRect,
} from '@shopify/react-native-skia';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type {
  Chore, ChoreOccurrence, ChoreCategory, ChoreFrequency,
  ChoreRotationType, CHORE_CATEGORY_CONFIG, CHORE_FREQUENCY_LABELS,
} from '@appTypes/index';

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
  amberGlow: 'rgba(245,166,35,0.30)',
  amberBrd:  'rgba(245,166,35,0.22)',
  border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF',
  textSec:   'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  green:     '#34D399',
  warning:   '#FF8C00',
  danger:    '#FF4444',
  teal:      '#4ECDC4',
  purple:    '#A78BFA',
  coral:     '#FF6B6B',
  peach:     '#FFA07A',
};

// ═══════════════════════════════════════════════════════════
// CATEGORY & FREQUENCY CONFIG
// ═══════════════════════════════════════════════════════════
const CAT_CFG: Record<ChoreCategory, { label: string; emoji: string; color: string }> = {
  menage:    { label: 'Ménage',    emoji: '🧹', color: '#4ECDC4' },
  cuisine:   { label: 'Cuisine',   emoji: '🍳', color: '#FF6B6B' },
  exterieur: { label: 'Extérieur', emoji: '🌿', color: '#34D399' },
  commun:    { label: 'Commun',    emoji: '🏠', color: '#A78BFA' },
  animaux:   { label: 'Animaux',   emoji: '🐾', color: '#FFA07A' },
  autre:     { label: 'Autre',     emoji: '⚡', color: '#F5A623' },
};
const CATS = Object.keys(CAT_CFG) as ChoreCategory[];

const FREQ_CFG: Record<ChoreFrequency, { label: string; short: string }> = {
  daily:    { label: 'Tous les jours',       short: 'Quotidien'   },
  weekly:   { label: 'Chaque semaine',       short: 'Hebdo'       },
  biweekly: { label: 'Toutes les 2 semaines', short: '2 sem.'      },
  monthly:  { label: 'Chaque mois',          short: 'Mensuel'     },
};
const FREQS = Object.keys(FREQ_CFG) as ChoreFrequency[];

const ROT_CFG: Record<ChoreRotationType, { label: string; icon: string; desc: string }> = {
  round_robin: { label: 'Tour à tour',   icon: '↻', desc: 'Chacun à son tour dans l\'ordre' },
  least_done:  { label: 'Équilibré',     icon: '⚖️', desc: 'Toujours celui qui a le moins fait' },
  random:      { label: 'Aléatoire',     icon: '🎲', desc: 'Tirage au sort à chaque fois' },
};

const MEMBER_COLORS = [C.coral, C.teal, C.purple, C.peach, C.green, C.amber];

const DAYS_FR = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getNextDueDate = (chore: Chore): dayjs.Dayjs => {
  const now = dayjs();
  switch (chore.frequency) {
    case 'daily':
      return now.add(1, 'day');
    case 'weekly': {
      const target = chore.frequency_day ?? 1;
      const dow = now.day() === 0 ? 7 : now.day();
      const diff = ((target - dow + 7) % 7) || 7;
      return now.add(diff, 'day');
    }
    case 'biweekly':
      return now.add(14, 'day');
    case 'monthly': {
      const d = chore.frequency_day ?? 1;
      const next = now.date() >= d ? now.add(1, 'month').date(d) : now.date(d);
      return next;
    }
  }
};

const daysUntilDue = (chore: Chore): number => {
  const next = getNextDueDate(chore);
  return next.diff(dayjs(), 'day');
};

const getMemberName = (id: string, members: { user_id?: string; id?: string; display_name: string }[]): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m ? m.display_name.split(' ')[0] : 'Inconnu';
};

const getMemberColor = (id: string, members: { user_id?: string; id?: string; color?: string }[], index: number): string => {
  const m = members.find(x => x.user_id === id || x.id === id);
  return m?.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length];
};

// ═══════════════════════════════════════════════════════════
// SKIA ROTATION WHEEL (compact — used in ChoreCard)
// ═══════════════════════════════════════════════════════════
interface WheelProps {
  memberIds: string[];
  currentIndex: number;
  allMembers: { user_id?: string; id?: string; display_name: string; color?: string }[];
  size?: number;
}

const RotationWheelCompact: React.FC<WheelProps> = ({ memberIds, currentIndex, allMembers, size = 80 }) => {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.34;
  const n  = Math.min(memberIds.length, 4);

  const arrowPath = Skia.Path.Make();
  arrowPath.moveTo(cx - r + 6, cy);
  arrowPath.arcTo({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, 180, 160, false);
  const arrowTip = Skia.Path.Make();
  arrowTip.moveTo(cx + r - 3, cy - 8);
  arrowTip.lineTo(cx + r + 6, cy + 2);
  arrowTip.lineTo(cx + r - 10, cy + 4);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Outer dashed ring */}
      <Circle cx={cx} cy={cy} r={r + 8} color="rgba(245,166,35,0.10)" style="stroke" strokeWidth={1} />
      {/* Rotation arc arrow */}
      <Path path={arrowPath} color="rgba(245,166,35,0.45)" style="stroke" strokeWidth={2} strokeCap="round" />
      <Path path={arrowTip} color="rgba(245,166,35,0.45)" style="fill" />
      {/* Member circles */}
      {Array.from({ length: n }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
        const mx = cx + r * Math.cos(angle);
        const my = cy + r * Math.sin(angle);
        const memberId = memberIds[i] ?? '';
        const color = getMemberColor(memberId, allMembers, i);
        const isActive = i === currentIndex % n;
        return (
          <Group key={i}>
            <Circle cx={mx} cy={my} r={isActive ? 12 : 9}
              color={color + (isActive ? '30' : '18')} />
            <Circle cx={mx} cy={my} r={isActive ? 12 : 9}
              color={color} style="stroke" strokeWidth={isActive ? 2.5 : 1.5} />
          </Group>
        );
      })}
      {/* Center dot */}
      <Circle cx={cx} cy={cy} r={3} color="rgba(245,166,35,0.50)" />
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// SKIA EMPTY STATE
// ═══════════════════════════════════════════════════════════
const ChoresEmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const rot    = useSharedValue(0);
  const pulse1 = useSharedValue(0.3);
  const pulse2 = useSharedValue(0.3);
  const pulse3 = useSharedValue(0.3);

  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    pulse1.value = withRepeat(withSequence(
      withTiming(0.8, { duration: 1200 }), withTiming(0.3, { duration: 1200 }),
    ), -1, false);
    pulse2.value = withRepeat(withSequence(
      withTiming(0.8, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.3, { duration: 1400 }),
    ), -1, false);
    pulse3.value = withRepeat(withSequence(
      withTiming(0.8, { duration: 1600 }), withTiming(0.3, { duration: 1600 }),
    ), -1, false);
  }, [rot, pulse1, pulse2, pulse3]);

  const CANVAS_SIZE = 220;
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2 - 5;
  const R  = 72;

  const ringPath = Skia.Path.Make();
  ringPath.addCircle(cx, cy, R);

  const arcPath = Skia.Path.Make();
  arcPath.addArc({ x: cx - 40, y: cy - 40, width: 80, height: 80 }, -30, 240);
  const arrowTip = Skia.Path.Make();
  arrowTip.moveTo(cx + 32, cy - 28);
  arrowTip.lineTo(cx + 42, cy - 16);
  arrowTip.lineTo(cx + 28, cy - 12);
  arrowTip.close();

  return (
    <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 20 }}>
      <View style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
          {/* Ambient glow */}
          <Circle cx={cx} cy={cy} r={90} color="rgba(245,166,35,0.04)" />

          {/* Dashed outer ring */}
          <Path path={ringPath} color="rgba(245,166,35,0.18)" style="stroke" strokeWidth={1.5} />

          {/* 3 empty member slots */}
          {[0, 1, 2].map(i => {
            const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
            const mx = cx + R * Math.cos(angle);
            const my = cy + R * Math.sin(angle);
            return (
              <Group key={i}>
                <Circle cx={mx} cy={my} r={16} color="transparent" />
                <Circle cx={mx} cy={my} r={16} color="rgba(255,255,255,0.10)" style="stroke" strokeWidth={1.5} />
              </Group>
            );
          })}

          {/* Rotation arc + arrow */}
          <Path path={arcPath} color="rgba(245,166,35,0.30)" style="stroke" strokeWidth={2.5} strokeCap="round" />
          <Path path={arrowTip} color="rgba(245,166,35,0.30)" />

          {/* Pulse dots on ring */}
          <Circle cx={cx + R} cy={cy} r={4} color={`rgba(245,166,35,${pulse1.value})`} />
          <Circle cx={cx - R * 0.5} cy={cy - R * 0.866} r={4} color={`rgba(78,205,196,${pulse2.value})`} />
          <Circle cx={cx - R * 0.5} cy={cy + R * 0.866} r={4} color={`rgba(255,107,157,${pulse3.value})`} />
        </Canvas>

        {/* Question mark overlay */}
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, color: 'rgba(255,255,255,0.12)', fontFamily: 'Nunito-Bold' }}>?</Text>
        </View>
      </View>

      <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, textAlign: 'center', marginBottom: 8 }}>
        Aucune corvée récurrente
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 36 }}>
        Ajoute une corvée et elle s'attribuera{'\n'}automatiquement à tour de rôle !
      </Text>
      <Pressable onPress={onAdd} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBrd,
        borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13,
      }}>
        <Text style={{ fontSize: 18, color: C.amber }}>+</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Créer une corvée</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// CHORE CARD
// ═══════════════════════════════════════════════════════════
interface ChoreCardProps {
  chore: Chore;
  occurrences: ChoreOccurrence[];
  allMembers: { user_id?: string; id?: string; display_name: string; color?: string }[];
  myMemberId: string;
  onComplete: (chore: Chore) => void;
  onLongPress: (chore: Chore) => void;
  index: number;
}

const ChoreCard: React.FC<ChoreCardProps> = ({
  chore, occurrences, allMembers, myMemberId, onComplete, onLongPress, index,
}) => {
  const cat    = CAT_CFG[chore.category] ?? CAT_CFG.autre;
  const color  = cat.color;
  const days   = daysUntilDue(chore);
  const isOverdue  = days < 0;
  const isDueToday = days === 0;
  const isDueSoon  = days > 0 && days <= 2;
  const scale  = useSharedValue(1);
  const arrowX = useSharedValue(0);

  useEffect(() => {
    arrowX.value = withRepeat(
      withSequence(
        withTiming(3,  { duration: 700 }),
        withTiming(-3, { duration: 700 }),
        withTiming(0,  { duration: 300 }),
      ), -1, false,
    );
  }, [arrowX]);

  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: arrowX.value }] }));
  const cardStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const currentAssigneeId = chore.rotation_members[chore.current_assignee_index] ?? '';
  const nextIdx           = chore.rotation_members.length > 0
    ? (chore.current_assignee_index + 1) % chore.rotation_members.length
    : 0;
  const nextAssigneeId    = chore.rotation_members[nextIdx] ?? '';

  const currentName = getMemberName(currentAssigneeId, allMembers);
  const nextName    = getMemberName(nextAssigneeId, allMembers);
  const currentColor = getMemberColor(currentAssigneeId, allMembers, chore.current_assignee_index);
  const nextColor    = getMemberColor(nextAssigneeId, allMembers, nextIdx);
  const isMyTurn     = currentAssigneeId === myMemberId;

  // Last 4 occurrences for history dots
  const last4 = useMemo(() => {
    const choreOccs = occurrences.filter(o => o.chore_id === chore.id)
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
      .slice(0, 4);
    return choreOccs;
  }, [occurrences, chore.id]);

  const borderColor = isOverdue ? 'rgba(255,68,68,0.28)' : `${color}28`;
  const shadowColor = isOverdue ? C.danger : color;
  const highlightColor = isOverdue ? 'rgba(255,68,68,0.35)'
    : isDueToday ? 'rgba(245,166,35,0.40)'
    : `${color}28`;

  const statusColor = isOverdue ? C.danger
    : isDueToday ? C.amber
    : isDueSoon ? C.warning
    : color;

  const statusLabel = chore.is_paused ? 'En pause'
    : isOverdue  ? 'En retard'
    : isDueToday ? 'Aujourd\'hui'
    : isDueSoon  ? `Dans ${days}j`
    : `Dans ${days}j`;

  return (
    <Animated.View entering={FadeInUp.duration(380).delay(index * 70).springify()} style={[cardStyle, { marginHorizontal: 16, marginBottom: 10 }]}>
      <Pressable
        onLongPress={() => onLongPress(chore)}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 12 }); }}
        onPress={() => {}}
        style={{
          backgroundColor: C.bgSurface,
          borderRadius: 20, borderWidth: 1,
          borderColor, overflow: 'hidden',
          shadowColor, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isOverdue ? 0.30 : 0.18, shadowRadius: 12, elevation: 5,
        }}
      >
        {/* Top highlight line */}
        <LinearGradient colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />

        {/* Left status bar */}
        <View style={{
          position: 'absolute', left: 0, top: 12, bottom: 12, width: 3.5,
          backgroundColor: statusColor, borderTopRightRadius: 2, borderBottomRightRadius: 2,
          shadowColor: statusColor, shadowRadius: 6, shadowOpacity: 1,
        }} />

        <View style={{ padding: 15, paddingLeft: 18 }}>
          {/* Row 1: Category icon + title + status badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={{
              width: 42, height: 42, borderRadius: 13,
              backgroundColor: color + '20', borderWidth: 1, borderColor: color + '30',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
            </View>

            <Text style={{ flex: 1, fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={2}>
              {chore.title}
            </Text>

            <View style={{
              paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
              backgroundColor: statusColor + '1A', borderWidth: 1, borderColor: statusColor + '40',
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: statusColor }}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Compact Rotation Wheel */}
          {chore.rotation_members.length > 0 && (
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <RotationWheelCompact
                memberIds={chore.rotation_members}
                currentIndex={chore.current_assignee_index}
                allMembers={allMembers}
                size={72}
              />
            </View>
          )}

          {/* Info pills row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10 }}>🕐</Text>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textSec }}>
                {FREQ_CFG[chore.frequency].short}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10 }}>⏱</Text>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textSec }}>~{chore.duration_min} min</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                {ROT_CFG[chore.rotation_type].icon} {ROT_CFG[chore.rotation_type].label}
              </Text>
            </View>
          </View>

          {/* Current + Next assignee */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
            paddingTop: 10, gap: 10,
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 3 }}>Maintenant</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: currentColor + '25', borderWidth: 2, borderColor: currentColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: currentColor }}>{(currentName[0] ?? '?').toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: currentColor }}>{currentName}</Text>
              </View>
            </View>

            <Animated.Text style={[{ fontSize: 16, color: 'rgba(245,166,35,0.55)' }, arrowStyle]}>→</Animated.Text>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, marginBottom: 3 }}>Ensuite</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.70 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: nextColor + '20', borderWidth: 1.5, borderColor: nextColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: nextColor }}>{(nextName[0] ?? '?').toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec }}>{nextName}</Text>
              </View>
            </View>

            {/* Next due date */}
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                {isDueToday ? 'Aujourd\'hui'
                  : days === 1 ? 'Demain'
                  : days === 2 ? 'Après-dem.'
                  : getNextDueDate(chore).format('ddd D MMM')}
              </Text>
            </View>
          </View>

          {/* Complete button — shown only if it's my turn and due */}
          {isMyTurn && !chore.is_paused && (isDueToday || isOverdue) && (
            <Pressable onPress={() => onComplete(chore)} style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 10, paddingVertical: 10, borderRadius: 14,
              backgroundColor: 'rgba(52,211,153,0.12)',
              borderWidth: 1, borderColor: 'rgba(52,211,153,0.30)',
            }}>
              <Text style={{ fontSize: 16 }}>✓</Text>
              <Text style={{ fontSize: 14, fontFamily: 'DMSans-Regular', color: C.green }}>Marquer comme fait ✓</Text>
            </Pressable>
          )}

          {/* History dots */}
          {last4.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              {last4.map((occ, i) => (
                <View key={occ.id || i} style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: occ.completed_at ? color : occ.was_skipped ? C.danger + '55' : 'transparent',
                  borderWidth: 1.5,
                  borderColor: occ.completed_at ? color : occ.was_skipped ? C.danger : 'rgba(255,255,255,0.18)',
                }} />
              ))}
              {last4.filter(o => o.completed_at).length > 0 && (
                <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut, marginLeft: 4 }}>
                  {Math.round((last4.filter(o => o.completed_at).length / last4.length) * 100)}% ce mois
                </Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// ADD CHORE MODAL
// ═══════════════════════════════════════════════════════════
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string; category: ChoreCategory; frequency: ChoreFrequency;
    frequencyDay: number | null; rotationType: ChoreRotationType;
    rotationMembers: string[]; durationMin: number; description: string;
  }) => Promise<void>;
  allMembers: { user_id?: string; id?: string; display_name: string; color?: string }[];
}

const AddChoreModal: React.FC<AddModalProps> = ({ visible, onClose, onSave, allMembers }) => {
  const [title,         setTitle]         = useState('');
  const [category,      setCategory]      = useState<ChoreCategory>('menage');
  const [frequency,     setFrequency]     = useState<ChoreFrequency>('weekly');
  const [frequencyDay,  setFrequencyDay]  = useState<number>(1);
  const [rotationType,  setRotationType]  = useState<ChoreRotationType>('round_robin');
  const [selMembers,    setSelMembers]    = useState<string[]>([]);
  const [durationMin,   setDurationMin]   = useState(15);
  const [description,   setDescription]   = useState('');

  const DURATIONS = [5, 10, 15, 20, 30, 45, 60];

  useEffect(() => {
    if (visible && allMembers.length > 0) {
      setSelMembers(allMembers.map(m => (m.user_id ?? m.id) as string));
    }
  }, [visible, allMembers]);

  const reset = () => {
    setTitle(''); setCategory('menage'); setFrequency('weekly');
    setFrequencyDay(1); setRotationType('round_robin');
    setDurationMin(15); setDescription('');
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('', 'Ajoute un titre.'); return; }
    if (selMembers.length === 0) { Alert.alert('', 'Sélectionne au moins un membre.'); return; }
    await onSave({
      title: title.trim(), category, frequency,
      frequencyDay: (frequency === 'weekly' || frequency === 'monthly') ? frequencyDay : null,
      rotationType, rotationMembers: selMembers,
      durationMin, description,
    });
    reset(); onClose();
  };

  const toggleMember = (id: string) => {
    setSelMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (!visible) return null;

  return (
    <Pressable onPress={() => { onClose(); reset(); }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 100 }}>
      <Pressable onPress={e => e.stopPropagation()} style={{
        backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '92%', borderTopWidth: 1, borderTopColor: C.amberBrd,
      }}>
        <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']}
          style={{ height: 2, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 18 }} />
          <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 20 }}>Nouvelle corvée</Text>

          {/* Title */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TITRE</Text>
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Ex: Faire la vaisselle, Sortir les poubelles…"
            placeholderTextColor={C.textMut}
            style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 20 }} />

          {/* Category grid */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>CATÉGORIE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {CATS.map(k => {
              const sel = category === k;
              const cfg = CAT_CFG[k];
              return (
                <Pressable key={k} onPress={() => setCategory(k)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: sel ? cfg.color + '22' : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? cfg.color : 'rgba(245,166,35,0.12)',
                  width: (SW - 64) / 3,
                }}>
                  <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                  <Text style={{ fontSize: 11, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? cfg.color : C.textSec }}>
                    {cfg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Frequency */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>QUAND ?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {FREQS.map(f => {
              const sel = frequency === f;
              return (
                <Pressable key={f} onPress={() => setFrequency(f)} style={{
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
                  backgroundColor: sel ? C.amberSoft : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? C.amber : 'rgba(245,166,35,0.12)',
                  width: (SW - 64) / 2,
                }}>
                  <Text style={{ fontSize: 12, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? C.amber : C.textSec }}>
                    {FREQ_CFG[f].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Day picker for weekly */}
          {frequency === 'weekly' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.textSec, letterSpacing: 1, marginBottom: 8 }}>JOUR DE LA SEMAINE</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1,2,3,4,5,6,7].map(d => (
                  <Pressable key={d} onPress={() => setFrequencyDay(d)} style={{
                    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: frequencyDay === d ? C.amber : C.bgElev,
                    borderWidth: 1, borderColor: frequencyDay === d ? C.amber : C.border,
                  }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: frequencyDay === d ? '#1A0E00' : C.textSec }}>
                      {DAYS_FR[d]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Members selection */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>QUI PARTICIPE ?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {allMembers.map((m, i) => {
              const mid = (m.user_id ?? m.id) as string;
              const sel = selMembers.includes(mid);
              const col = m.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <Pressable key={mid} onPress={() => toggleMember(mid)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: sel ? col + '22' : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? col : C.border,
                }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: col + (sel ? 'AA' : '40') }} />
                  <Text style={{ fontSize: 13, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? col : C.textSec }}>
                    {m.display_name.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Rotation type */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>COMMENT ATTRIBUER ?</Text>
          <View style={{ gap: 8, marginBottom: 20 }}>
            {(Object.keys(ROT_CFG) as ChoreRotationType[]).map(rt => {
              const sel = rotationType === rt;
              const cfg = ROT_CFG[rt];
              return (
                <Pressable key={rt} onPress={() => setRotationType(rt)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  backgroundColor: sel ? C.amberSoft : C.bgElev,
                  borderWidth: 1.5, borderColor: sel ? C.amber : C.border,
                }}>
                  <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: sel ? C.amber : C.text }}>{cfg.label}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>{cfg.desc}</Text>
                  </View>
                  {sel && <Text style={{ fontSize: 14, color: C.amber }}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          {/* Duration */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 10 }}>DURÉE ESTIMÉE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DURATIONS.map(d => (
                <Pressable key={d} onPress={() => setDurationMin(d)} style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: durationMin === d ? C.amberSoft : C.bgElev,
                  borderWidth: 1.5, borderColor: durationMin === d ? C.amber : C.border,
                }}>
                  <Text style={{ fontSize: 12, fontFamily: durationMin === d ? 'Nunito-Bold' : 'DMSans-Regular', color: durationMin === d ? C.amber : C.textSec }}>
                    {d >= 60 ? '1h' : `${d} min`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Description */}
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>DESCRIPTION (optionnel)</Text>
          <TextInput value={description} onChangeText={setDescription}
            placeholder="Instructions, remarques…" placeholderTextColor={C.textMut}
            multiline style={{
              backgroundColor: C.bgSurface, borderRadius: 14, padding: 14,
              color: C.text, fontFamily: 'DMSans-Regular', fontSize: 14,
              borderWidth: 1, borderColor: C.border, minHeight: 70, marginBottom: 24,
            }} />

          {/* Submit */}
          <Pressable onPress={handleSave} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 8 }}>
            <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Créer la corvée</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => { onClose(); reset(); }} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>Annuler</Text>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════
const HistoryView: React.FC<{
  occurrences: ChoreOccurrence[];
  chores: Chore[];
  allMembers: { user_id?: string; id?: string; display_name: string; color?: string }[];
}> = ({ occurrences, chores, allMembers }) => {
  const [periodFilter, setPeriodFilter] = useState<'month' | 'prev' | '3months'>('month');

  const filtered = useMemo(() => {
    const now = dayjs();
    const start = periodFilter === 'month' ? now.startOf('month')
      : periodFilter === 'prev' ? now.subtract(1, 'month').startOf('month')
      : now.subtract(3, 'month').startOf('month');
    const end = periodFilter === 'prev' ? now.subtract(1, 'month').endOf('month') : now;
    return occurrences.filter(o => {
      const d = dayjs(o.due_date);
      return d.isAfter(start) && d.isBefore(end);
    }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [occurrences, periodFilter]);

  // Group by week
  const sections = useMemo(() => {
    const map = new Map<string, ChoreOccurrence[]>();
    filtered.forEach(o => {
      const weekStart = dayjs(o.due_date).startOf('week');
      const key = weekStart.format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return Array.from(map.entries()).map(([key, data]) => {
      const ws = dayjs(key);
      return {
        title: `Semaine du ${ws.format('D')} au ${ws.add(6, 'day').format('D MMM')} · ${data.length} corvée${data.length > 1 ? 's' : ''}`,
        data,
      };
    });
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 60 }}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
        <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text }}>Aucun historique</Text>
        <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 6 }}>pour cette période</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Period filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 14 }}>
        {([['month', 'Ce mois'], ['prev', 'Mois dernier'], ['3months', '3 mois']] as [typeof periodFilter, string][]).map(([k, lbl]) => (
          <Pressable key={k} onPress={() => setPeriodFilter(k)} style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
            backgroundColor: periodFilter === k ? C.amber : C.bgElev,
            borderWidth: 1, borderColor: periodFilter === k ? C.amber : C.amberBrd,
          }}>
            <Text style={{ fontSize: 12, fontFamily: periodFilter === k ? 'Nunito-Bold' : 'DMSans-Regular', color: periodFilter === k ? '#1A0E00' : C.textSec }}>
              {lbl}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 14 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const chore = chores.find(c => c.id === item.chore_id);
          const cat = chore ? (CAT_CFG[chore.category] ?? CAT_CFG.autre) : CAT_CFG.autre;
          const memberName = getMemberName(item.assigned_to, allMembers);
          const memberColor = getMemberColor(item.assigned_to, allMembers, 0);
          const isDone = !!item.completed_at;
          return (
            <Animated.View entering={FadeIn.duration(300)} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.bgSurface, borderRadius: 14,
              borderWidth: 1, borderColor: isDone ? 'rgba(52,211,153,0.18)' : 'rgba(255,68,68,0.18)',
              padding: 12, marginBottom: 6, marginHorizontal: 16,
            }}>
              {/* Status icon */}
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: isDone ? C.green + '22' : item.was_skipped ? C.danger + '22' : C.amber + '15',
                borderWidth: 1.5, borderColor: isDone ? C.green : item.was_skipped ? C.danger : C.amber,
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}>
                <Text style={{ fontSize: 13 }}>{isDone ? '✓' : item.was_skipped ? '✕' : '○'}</Text>
              </View>
              {/* Content */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 2 }}>{chore?.title ?? 'Corvée'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: memberColor }}>{memberName}</Text>
                </View>
              </View>
              {/* Date */}
              <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                {dayjs(item.due_date).format('D MMM')}
              </Text>
            </Animated.View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// CONFIG VIEW
// ═══════════════════════════════════════════════════════════
const ConfigView: React.FC<{
  chores: Chore[];
  onTogglePause: (chore: Chore) => void;
  onDelete: (chore: Chore) => void;
}> = ({ chores, onTogglePause, onDelete }) => {
  const active  = chores.filter(c => c.is_active && !c.is_paused).length;
  const paused  = chores.filter(c => c.is_paused).length;
  const totalMinPerWeek = chores.filter(c => c.is_active && !c.is_paused)
    .reduce((acc, c) => {
      const mult = c.frequency === 'daily' ? 7 : c.frequency === 'weekly' ? 1 : c.frequency === 'biweekly' ? 0.5 : 0.25;
      return acc + c.duration_min * mult;
    }, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      {/* Global stats card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={{
          backgroundColor: C.bgSurface, borderRadius: 20, padding: 18,
          borderWidth: 1, borderColor: C.amberBrd, marginBottom: 20,
        }}>
          <LinearGradient colors={['transparent', 'rgba(245,166,35,0.28)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { val: chores.length, label: 'Total',     color: C.amber },
              { val: active,        label: 'Actives',   color: C.green  },
              { val: paused,        label: 'En pause',  color: C.warning },
            ].map(({ val, label, color }) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 26, fontFamily: 'Nunito-Bold', color }}>{val}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 }} />
          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, textAlign: 'center' }}>
            ⏱ ~{Math.round(totalMinPerWeek)} min de corvées par semaine
          </Text>
        </View>
      </Animated.View>

      {chores.map((chore, i) => {
        const cat = CAT_CFG[chore.category] ?? CAT_CFG.autre;
        return (
          <Animated.View key={chore.id} entering={FadeInUp.duration(350).delay(i * 60)}>
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: C.border, marginBottom: 10,
              opacity: chore.is_paused ? 0.55 : 1,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: cat.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>{chore.title}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                  {FREQ_CFG[chore.frequency].short} · {chore.duration_min} min
                </Text>
              </View>
              <Pressable onPress={() => onTogglePause(chore)} style={{
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
                backgroundColor: chore.is_paused ? C.amberSoft : 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: chore.is_paused ? C.amberBrd : C.border,
              }}>
                <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: chore.is_paused ? C.amber : C.textMut }}>
                  {chore.is_paused ? '▶ Reprendre' : '⏸ Pause'}
                </Text>
              </Pressable>
              <Pressable onPress={() => onDelete(chore)} hitSlop={8}>
                <Text style={{ fontSize: 16, color: C.danger + 'AA' }}>🗑</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const ChoresScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [chores,      setChores]      = useState<Chore[]>([]);
  const [occurrences, setOccurrences] = useState<ChoreOccurrence[]>([]);
  const [tab,         setTab]         = useState<'todo' | 'history' | 'config'>('todo');
  const [showModal,   setShowModal]   = useState(false);

  // Balance bar member stats (from RPC)
  const [balanceStats, setBalanceStats] = useState<{ user_id: string; display_name: string; color: string; done_count: number; pct: number }[]>([]);

  const fabPulse = useSharedValue(0);
  const fabScale = useSharedValue(1);
  const rotIcon  = useSharedValue(0);

  useEffect(() => {
    fabPulse.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, true);
    rotIcon.value  = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [fabPulse, rotIcon]);

  const fabGlow  = useAnimatedStyle(() => ({
    shadowOpacity: 0.45 + fabPulse.value * 0.3,
    shadowRadius:  12   + fabPulse.value * 8,
    transform: [{ scale: fabScale.value }],
  }));
  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotIcon.value, [0, 1], [0, 360])}deg` }],
  }));

  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);
  const myMemberId = (myMember?.user_id ?? myMember?.id ?? '') as string;

  // ── Load data ──
  const load = useCallback(async () => {
    if (!household?.id) return;
    const [choresRes, occsRes] = await Promise.all([
      supabase.from('chores').select('*').eq('household_id', household.id).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('chore_occurrences').select('*').eq('household_id', household.id).order('due_date', { ascending: false }).limit(200),
    ]);
    setChores((choresRes.data ?? []) as Chore[]);
    setOccurrences((occsRes.data ?? []) as ChoreOccurrence[]);
  }, [household?.id]);

  const loadBalance = useCallback(async () => {
    if (!household?.id) return;
    try {
      const { data } = await supabase.rpc('get_chores_balance', { p_household_id: household.id });
      setBalanceStats((data ?? []) as typeof balanceStats);
    } catch { /* RPC may not exist yet */ }
  }, [household?.id]);

  useEffect(() => { load(); loadBalance(); }, [load, loadBalance]);

  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`chores-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `household_id=eq.${household.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_occurrences', filter: `household_id=eq.${household.id}` }, () => { load(); loadBalance(); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, load, loadBalance]);

  // ── Derived ──
  const overdueCount = useMemo(() =>
    chores.filter(c => !c.is_paused && daysUntilDue(c) < 0).length,
    [chores],
  );
  const doneThisMonth = useMemo(() => {
    const start = dayjs().startOf('month').toISOString();
    return occurrences.filter(o => o.completed_at && o.completed_at >= start).length;
  }, [occurrences]);

  const maxBalance = useMemo(() =>
    Math.max(...balanceStats.map(s => s.done_count), 1),
    [balanceStats],
  );

  // ── CRUD ──
  const createChore = useCallback(async (data: {
    title: string; category: ChoreCategory; frequency: ChoreFrequency;
    frequencyDay: number | null; rotationType: ChoreRotationType;
    rotationMembers: string[]; durationMin: number; description: string;
  }) => {
    if (!household?.id || !myMember) return;
    const { data: newChore } = await supabase.from('chores').insert({
      household_id: household.id,
      created_by:   myMember.id ?? myMember.user_id,
      title:        data.title,
      description:  data.description || null,
      category:     data.category,
      frequency:    data.frequency,
      frequency_day: data.frequencyDay,
      rotation_type: data.rotationType,
      rotation_members: data.rotationMembers,
      current_assignee_index: 0,
      is_active: true, is_paused: false,
      duration_min: data.durationMin,
    }).select().single();

    if (newChore) {
      // Create first occurrence
      await supabase.from('chore_occurrences').insert({
        chore_id:    newChore.id,
        household_id: household.id,
        assigned_to: data.rotationMembers[0],
        due_date:    getNextDueDate(newChore as Chore).format('YYYY-MM-DD'),
      });
    }
    load();
  }, [household?.id, myMember, load]);

  const markComplete = useCallback(async (chore: Chore) => {
    if (!household?.id || !myMember) return;
    // Find current occurrence
    const todayOcc = occurrences.find(o =>
      o.chore_id === chore.id && !o.completed_at && !o.was_skipped,
    );
    if (todayOcc) {
      await supabase.from('chore_occurrences').update({
        completed_at: new Date().toISOString(),
        completed_by: myMember.id ?? myMember.user_id,
      }).eq('id', todayOcc.id);
    }

    // Advance rotation index
    const nextIdx = (chore.current_assignee_index + 1) % chore.rotation_members.length;
    await supabase.from('chores').update({ current_assignee_index: nextIdx }).eq('id', chore.id);

    // Create next occurrence
    const nextAssigneeId = chore.rotation_members[nextIdx];
    await supabase.from('chore_occurrences').insert({
      chore_id:    chore.id,
      household_id: household.id,
      assigned_to: nextAssigneeId,
      due_date:    getNextDueDate(chore).format('YYYY-MM-DD'),
    });

    // Notify next person
    notificationService.displayNotification({
      type: 'CHORE_NEXT_TURN' as any,
      householdId: household.id,
      triggeredByName: myMember.display_name,
      data: { choreTitle: chore.title, catColor: CAT_CFG[chore.category].color },
    }).catch(() => {});

    load(); loadBalance();
  }, [household?.id, myMember, occurrences, load, loadBalance]);

  const togglePause = useCallback(async (chore: Chore) => {
    await supabase.from('chores').update({ is_paused: !chore.is_paused }).eq('id', chore.id);
    load();
  }, [load]);

  const deleteChore = useCallback((chore: Chore) => {
    Alert.alert('Supprimer', `Supprimer "${chore.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('chores').update({ is_active: false }).eq('id', chore.id);
        load();
      }},
    ]);
  }, [load]);

  const handleLongPress = useCallback((chore: Chore) => {
    Alert.alert(chore.title, '', [
      { text: chore.is_paused ? '▶ Reprendre' : '⏸ Mettre en pause', onPress: () => togglePause(chore) },
      { text: '🗑️ Supprimer', style: 'destructive', onPress: () => deleteChore(chore) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [togglePause, deleteChore]);

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* Ambient orbs */}
      <View style={{ position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245,166,35,0.04)' }} />
      <View style={{ position: 'absolute', top: 100, left: -50, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(78,205,196,0.03)' }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }} stickyHeaderIndices={[1]}>

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(245,166,35,0.10)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 0 }}>

            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Animated.Text style={[{ fontSize: 26 }, rotStyle]}>🔄</Animated.Text>
              <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Corvées</Text>
            </View>

            {/* Subtitle */}
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
              Attribution <Text style={{ color: C.amber }}>tournante</Text> et <Text style={{ color: C.amber }}>automatique</Text>
            </Text>

            {/* Stats card */}
            <View style={{
              backgroundColor: C.bgSurface, borderRadius: 22, borderWidth: 1,
              borderColor: C.amberBrd, padding: 18, marginBottom: 14, overflow: 'hidden',
            }}>
              <LinearGradient colors={['transparent', 'rgba(245,166,35,0.28)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1, marginBottom: 14 }} />

              {/* 3 stats */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
                {[
                  { val: chores.filter(c => c.is_active).length, label: 'corvées actives', color: C.amber, icon: '🔄' },
                  { val: doneThisMonth,   label: 'complétées',  color: C.green,  icon: '✅' },
                  { val: overdueCount,    label: 'en retard',   color: overdueCount > 0 ? C.danger : C.green, icon: overdueCount > 0 ? '⚠️' : '✓' },
                ].map(({ val, label, color, icon }) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, marginBottom: 3 }}>{icon}</Text>
                    <Text style={{ fontSize: 26, fontFamily: 'Nunito-Bold', color }}>{val}</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Balance bar */}
              {balanceStats.length > 0 && (
                <>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
                  <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: C.textMut, letterSpacing: 1, marginBottom: 10 }}>
                    CE MOIS · RÉPARTITION
                  </Text>
                  {balanceStats.map(stat => (
                    <View key={stat.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stat.color ?? C.amber }} />
                      <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec, width: 64 }} numberOfLines={1}>
                        {stat.display_name.split(' ')[0]}
                      </Text>
                      <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <View style={{ width: `${(stat.done_count / maxBalance) * 100}%`, height: 4, borderRadius: 2, backgroundColor: stat.color ?? C.amber }} />
                      </View>
                      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, width: 52, textAlign: 'right' }}>
                        {stat.done_count} · {stat.pct}%
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══ TABS ══ */}
        <Animated.View entering={FadeIn.duration(400).delay(150)} style={{ backgroundColor: C.bgDeep + 'F0', paddingBottom: 10 }}>
          <LinearGradient colors={['rgba(245,166,35,0.04)', 'transparent']} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { key: 'todo',    label: 'À faire',    icon: '🔄', badge: overdueCount },
                { key: 'history', label: 'Historique', icon: '📋', badge: 0 },
                { key: 'config',  label: 'Config',     icon: '⚙️', badge: 0 },
              ] as const).map(t => {
                const active = tab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                    backgroundColor: active ? C.amber : C.bgElev,
                    borderWidth: 1, borderColor: active ? C.amber : C.amberBrd,
                    shadowColor: active ? C.amber : 'transparent',
                    shadowOffset: { width: 0, height: 4 }, shadowOpacity: active ? 0.45 : 0,
                    shadowRadius: 12, elevation: active ? 8 : 0,
                  }}>
                    <Text style={{ fontSize: 12 }}>{t.icon}</Text>
                    <Text style={{ fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular', color: active ? '#1A0E00' : C.textSec }}>
                      {t.label}
                    </Text>
                    {t.badge > 0 && (
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: '#fff' }}>{t.badge}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══ CONTENT ══ */}
        {tab === 'todo' ? (
          chores.filter(c => c.is_active).length === 0 ? (
            <ChoresEmptyState onAdd={() => setShowModal(true)} />
          ) : (
            <View style={{ paddingTop: 8 }}>
              {chores.filter(c => c.is_active).map((chore, i) => (
                <ChoreCard
                  key={chore.id}
                  chore={chore}
                  occurrences={occurrences}
                  allMembers={members}
                  myMemberId={myMemberId}
                  onComplete={markComplete}
                  onLongPress={handleLongPress}
                  index={i}
                />
              ))}
            </View>
          )
        ) : tab === 'history' ? (
          <HistoryView occurrences={occurrences} chores={chores} allMembers={members} />
        ) : (
          <ConfigView chores={chores} onTogglePause={togglePause} onDelete={deleteChore} />
        )}
      </ScrollView>

      {/* ══ FAB ══ */}
      {tab === 'todo' && (
        <Animated.View entering={ZoomIn.duration(400).delay(600)} style={[fabGlow, {
          position: 'absolute', bottom: 90, right: 16,
          shadowColor: C.amber, shadowOffset: { width: 0, height: 6 },
          elevation: 12, zIndex: 50, borderRadius: 18,
        }]}>
          <Pressable
            onPressIn={() => { fabScale.value = withSpring(0.90, { damping: 10 }); }}
            onPressOut={() => { fabScale.value = withSpring(1.0,  { damping: 10 }); }}
            onPress={() => setShowModal(true)}
            style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}
          >
            <LinearGradient colors={['#F5A623', '#E8920A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30, color: '#1A0E00', lineHeight: 34 }}>+</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {/* ══ MODAL ══ */}
      <AddChoreModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={createChore}
        allMembers={members}
      />
    </View>
  );
};
