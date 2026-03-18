import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, SectionList, FlatList, Pressable,
  StatusBar, Dimensions, Alert,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, SlideInDown, SlideOutDown, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence, withDelay,
  Easing, interpolate, cancelAnimation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Circle, Path, Skia, RoundedRect,
} from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase } from '@services/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import type {
  PlayerStatsV2, BadgeV2, XpEventV2, BadgeRarity,
} from '@appTypes/index';
import {
  REWARD_LEVELS, BADGE_RARITY_CONFIG,
} from '@appTypes/index';

dayjs.locale('fr');
const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:    '#1A0E00', bgMid:     '#261400',
  bgSurface: '#2E1A00', bgElev:    '#3A2200',
  amber:     '#F5A623', amberSoft: 'rgba(245,166,35,0.15)',
  amberBrd:  'rgba(245,166,35,0.22)', border:    'rgba(255,255,255,0.07)',
  text:      '#FFFFFF', textSec:   'rgba(255,255,255,0.58)',
  textMut:   'rgba(255,255,255,0.32)',
  gold:  '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32',
  green: '#34D399', teal:   '#4ECDC4', purple: '#A78BFA',
  orange: '#FF8C00', danger: '#FF4444',
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getLevelInfo = (xp: number) => {
  let current = REWARD_LEVELS[0];
  let next    = REWARD_LEVELS[1];
  for (let i = REWARD_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= REWARD_LEVELS[i].xpRequired) {
      current = REWARD_LEVELS[i];
      next    = REWARD_LEVELS[Math.min(i + 1, REWARD_LEVELS.length - 1)];
      break;
    }
  }
  const isMax   = current.level === 5;
  const xpRange = next.xpRequired - current.xpRequired;
  const xpDone  = xp - current.xpRequired;
  const progress = isMax ? 1 : Math.min(xpDone / xpRange, 1);
  return { current, next, progress, xpToNext: Math.max(0, next.xpRequired - xp), isMax };
};

const enrichPlayer = (raw: Record<string, unknown>, myUserId: string): PlayerStatsV2 => {
  const xp   = (raw.total_xp as number) ?? 0;
  const lvl  = getLevelInfo(xp);
  return {
    rank:             (raw.rank as number) ?? 0,
    userId:           (raw.user_id as string) ?? '',
    displayName:      (raw.display_name as string) ?? 'Inconnu',
    color:            (raw.color as string) ?? C.amber,
    avatarEmoji:      (raw.avatar_emoji as string) ?? '?',
    totalXp:          xp,
    level:            (raw.level as number) ?? 0,
    currentStreak:    (raw.current_streak as number) ?? 0,
    bestStreak:       (raw.best_streak as number) ?? 0,
    badgesCount:      (raw.badges_count as number) ?? 0,
    tasksCompleted:   (raw.tasks_completed as number) ?? 0,
    isMe:             (raw.user_id as string) === myUserId,
    levelLabel:       lvl.current.label,
    levelColor:       lvl.current.color,
    levelEmoji:       lvl.current.emoji,
    xpToNextLevel:    lvl.xpToNext,
    xpCurrentLevelStart: lvl.current.xpRequired,
    xpProgress:       lvl.progress,
  };
};

const enrichBadge = (raw: Record<string, unknown>): BadgeV2 => {
  const rarity = (raw.rarity as BadgeRarity) ?? 'common';
  const pb     = raw.player_badges as { unlocked_at?: string }[] | null;
  const unlock = pb?.[0];
  return {
    id:          (raw.id as string),
    name:        (raw.name as string),
    description: (raw.description as string),
    emoji:       (raw.emoji as string),
    category:    raw.category as BadgeV2['category'],
    rarity,
    xpReward:    (raw.xp_reward as number) ?? 10,
    isUnlocked:  !!unlock,
    unlockedAt:  unlock?.unlocked_at,
    rarityColor: BADGE_RARITY_CONFIG[rarity].color,
    rarityLabel: BADGE_RARITY_CONFIG[rarity].label,
  };
};

const ACTION_CONFIG: Record<string, { emoji: string; color: string }> = {
  task_complete:     { emoji: '✅', color: '#34D399' },
  chore_complete:    { emoji: '🧹', color: '#4ECDC4' },
  badge_unlock:      { emoji: '🎖️', color: '#FFD700' },
  streak_bonus:      { emoji: '🔥', color: '#FF8C00' },
  shopping_complete: { emoji: '🛒', color: '#F5A623' },
  event_created:     { emoji: '📅', color: '#A78BFA' },
};

// ═══════════════════════════════════════════════════════════
// XP BAR
// ═══════════════════════════════════════════════════════════
const XPBar: React.FC<{ player: PlayerStatsV2; compact?: boolean }> = ({ player, compact = false }) => {
  const barW = useSharedValue(0);
  const lvl  = getLevelInfo(player.totalXp);

  useEffect(() => {
    barW.value = withDelay(300, withTiming(player.xpProgress * 100, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [player.xpProgress, barW]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barW.value}%` }));

  return (
    <View style={{ paddingHorizontal: compact ? 0 : 16, marginTop: compact ? 0 : 8 }}>
      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: player.levelColor }}>
            {player.levelEmoji} Niv. {player.level} · {player.levelLabel}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut }}>
            {player.totalXp} / {lvl.next.xpRequired > player.totalXp ? lvl.next.xpRequired : '∞'} XP
          </Text>
        </View>
      )}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {lvl.isMax ? (
          <LinearGradient colors={['#FF6B6B', '#F5A623', '#FFD700', '#34D399', '#4ECDC4', '#A78BFA']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 4 }} />
        ) : (
          <Animated.View style={[barStyle, { height: 8, borderRadius: 4 }]}>
            <LinearGradient colors={[player.levelColor, player.levelColor + 'AA']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 4 }} />
          </Animated.View>
        )}
      </View>
      {!compact && !lvl.isMax && (
        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 4 }}>
          → Niv. {lvl.next.level} · {lvl.next.label} dans {player.xpToNextLevel} XP
        </Text>
      )}
      {!compact && lvl.isMax && (
        <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: C.gold, marginTop: 4, textAlign: 'center' }}>
          👑 Niveau Maximum — Légende !
        </Text>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// STREAK WIDGET
// ═══════════════════════════════════════════════════════════
const StreakWidget: React.FC<{ streak: number }> = ({ streak }) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1.18, { duration: 800 }), withTiming(1, { duration: 800 }),
    ), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (streak === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(400).delay(80)} style={{
      backgroundColor: 'rgba(255,140,0,0.08)', borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(255,140,0,0.25)',
      marginHorizontal: 16, padding: 14, marginBottom: 14, overflow: 'hidden',
    }}>
      <LinearGradient colors={['rgba(255,140,0,0.15)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Animated.Text style={[{ fontSize: 32 }, pulseStyle]}>🔥</Animated.Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.orange }}>
            {streak} jour{streak > 1 ? 's' : ''} d'affilée !
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 2 }}>
            Continue comme ça pour débloquer des badges streak
          </Text>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const active = i < (streak % 7 || (streak >= 7 ? 7 : streak));
              return (
                <View key={i} style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: active ? C.orange : 'rgba(255,255,255,0.08)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10 }}>{active ? '🔥' : '○'}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// LEADERBOARD ROW
// ═══════════════════════════════════════════════════════════
const LeaderboardRow: React.FC<{ player: PlayerStatsV2; index: number }> = ({ player, index }) => (
  <Animated.View entering={FadeInUp.duration(320).delay(index * 55)}>
    <View style={{
      backgroundColor: player.isMe ? 'rgba(245,166,35,0.08)' : C.bgSurface,
      borderRadius: 18, borderWidth: 1,
      borderColor: player.isMe ? 'rgba(245,166,35,0.30)' : C.border,
      marginHorizontal: 16, marginBottom: 8, overflow: 'hidden',
    }}>
      {player.isMe && <LinearGradient colors={['rgba(245,166,35,0.20)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13, gap: 12 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: player.isMe ? C.amber : C.textMut, width: 24, textAlign: 'center' }}>
          {player.rank}
        </Text>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: player.color + '28', borderWidth: 2, borderColor: player.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>{player.avatarEmoji}</Text>
          <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: player.levelColor + '30', borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Nunito-Bold', color: player.levelColor }}>{player.level}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: C.text }}>{player.displayName.split(' ')[0]}</Text>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: player.levelColor }}>
            Niv. {player.level} · {player.levelLabel}
          </Text>
        </View>
        {player.currentStreak > 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.orange }}>🔥 {player.currentStreak}j</Text>
        )}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: player.isMe ? C.amber : 'rgba(255,255,255,0.70)' }}>
            {player.totalXp}
          </Text>
          <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>pts</Text>
        </View>
      </View>
    </View>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════
// PODIUM VIEW
// ═══════════════════════════════════════════════════════════
const PodiumView: React.FC<{ players: PlayerStatsV2[]; myStats: PlayerStatsV2 | null }> = ({ players, myStats }) => {
  const first  = players[0];
  const second = players[1];
  const third  = players[2];
  const rest   = players.slice(3);

  const crown  = useSharedValue(0);
  const xpVal  = useSharedValue(0);

  useEffect(() => {
    crown.value  = withRepeat(withSequence(withTiming(-4, { duration: 1200 }), withTiming(0, { duration: 1200 })), -1, false);
    if (first) xpVal.value = withDelay(500, withTiming(first.totalXp, { duration: 800 }));
  }, [crown, xpVal, first]);

  const crownStyle = useAnimatedStyle(() => ({ transform: [{ translateY: crown.value }] }));
  const xpStyle    = useAnimatedStyle(() => ({ opacity: 1 }));

  const PodiumBlock: React.FC<{
    player: PlayerStatsV2; rank: 1 | 2 | 3;
    avatarSize: number; blockH: number; medal: string; medalColor: string;
    delay: number;
  }> = ({ player, rank, avatarSize, blockH, medal, medalColor, delay }) => (
    <Animated.View entering={FadeInUp.duration(400).delay(delay)} style={{ alignItems: 'center', flex: rank === 1 ? 1.2 : 1 }}>
      {rank === 1 && (
        <Animated.Text style={[{ fontSize: 28, marginBottom: 2 }, crownStyle]}>👑</Animated.Text>
      )}
      {rank !== 1 && <Text style={{ fontSize: 22, marginBottom: 6 }}>{medal}</Text>}
      <View style={{
        width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
        backgroundColor: player.color + '25',
        borderWidth: rank === 1 ? 4 : 3, borderColor: medalColor,
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
        shadowColor: medalColor, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: rank === 1 ? 0.7 : 0.45, shadowRadius: rank === 1 ? 20 : 10, elevation: 8,
      }}>
        <Text style={{ fontSize: avatarSize * 0.48 }}>{player.avatarEmoji}</Text>
      </View>
      <Text style={{ fontSize: rank === 1 ? 16 : 13, fontFamily: 'Nunito-Bold', color: rank === 1 ? C.text : 'rgba(255,255,255,0.80)', marginBottom: 2 }} numberOfLines={1}>
        {player.displayName.split(' ')[0]}
      </Text>
      <Text style={{ fontSize: rank === 1 ? 24 : 16, fontFamily: 'Nunito-Bold', color: medalColor, marginBottom: 4 }}>
        {player.totalXp}
      </Text>
      <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: player.levelColor, marginBottom: 6 }}>
        Niv. {player.level} · {player.levelLabel}
      </Text>
      {/* Podium block */}
      <View style={{ width: '95%', height: blockH, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={rank === 1 ? [C.amber + '50', C.bgSurface] : [medalColor + '28', C.bgMid]}
          style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center',
            borderTopWidth: rank === 1 ? 3 : 2, borderTopColor: medalColor }}>
          <Text style={{ fontSize: rank === 1 ? 36 : 28, fontFamily: 'Nunito-Bold', color: medalColor + '30' }}>{rank}</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  if (players.length === 0) return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>🏆</Text>
      <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 6 }}>Aucun joueur encore</Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center' }}>
        Complète des tâches pour gagner des XP et apparaître dans le classement !
      </Text>
    </View>
  );

  return (
    <View>
      {/* Podium top 3 */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 16 }}>
          {second && <PodiumBlock player={second} rank={2} avatarSize={68} blockH={80} medal="🥈" medalColor={C.silver} delay={100} />}
          {first  && <PodiumBlock player={first}  rank={1} avatarSize={88} blockH={100} medal="🥇" medalColor={C.gold}   delay={50}  />}
          {third  && <PodiumBlock player={third}  rank={3} avatarSize={60} blockH={60} medal="🥉" medalColor={C.bronze} delay={150} />}
        </View>
      </View>

      {/* XP bar du joueur connecté */}
      {myStats && (
        <Animated.View entering={FadeIn.duration(400).delay(300)} style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: C.amberBrd, padding: 14, overflow: 'hidden' }}>
          <LinearGradient colors={['transparent', 'rgba(245,166,35,0.20)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
            Ma progression
          </Text>
          <XPBar player={myStats} />
        </Animated.View>
      )}

      {/* Rest of leaderboard */}
      {rest.map((p, i) => <LeaderboardRow key={p.userId} player={p} index={i} />)}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// BADGE CARD
// ═══════════════════════════════════════════════════════════
const BadgeCard: React.FC<{ badge: BadgeV2; index: number; onPress: (b: BadgeV2) => void }> = ({ badge, index, onPress }) => {
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const handlePress = () => {
    if (!badge.isUnlocked) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
        withTiming(-6, { duration: 60 }), withTiming(6, { duration: 60 }),
        withTiming(0,  { duration: 60 }),
      );
    } else {
      onPress(badge);
    }
  };

  const isLegendary = badge.rarity === 'legendary';

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(index * 40)} style={[shakeStyle, { flex: 1, margin: 4 }]}>
      <Pressable onPress={handlePress} style={{
        backgroundColor: badge.isUnlocked ? `${badge.rarityColor}18` : C.bgSurface,
        borderRadius: 18, padding: 14, alignItems: 'center',
        borderWidth: isLegendary ? 2 : 1,
        borderColor: badge.isUnlocked ? badge.rarityColor : 'rgba(255,255,255,0.08)',
        opacity: badge.isUnlocked ? 1 : 0.5,
        shadowColor: badge.isUnlocked ? badge.rarityColor : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: badge.isUnlocked ? 0.40 : 0,
        shadowRadius: badge.isUnlocked ? 12 : 0, elevation: badge.isUnlocked ? 5 : 0,
      }}>
        <View style={{ backgroundColor: badge.rarityColor + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 8 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Nunito-Bold', color: badge.rarityColor, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {badge.rarityLabel}
          </Text>
        </View>
        <Text style={{ fontSize: 36, marginBottom: 6, opacity: badge.isUnlocked ? 1 : 0.4 }}>
          {badge.isUnlocked ? badge.emoji : '🔒'}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: badge.isUnlocked ? C.text : C.textMut, textAlign: 'center', marginBottom: 3 }} numberOfLines={2}>
          {badge.name}
        </Text>
        {badge.isUnlocked && badge.unlockedAt ? (
          <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>
            {dayjs(badge.unlockedAt).format('D MMM YYYY')}
          </Text>
        ) : (
          <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: badge.rarityColor }}>
            +{badge.xpReward} XP
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// BADGES VIEW
// ═══════════════════════════════════════════════════════════
const BadgesView: React.FC<{ badges: BadgeV2[]; myStats: PlayerStatsV2 | null }> = ({ badges, myStats }) => {
  const [catFilter, setCatFilter] = useState<'all' | BadgeV2['category']>('all');
  const unlocked = badges.filter(b => b.isUnlocked).length;

  const filtered = useMemo(() => {
    if (catFilter === 'all') return badges;
    return badges.filter(b => b.category === catFilter);
  }, [badges, catFilter]);

  const CAT_TABS: { key: 'all' | BadgeV2['category']; label: string; emoji: string }[] = [
    { key: 'all',     label: 'Tous',    emoji: '🎖️' },
    { key: 'tasks',   label: 'Tâches',  emoji: '✅' },
    { key: 'streak',  label: 'Streak',  emoji: '🔥' },
    { key: 'special', label: 'Spéciaux',emoji: '⭐' },
    { key: 'social',  label: 'Social',  emoji: '🤝' },
  ];

  const rows = useMemo(() => {
    const r: BadgeV2[][] = [];
    for (let i = 0; i < filtered.length; i += 3) r.push(filtered.slice(i, i + 3));
    return r;
  }, [filtered]);

  return (
    <View>
      {/* Stats */}
      <Animated.View entering={FadeInDown.duration(400)} style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: C.amberBrd, padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text }}>{unlocked} / {badges.length} badges</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['rare', 'epic', 'legendary'] as BadgeRarity[]).map(r => {
              const count = badges.filter(b => b.rarity === r && b.isUnlocked).length;
              if (count === 0) return null;
              return (
                <View key={r} style={{ backgroundColor: BADGE_RARITY_CONFIG[r].color + '20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: BADGE_RARITY_CONFIG[r].color }}>{count} {BADGE_RARITY_CONFIG[r].label.toLowerCase()}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <LinearGradient colors={[C.gold, C.amber]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 6, width: `${(unlocked / Math.max(badges.length, 1)) * 100}%`, borderRadius: 3 }} />
        </View>
      </Animated.View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 14 }}>
        {CAT_TABS.map(tab => {
          const active = catFilter === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setCatFilter(tab.key)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
              backgroundColor: active ? C.amber : C.bgElev,
              borderWidth: 1, borderColor: active ? C.amber : 'rgba(245,166,35,0.15)',
              shadowColor: active ? C.amber : 'transparent', shadowOpacity: active ? 0.45 : 0,
              shadowRadius: 10, elevation: active ? 5 : 0,
            }}>
              <Text style={{ fontSize: 12 }}>{tab.emoji}</Text>
              <Text style={{ fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular', color: active ? '#1A0E00' : C.textSec }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
          {row.map((b, bi) => <BadgeCard key={b.id} badge={b} index={ri * 3 + bi} onPress={() => {}} />)}
          {row.length < 3 && Array.from({ length: 3 - row.length }, (_, j) => <View key={`empty-${j}`} style={{ flex: 1, margin: 4 }} />)}
        </View>
      ))}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════
const HistoryView: React.FC<{ events: XpEventV2[] }> = ({ events }) => {
  const sections = useMemo(() => {
    const map = new Map<string, XpEventV2[]>();
    events.forEach(e => {
      const key = dayjs(e.createdAt).isSame(dayjs(), 'day') ? "Aujourd'hui"
        : dayjs(e.createdAt).isSame(dayjs().subtract(1, 'day'), 'day') ? 'Hier'
        : dayjs(e.createdAt).format('D MMMM YYYY');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [events]);

  if (events.length === 0) return (
    <View style={{ alignItems: 'center', padding: 48 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>📜</Text>
      <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 6 }}>Aucune activité</Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center' }}>
        Complète des tâches pour voir ton historique XP ici
      </Text>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => item.id}
      scrollEnabled={false}
      renderSectionHeader={({ section }) => {
        const total = section.data.reduce((s, e) => s + e.xpEarned, 0);
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(245,166,35,0.20)' }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber }}>{section.title}</Text>
            </View>
            <LinearGradient colors={['rgba(245,166,35,0.25)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
            <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>+{total} XP</Text>
          </View>
        );
      }}
      renderItem={({ item, index }) => {
        const ac = ACTION_CONFIG[item.actionType] ?? { emoji: '⚡', color: C.amber };
        return (
          <Animated.View entering={FadeInUp.duration(280).delay(index * 40)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSurface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(245,166,35,0.10)', padding: 12, marginHorizontal: 16, marginBottom: 6, gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ac.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{ac.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>
                  {item.description || item.actionType}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                  {dayjs(item.createdAt).format('HH:mm')} · {item.userName}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.green }}>+{item.xpEarned}</Text>
              </View>
            </View>
          </Animated.View>
        );
      }}
      contentContainerStyle={{ paddingBottom: 16 }}
    />
  );
};

// ═══════════════════════════════════════════════════════════
// LEVEL UP MODAL
// ═══════════════════════════════════════════════════════════
const LevelUpModal: React.FC<{ levelUp: { from: number; to: number }; onClose: () => void }> = ({ levelUp, onClose }) => {
  const lvlInfo   = REWARD_LEVELS[levelUp.to] ?? REWARD_LEVELS[REWARD_LEVELS.length - 1];
  const emojiScale = useSharedValue(0);
  const burst      = useSharedValue(0);

  useEffect(() => {
    emojiScale.value = withDelay(400, withSpring(1, { damping: 8 }));
    burst.value = withTiming(1, { duration: 1500 });
  }, [emojiScale, burst]);

  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: emojiScale.value }] }));

  // Burst particles
  const PARTICLES = 12;
  const particles = Array.from({ length: PARTICLES }, (_, i) => {
    const angle  = (i / PARTICLES) * 2 * Math.PI;
    const endX   = 90 + 70 * Math.cos(angle);
    const endY   = 90 + 70 * Math.sin(angle);
    return { x1: 90, y1: 90, x2: endX, y2: endY, color: i % 3 === 0 ? C.gold : i % 3 === 1 ? lvlInfo.color : '#FFFFFF' };
  });

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 200, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Pressable onPress={e => e.stopPropagation()}>
        <Animated.View entering={ZoomIn.springify()} style={{
          backgroundColor: C.bgMid, borderRadius: 28, borderWidth: 2,
          borderColor: lvlInfo.color, padding: 32, alignItems: 'center', width: SW - 48,
          shadowColor: lvlInfo.color, shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5, shadowRadius: 40, elevation: 20,
        }}>
          {/* Burst */}
          <Canvas style={{ position: 'absolute', width: 180, height: 180, top: 0 }}>
            {particles.map((p, i) => {
              const path = Skia.Path.Make();
              path.moveTo(p.x1, p.y1); path.lineTo(p.x2, p.y2);
              return <Path key={i} path={path} color={p.color + '80'} style="stroke" strokeWidth={2} />;
            })}
          </Canvas>

          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: lvlInfo.color, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
            Niveau supérieur !
          </Text>

          <Animated.Text style={[{ fontSize: 72, marginBottom: 8 }, emojiStyle]}>
            {lvlInfo.emoji}
          </Animated.Text>

          <Text style={{ fontSize: 48, fontFamily: 'Nunito-Bold', color: lvlInfo.color, marginBottom: 4 }}>
            Niv. {levelUp.to}
          </Text>

          <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 20 }}>
            Tu es maintenant {lvlInfo.label} !
          </Text>

          <Pressable onPress={onClose} style={{ borderRadius: 16, overflow: 'hidden', width: '100%' }}>
            <LinearGradient colors={[lvlInfo.color, lvlInfo.color + 'BB']} style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Continuer</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Pressable>
  );
};

// ═══════════════════════════════════════════════════════════
// BADGE UNLOCK TOAST
// ═══════════════════════════════════════════════════════════
const BadgeUnlockToast: React.FC<{ badge: BadgeV2; onDismiss: () => void }> = ({ badge, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown.springify()}
      style={{
        position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 150,
        backgroundColor: badge.rarityColor + '22', borderRadius: 20,
        borderWidth: 1.5, borderColor: badge.rarityColor, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        shadowColor: badge.rarityColor, shadowRadius: 20, shadowOpacity: 0.5, elevation: 12,
      }}>
      <Animated.Text entering={ZoomIn.springify()} style={{ fontSize: 36 }}>{badge.emoji}</Animated.Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: badge.rarityColor }}>Badge débloqué !</Text>
        <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.text }}>{badge.name}</Text>
        <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.green }}>+{badge.xpReward} XP</Text>
      </View>
      <View style={{ backgroundColor: badge.rarityColor + '30', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
        <Text style={{ fontSize: 8, fontFamily: 'Nunito-Bold', color: badge.rarityColor, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {badge.rarityLabel}
        </Text>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
type Tab = 'leaderboard' | 'badges' | 'history';

export const RewardsScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [leaderboard, setLeaderboard] = useState<PlayerStatsV2[]>([]);
  const [badges,      setBadges]      = useState<BadgeV2[]>([]);
  const [history,     setHistory]     = useState<XpEventV2[]>([]);
  const [activeTab,   setActiveTab]   = useState<Tab>('leaderboard');
  const [newBadge,    setNewBadge]    = useState<BadgeV2 | null>(null);
  const [levelUp,     setLevelUp]     = useState<{ from: number; to: number } | null>(null);
  const prevLevelRef  = useRef<number | null>(null);

  const myUserId = user?.id ?? '';
  const myStats  = useMemo(() => leaderboard.find(p => p.isMe) ?? null, [leaderboard]);

  // ── Load ──
  const loadLeaderboard = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.rpc('get_leaderboard', { p_household_id: household.id });
    if (data) {
      const enriched = (data as Record<string, unknown>[]).map((p, i) => ({
        ...enrichPlayer(p, myUserId), rank: i + 1,
      }));
      setLeaderboard(enriched);
      const me = enriched.find(p => p.isMe);
      if (me) {
        if (prevLevelRef.current !== null && me.level > prevLevelRef.current) {
          setLevelUp({ from: prevLevelRef.current, to: me.level });
        }
        prevLevelRef.current = me.level;
      }
    }
  }, [household?.id, myUserId]);

  const loadBadges = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('badge_definitions').select(`
      *, player_badges!left(unlocked_at)
    `).order('sort_order');
    if (data) setBadges(data.map(d => enrichBadge(d as Record<string, unknown>)));
  }, [household?.id]);

  const loadHistory = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('xp_history').select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false }).limit(50);
    if (data) setHistory((data as Record<string, unknown>[]).map(e => {
      const m = members.find(x => x.user_id === e.user_id || x.id === e.user_id);
      return {
        id:          e.id as string,
        userId:      e.user_id as string,
        userName:    m?.display_name ?? 'Inconnu',
        userColor:   m?.color ?? C.amber,
        actionType:  e.action_type as string,
        xpEarned:    e.xp_earned as number,
        description: (e.description as string) ?? (e.action_type as string),
        createdAt:   e.created_at as string,
      };
    }));
  }, [household?.id, members]);

  useEffect(() => { loadLeaderboard(); loadBadges(); loadHistory(); }, [loadLeaderboard, loadBadges, loadHistory]);

  // ── Realtime ──
  useEffect(() => {
    if (!household?.id) return;
    const sub = supabase.channel(`rewards-${household.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_stats', filter: `household_id=eq.${household.id}` }, () => loadLeaderboard())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_badges', filter: `household_id=eq.${household.id}` }, async (payload) => {
        if ((payload.new as Record<string, unknown>).user_id === myUserId) {
          await loadBadges();
          const badge = badges.find(b => b.id === (payload.new as Record<string, unknown>).badge_id);
          if (badge) { setNewBadge({ ...badge, isUnlocked: true }); }
        } else {
          loadBadges();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'xp_history', filter: `household_id=eq.${household.id}` }, () => loadHistory())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [household?.id, myUserId, badges, loadLeaderboard, loadBadges, loadHistory]);

  const unlockedBadges = useMemo(() => badges.filter(b => b.isUnlocked).length, [badges]);

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: 'leaderboard', label: 'Classement', emoji: '🏆' },
    { key: 'badges',      label: 'Badges',     emoji: '🎖️' },
    { key: 'history',     label: 'Historique', emoji: '📜' },
  ];

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,215,0,0.03)' }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(255,215,0,0.09)', 'rgba(245,166,35,0.03)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 28 }}>🏆</Text>
                <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>Récompenses</Text>
              </View>
              {myStats && myStats.currentStreak > 0 && (
                <View style={{ backgroundColor: 'rgba(255,140,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.orange }}>🔥 {myStats.currentStreak} jours</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', marginBottom: 14 }}>
              <Text style={{ color: C.textMut }}>Points </Text>
              <Text style={{ color: C.amber + '99' }}>·</Text>
              <Text style={{ color: C.textMut }}> Badges </Text>
              <Text style={{ color: C.amber + '99' }}>·</Text>
              <Text style={{ color: C.textMut }}> Classement</Text>
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ══ STREAK WIDGET ══ */}
        {myStats && <StreakWidget streak={myStats.currentStreak} />}

        {/* ══ TABS ══ */}
        <Animated.View entering={FadeIn.duration(400).delay(100)} style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 4, paddingVertical: 9, borderRadius: 20,
                backgroundColor: active ? C.amber : C.bgElev,
                borderWidth: 1, borderColor: active ? C.amber : 'rgba(245,166,35,0.15)',
                shadowColor: active ? C.amber : 'transparent',
                shadowOffset: { width: 0, height: 4 }, shadowOpacity: active ? 0.45 : 0,
                shadowRadius: 12, elevation: active ? 6 : 0,
              }}>
                <Text style={{ fontSize: 13 }}>{tab.emoji}</Text>
                <Text style={{ fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular', color: active ? '#1A0E00' : C.textSec }}>
                  {tab.label}
                </Text>
                {tab.key === 'badges' && unlockedBadges > 0 && (
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(26,14,0,0.35)' : C.gold, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>{unlockedBadges}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* ══ CONTENT ══ */}
        {activeTab === 'leaderboard' && <PodiumView players={leaderboard} myStats={myStats} />}
        {activeTab === 'badges'      && <BadgesView badges={badges} myStats={myStats} />}
        {activeTab === 'history'     && <HistoryView events={history} />}

      </ScrollView>

      {/* ══ BADGE TOAST ══ */}
      {newBadge && (
        <BadgeUnlockToast badge={newBadge} onDismiss={() => setNewBadge(null)} />
      )}

      {/* ══ LEVEL UP MODAL ══ */}
      {levelUp && (
        <LevelUpModal levelUp={levelUp} onClose={() => setLevelUp(null)} />
      )}
    </View>
  );
};
