import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Layout,
} from 'react-native-reanimated';
import { Canvas, Path, Circle, Group, vec, Line as SkiaLine } from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type { FoodItem as FoodItemType, FoodCategory, ExpiryStatus, HouseholdMember } from '@appTypes/index';

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

  expired:  '#FF4444',
  urgent:   '#FF8C00',
  soon:     '#F5A623',
  ok:       '#34D399',

  expiredBg:     'rgba(255,68,68,0.12)',
  urgentBg:      'rgba(255,140,0,0.12)',
  soonBg:        'rgba(245,166,35,0.12)',
  okBg:          'rgba(52,211,153,0.12)',

  expiredBorder: 'rgba(255,68,68,0.30)',
  urgentBorder:  'rgba(255,140,0,0.30)',
  soonBorder:    'rgba(245,166,35,0.30)',
  okBorder:      'rgba(52,211,153,0.25)',

  catDairy:    '#87CEEB',
  catMeat:     '#FF6B6B',
  catVeg:      '#34D399',
  catFruit:    '#FFA07A',
  catFrozen:   '#4ECDC4',
  catDry:      '#F5A623',
  catBeverage: '#A78BFA',
  catOther:    'rgba(255,255,255,0.45)',
};

// ═══════════════════════════════════════════════════════════
// CATEGORY CONFIG
// ═══════════════════════════════════════════════════════════
const CAT_CFG: Record<string, { emoji: string; label: string; color: string }> = {
  dairy:      { emoji: '🥛', label: 'Laitages',  color: C.catDairy },
  meat:       { emoji: '🥩', label: 'Viande',    color: C.catMeat },
  vegetables: { emoji: '🥦', label: 'Légumes',   color: C.catVeg },
  fruits:     { emoji: '🍎', label: 'Fruits',    color: C.catFruit },
  frozen:     { emoji: '❄️', label: 'Surgelés',  color: C.catFrozen },
  dry:        { emoji: '🌾', label: 'Épicerie',  color: C.catDry },
  beverage:   { emoji: '🥤', label: 'Boissons',  color: C.catBeverage },
  other:      { emoji: '📦', label: 'Autre',     color: C.catOther },
};

const MODAL_CATS: { key: string; emoji: string; label: string; color: string }[] = [
  { key: 'dairy',      emoji: '🥛', label: 'Laitages', color: C.catDairy },
  { key: 'meat',       emoji: '🥩', label: 'Viande',   color: C.catMeat },
  { key: 'vegetables', emoji: '🥦', label: 'Légumes',  color: C.catVeg },
  { key: 'fruits',     emoji: '🍎', label: 'Fruits',   color: C.catFruit },
  { key: 'frozen',     emoji: '❄️', label: 'Surgelés', color: C.catFrozen },
  { key: 'dry',        emoji: '🌾', label: 'Épicerie', color: C.catDry },
  { key: 'beverage',   emoji: '🥤', label: 'Boissons', color: C.catBeverage },
  { key: 'other',      emoji: '📦', label: 'Autre',    color: C.catOther },
];

const FILTER_TABS = [
  { key: 'all', label: 'Tous', emoji: '' },
  { key: 'dairy', label: 'Laitages', emoji: '🥛' },
  { key: 'meat', label: 'Viande', emoji: '🥩' },
  { key: 'vegetables', label: 'Légumes', emoji: '🥦' },
  { key: 'fruits', label: 'Fruits', emoji: '🍎' },
  { key: 'frozen', label: 'Surgelés', emoji: '❄️' },
  { key: 'dry', label: 'Épicerie', emoji: '🌾' },
  { key: 'other', label: 'Autre', emoji: '📦' },
];

const UNITS = ['pièce(s)', 'g', 'kg', 'ml', 'L', 'portion(s)'];

const SORT_OPTIONS = [
  { key: 'expiry', label: "Date d'expiration ↑" },
  { key: 'name', label: 'Nom A→Z' },
  { key: 'category', label: 'Catégorie' },
  { key: 'recent', label: 'Ajouté récemment' },
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getExp = (d: string): ExpiryStatus => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(d); exp.setHours(0, 0, 0, 0);
  const diff = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 2) return 'urgent';
  if (diff <= 5) return 'warning';
  return 'ok';
};

const getDays = (d: string): number => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(d); exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / 86400000);
};

const sColor = (s: ExpiryStatus) =>
  s === 'expired' ? C.expired : s === 'urgent' ? C.urgent : s === 'warning' ? C.soon : C.ok;
const sBg = (s: ExpiryStatus) =>
  s === 'expired' ? C.expiredBg : s === 'urgent' ? C.urgentBg : s === 'warning' ? C.soonBg : C.okBg;
const sBorder = (s: ExpiryStatus) =>
  s === 'expired' ? C.expiredBorder : s === 'urgent' ? C.urgentBorder : s === 'warning' ? C.soonBorder : C.okBorder;

const DAY_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${DAY_SHORT[dt.getMonth()]}`;
};

const fmtDays = (days: number): string => {
  if (days < 0) return 'Expiré';
  if (days === 0) return "Auj.";
  if (days === 1) return '1j';
  if (days <= 14) return `${days}j`;
  return `${Math.floor(days / 7)} sem`;
};

// Arc path helper for Skia
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const toRad = (a: number) => (a * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ═══════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════
const StatCard: React.FC<{
  label: string; count: number; total: number;
  color: string; bg: string; border: string;
  iconPath: string; delay: number;
}> = ({ label, count, total, color, bg, border, iconPath, delay }) => {
  const scale = useSharedValue(0.9);
  const barWidth = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 120 }));
    const pct = total > 0 ? (count / total) * 100 : 0;
    barWidth.value = withDelay(delay + 400,
      withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) }));

    if (count > 0 && (label === 'Expiré' || label === 'Urgent')) {
      pulseScale.value = withDelay(delay + 600,
        withRepeat(withSequence(
          withTiming(1.05, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        ), -1, true));
    }
  }, [count, total, delay, label, scale, barWidth, pulseScale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.9, 1], [0, 1]),
  }));
  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const barFill = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  return (
    <Animated.View style={[{
      flex: 1, backgroundColor: bg, borderRadius: 18,
      borderWidth: 1, borderColor: border, padding: 14, overflow: 'hidden',
    }, cardStyle]}>
      <View style={{
        position: 'absolute', top: 0, left: 12, right: 12, height: 1, overflow: 'hidden',
      }}>
        <LinearGradient colors={['transparent', color + '55', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </View>
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: color + '22',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
      }}>
        <Canvas style={{ width: 16, height: 16 }}>
          <Path path={iconPath} color={color} style="stroke"
            strokeWidth={1.8} strokeCap="round" strokeJoin="round" />
        </Canvas>
      </View>
      <Animated.View style={numStyle}>
        <Text style={{
          fontFamily: 'Nunito-Bold', fontSize: 34, color,
          letterSpacing: -1, lineHeight: 38,
        }}>{count}</Text>
      </Animated.View>
      <Text style={{
        fontFamily: 'DMSans-Regular', fontSize: 12,
        color: 'rgba(255,255,255,0.5)', marginTop: 2,
      }}>{label}</Text>
      <View style={{
        height: 3, borderRadius: 2, marginTop: 10,
        backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <Animated.View style={[{ height: 3, borderRadius: 2, backgroundColor: color }, barFill]} />
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// FOOD ITEM CARD
// ═══════════════════════════════════════════════════════════
const FoodCard: React.FC<{
  item: FoodItemType; members: HouseholdMember[];
  index: number; onConsume: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}> = React.memo(({ item, members, index, onConsume, onDelete }) => {
  const st = getExp(item.expiry_date);
  const days = getDays(item.expiry_date);
  const col = sColor(st);
  const brd = sBorder(st);
  const cat = CAT_CFG[item.category] ?? CAT_CFG.other;
  const addedMember = members.find(m => m.id === item.added_by)
    ?? members.find(m => m.user_id === item.added_by);
  const ringProgress = st === 'ok' ? 1 : st === 'expired' ? 0 : Math.max(0, Math.min(1, days / 14));

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (st === 'expired') {
      pulseScale.value = withRepeat(withSequence(
        withTiming(1.03, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ), -1, true);
    }
  }, [st, pulseScale]);
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: st === 'expired' ? pulseScale.value : 1 }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(520 + index * 70).duration(400).springify()}
      layout={Layout.springify()}
      style={{
        backgroundColor: C.bgSurface, borderRadius: 18, borderWidth: 1,
        borderColor: brd, marginBottom: 8, overflow: 'hidden',
        shadowColor: col, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.20, shadowRadius: 10, elevation: 5,
      }}>
      {/* Highlight line */}
      <View style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, overflow: 'hidden' }}>
        <LinearGradient colors={['transparent', col + '55', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </View>
      {/* Left edge bar */}
      <View style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 3.5,
        borderRadius: 2, backgroundColor: col,
        shadowColor: col, shadowRadius: 8, shadowOpacity: 0.9, elevation: 3,
      }} />
      <Pressable
        onLongPress={() => onDelete(item.id, item.name)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 18, paddingBottom: 8 }}>
        {/* Category icon */}
        <View style={{
          width: 46, height: 46, borderRadius: 14,
          backgroundColor: cat.color + '22', borderWidth: 1.5, borderColor: cat.color + '44',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
          {st === 'expired' && (
            <View style={{
              position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8,
              backgroundColor: C.expired, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>✕</Text>
            </View>
          )}
        </View>
        {/* Central content */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={{
              fontFamily: 'Nunito-SemiBold', fontSize: 16, color: C.textPrimary, flex: 1,
              ...(item.consumed_at ? { opacity: 0.4, textDecorationLine: 'line-through' as const } : {}),
            }}>{item.name}</Text>
            {item.quantity ? (
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.textMuted }}>
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: cat.color + '18', borderWidth: 1, borderColor: cat.color + '33',
              borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
            }}>
              <Text style={{ fontSize: 10 }}>{cat.emoji}</Text>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: cat.color }}>{cat.label}</Text>
            </View>
            {addedMember && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: addedMember.color }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {addedMember.display_name}
                </Text>
              </View>
            )}
          </View>
        </View>
        {/* DLC circle */}
        <View style={{ marginLeft: 12 }}>
          <Animated.View style={[{ alignItems: 'center' }, circleStyle]}>
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              borderWidth: 2.5, borderColor: col, backgroundColor: col + '18',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: col, shadowRadius: 10, shadowOpacity: 0.5, elevation: 4,
            }}>
              <Canvas style={{ position: 'absolute', width: 54, height: 54 }}>
                <Circle cx={27} cy={27} r={24} color={col + '1A'} style="stroke" strokeWidth={2.5} />
                {ringProgress > 0 && ringProgress < 1 && (
                  <Path path={describeArc(27, 27, 24, -90, -90 + ringProgress * 360)}
                    color={col} style="stroke" strokeWidth={2.5} strokeCap="round" />
                )}
              </Canvas>
              {st === 'expired' ? (
                <Text style={{ fontSize: 16, color: C.expired, fontWeight: '800' }}>✕</Text>
              ) : (
                <>
                  <Text style={{
                    fontFamily: 'Nunito-Bold', fontSize: st === 'ok' ? 14 : 16,
                    color: col, lineHeight: 18,
                  }}>{fmtDays(days)}</Text>
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 8, color: col, marginTop: -1 }}>reste</Text>
                </>
              )}
            </View>
            <Text style={{
              fontFamily: 'DMSans-Regular', fontSize: 9,
              color: 'rgba(255,255,255,0.30)', marginTop: 3,
            }}>{fmtDate(item.expiry_date)}</Text>
          </Animated.View>
        </View>
      </Pressable>

      {/* Action buttons row */}
      <View style={{
        flexDirection: 'row', gap: 8,
        paddingHorizontal: 14, paddingBottom: 12, paddingLeft: 18,
      }}>
        <Pressable
          onPress={() => onConsume(item.id)}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, height: 36, borderRadius: 12,
            backgroundColor: 'rgba(52,211,153,0.10)',
            borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
          }}>
          <Text style={{ fontSize: 14 }}>✅</Text>
          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 12,
            color: C.ok,
          }}>Consommé</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(item.id, item.name)}
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: 'rgba(255,68,68,0.10)',
            borderWidth: 1, borderColor: 'rgba(255,68,68,0.25)',
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 14 }}>🗑️</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════
// URGENCY ALERT SECTION
// ═══════════════════════════════════════════════════════════
const UrgencyAlert: React.FC<{ items: FoodItemType[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.delay(480).duration(500).springify()} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Canvas style={{ width: 18, height: 18 }}>
          <Path path="M9 2 L16.5 15.5 L1.5 15.5 Z" color={C.urgent}
            style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" />
          <Path path="M9 7 L9 10.5" color={C.urgent} style="stroke" strokeWidth={1.5} strokeCap="round" />
          <Circle cx={9} cy={13} r={0.8} color={C.urgent} />
        </Canvas>
        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: C.urgent }}>
          À consommer rapidement
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map(item => {
          const st = getExp(item.expiry_date);
          const days = getDays(item.expiry_date);
          const col = sColor(st);
          const brd = sBorder(st);
          const bg2 = sBg(st);
          const cat = CAT_CFG[item.category] ?? CAT_CFG.other;
          return (
            <View key={item.id} style={{
              width: 120, borderRadius: 14, borderWidth: 1.5,
              borderColor: brd, backgroundColor: bg2, padding: 10, marginRight: 8,
              shadowColor: col, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
            }}>
              {st === 'expired' && (
                <View style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 10, height: 10, borderRadius: 5, backgroundColor: C.expired,
                }} />
              )}
              <Text style={{ fontSize: 28, marginBottom: 6 }}>{cat.emoji}</Text>
              <Text numberOfLines={1} style={{
                fontFamily: 'Nunito-SemiBold', fontSize: 13, color: C.textPrimary,
              }}>{item.name}</Text>
              <View style={{
                marginTop: 6, alignSelf: 'flex-start',
                backgroundColor: col + '22', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 2,
              }}>
                <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: col }}>
                  {days < 0 ? 'Expiré' : days === 0 ? "Auj." : days === 1 ? 'Demain' : `${days} j`}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// EMPTY STATE (Skia)
// ═══════════════════════════════════════════════════════════
const EmptyState: React.FC = () => (
  <Animated.View entering={FadeIn.delay(500).duration(600)} style={{ alignItems: 'center', paddingVertical: 40 }}>
    <Canvas style={{ width: 240, height: 200 }}>
      <Circle cx={120} cy={100} r={95} color="rgba(52,211,153,0.04)" />
      <Circle cx={135} cy={85} r={50} color="rgba(245,166,35,0.06)" />
      <SkiaLine p1={vec(50, 75)} p2={vec(190, 75)} color="rgba(255,255,255,0.12)" style="stroke" strokeWidth={1} />
      <SkiaLine p1={vec(40, 115)} p2={vec(200, 115)} color="rgba(255,255,255,0.12)" style="stroke" strokeWidth={1} />
      <SkiaLine p1={vec(50, 155)} p2={vec(190, 155)} color="rgba(255,255,255,0.12)" style="stroke" strokeWidth={1} />
      <Group transform={[{ translateX: 105 }, { translateY: 88 }, { rotate: -0.087 }]}>
        <Path path="M15 0 C6 0 0 8 0 18 C0 25 6 30 15 30 C24 30 30 25 30 18 C30 8 24 0 15 0 Z"
          color="rgba(52,211,153,0.6)" />
        <Circle cx={15} cy={18} r={6} color="rgba(245,166,35,0.8)" />
      </Group>
      <Circle cx={60} cy={50} r={2.5} color={C.amber} opacity={0.6} />
      <Circle cx={175} cy={60} r={2} color={C.amber} opacity={0.5} />
      <Circle cx={85} cy={140} r={2} color={C.amber} opacity={0.4} />
      <Circle cx={165} cy={145} r={2.5} color={C.amber} opacity={0.7} />
    </Canvas>
    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 20, color: C.textPrimary, marginTop: 8 }}>
      Aucun aliment suivi
    </Text>
    <Text style={{
      fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.38)',
      textAlign: 'center', marginTop: 8, lineHeight: 20,
    }}>{"Ajoute tes produits pour suivre\nleurs dates de péremption"}</Text>
    <View style={{
      marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberGlow,
      borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
    }}>
      <Text style={{ fontSize: 16, color: C.ok }}>+</Text>
      <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: C.amber }}>Ajouter un aliment</Text>
    </View>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const FoodTrackerScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const members: HouseholdMember[] = useAuthStore(s => s.members) ?? [];
  const member = useAuthStore(s => s.member);

  const [foods, setFoods] = useState<FoodItemType[]>([]);
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('expiry');
  const [showSort, setShowSort] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Modal form
  const [mName, setMName] = useState('');
  const [mCat, setMCat] = useState('other');
  const [mQty, setMQty] = useState('');
  const [mUnit, setMUnit] = useState('pièce(s)');
  const [mExpiry, setMExpiry] = useState('');

  // ─── Data fetching ────────────────────────────────────
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('food_items').select('*')
      .eq('household_id', household.id).is('consumed_at', null)
      .order('expiry_date', { ascending: true });
    setFoods((data ?? []) as FoodItemType[]);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!household?.id) return;
    const unsub = subscribeToTable('food_items', household.id, () => { load(); });
    return unsub;
  }, [household?.id, load]);

  // ─── Consume / Delete ──────────────────────────────────
  const consume = useCallback(async (id: string) => {
    await supabase.from('food_items').update({ consumed_at: new Date().toISOString() }).eq('id', id);
    await notificationService.cancelFoodReminders(id);
    load();
  }, [load]);

  const handleDelete = useCallback((id: string, name: string) => {
    setDeleteConfirm({ id, name });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await supabase.from('food_items').delete().eq('id', deleteConfirm.id);
    await notificationService.cancelFoodReminders(deleteConfirm.id);
    setDeleteConfirm(null);
    load();
  }, [deleteConfirm, load]);

  // ─── Stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const r = { expired: 0, urgent: 0, warning: 0, ok: 0 };
    foods.forEach(f => { r[getExp(f.expiry_date)]++; });
    return r;
  }, [foods]);
  const total = foods.length;

  // ─── Filter + Sort ────────────────────────────────────
  const filtered = useMemo(() => {
    let list = filter === 'all' ? foods : foods.filter(f => f.category === filter);
    switch (sortKey) {
      case 'name': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'category': list = [...list].sort((a, b) => a.category.localeCompare(b.category)); break;
      case 'recent': list = [...list].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      default: break;
    }
    return list;
  }, [foods, filter, sortKey]);

  const urgentItems = useMemo(() =>
    foods.filter(f => { const s = getExp(f.expiry_date); return s === 'expired' || s === 'urgent'; }),
  [foods]);

  // ─── Add food ─────────────────────────────────────────
  const resetModal = useCallback(() => {
    setMName(''); setMCat('other'); setMQty(''); setMUnit('pièce(s)'); setMExpiry('');
  }, []);

  const addFood = useCallback(async () => {
    if (!mName.trim() || !mExpiry.trim()) {
      Alert.alert('Champs requis', 'Remplis le nom et la date de péremption.');
      return;
    }
    if (!household?.id || !member?.user_id) return;
    const { data, error } = await supabase.from('food_items').insert({
      household_id: household.id,
      added_by: member.user_id,
      name: mName.trim(),
      quantity: mQty.trim() || null,
      unit: mUnit,
      category: mCat,
      expiry_date: mExpiry,
    }).select().single();
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    if (data) {
      await notificationService.scheduleFoodExpiryReminder({
        id: data.id,
        name: data.name,
        expiry_date: data.expiry_date,
        quantity: data.quantity ?? '',
      });
    }
    setModalVisible(false);
    resetModal();
    load();
  }, [mName, mExpiry, mCat, mQty, mUnit, household?.id, member?.user_id, load, resetModal]);

  const setQuickDate = useCallback((daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setMExpiry(d.toISOString().split('T')[0]);
  }, []);

  const expiryPreview = useMemo(() => {
    if (!mExpiry) return null;
    const days = getDays(mExpiry);
    const st = getExp(mExpiry);
    return { days, status: st, color: sColor(st) };
  }, [mExpiry]);

  // ─── FAB animation ────────────────────────────────────
  const fabScale = useSharedValue(0.3);
  const fabShadow = useSharedValue(0.55);
  useEffect(() => {
    fabScale.value = withDelay(700, withSpring(1, { damping: 12, stiffness: 100 }));
    fabShadow.value = withDelay(800, withRepeat(withSequence(
      withTiming(0.75, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.55, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
    ), -1, true));
  }, [fabScale, fabShadow]);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    shadowOpacity: fabShadow.value,
  }));

  // SVG icon paths for stat cards
  const ICON_EXPIRED = 'M4 4 L12 12 M12 4 L4 12';
  const ICON_URGENT = 'M8 2 L8 9 M8 12 L8 12.5';
  const ICON_SOON = 'M8 1 C4.5 1 1.5 4 1.5 7.5 C1.5 11 4.5 14.5 8 14.5 C11.5 14.5 14.5 11 14.5 7.5 C14.5 4 11.5 1 8 1 M8 4 L8 8 L11 9.5';
  const ICON_OK = 'M2 8.5 C2 4.9 4.9 2 8.5 2 C12.1 2 15 4.9 15 8.5 C15 12.1 12.1 15 8.5 15 C4.9 15 2 12.1 2 8.5 M6 8.5 L8 10.5 L11.5 6.5';

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 52, paddingBottom: 120 }}>

        {/* ─── HEADER ─── */}
        <Animated.View entering={FadeInDown.delay(0).duration(500).springify()} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Canvas style={{ width: 28, height: 28 }}>
              <Path path="M14 3 C7 3 3 10 3 18 C3 22 7 26 14 26 C21 26 25 22 25 18 C25 10 21 3 14 3 Z"
                color="rgba(52,211,153,0.7)" style="fill" />
              <Path path="M14 3 C7 3 3 10 3 18 C3 22 7 26 14 26 C21 26 25 22 25 18 C25 10 21 3 14 3 Z"
                color="rgba(52,211,153,0.9)" style="stroke" strokeWidth={1.5} />
              <Path path="M14 7 L14 23" color={C.amber} style="stroke" strokeWidth={1.2} strokeCap="round" />
              <Path path="M14 11 L9 14 M14 15 L19 18 M14 19 L10 21"
                color={C.amber + '88'} style="stroke" strokeWidth={0.8} strokeCap="round" />
            </Canvas>
            <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 30, color: C.textPrimary, letterSpacing: -0.5 }}>
              Aliments
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setModalVisible(true)} style={{
              width: 40, height: 40, borderRadius: 13,
              backgroundColor: 'rgba(245,166,35,0.10)',
              borderWidth: 1, borderColor: C.amberBorder,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Canvas style={{ width: 20, height: 20 }}>
                <Path path="M2 4 L2 16" color={C.amber + 'CC'} style="stroke" strokeWidth={2} />
                <Path path="M6 4 L6 16" color={C.amber + 'CC'} style="stroke" strokeWidth={1} />
                <Path path="M9 4 L9 16" color={C.amber + 'CC'} style="stroke" strokeWidth={2} />
                <Path path="M13 4 L13 16" color={C.amber + 'CC'} style="stroke" strokeWidth={1} />
                <Path path="M16 4 L16 16" color={C.amber + 'CC'} style="stroke" strokeWidth={1.5} />
                <Path path="M19 4 L19 16" color={C.amber + 'CC'} style="stroke" strokeWidth={1} />
              </Canvas>
            </Pressable>
            <Pressable onPress={() => setShowSort(v => !v)} style={{
              width: 40, height: 40, borderRadius: 13,
              backgroundColor: 'rgba(245,166,35,0.10)',
              borderWidth: 1, borderColor: C.amberBorder,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Canvas style={{ width: 20, height: 20 }}>
                <Path path="M2 4 L18 4 L12 11 L12 17 L8 17 L8 11 Z"
                  color={C.amber + 'CC'} style="stroke" strokeWidth={1.5}
                  strokeCap="round" strokeJoin="round" />
              </Canvas>
              {filter !== 'all' && (
                <View style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.amber,
                }} />
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Counter */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <Text style={{
            fontFamily: 'DMSans-Regular', fontSize: 14,
            color: 'rgba(255,255,255,0.52)', marginBottom: 16,
          }}>
            {total} produit{total !== 1 ? 's' : ''} suivi{total !== 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* ─── STATS GRID 2×2 ─── */}
        <Animated.View entering={FadeIn.delay(80).duration(400)} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatCard label="Expiré" count={stats.expired} total={total}
              color={C.expired} bg={C.expiredBg} border={C.expiredBorder}
              iconPath={ICON_EXPIRED} delay={100} />
            <StatCard label="Urgent" count={stats.urgent} total={total}
              color={C.urgent} bg={C.urgentBg} border={C.urgentBorder}
              iconPath={ICON_URGENT} delay={160} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard label="Bientôt" count={stats.warning} total={total}
              color={C.soon} bg={C.soonBg} border={C.soonBorder}
              iconPath={ICON_SOON} delay={220} />
            <StatCard label="OK" count={stats.ok} total={total}
              color={C.ok} bg={C.okBg} border={C.okBorder}
              iconPath={ICON_OK} delay={280} />
          </View>
        </Animated.View>

        {/* ─── FILTER TABS ─── */}
        <Animated.View entering={FadeIn.delay(360).duration(400)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 10 }}>
            {FILTER_TABS.map(tab => {
              const active = filter === tab.key;
              return (
                <Pressable key={tab.key} onPress={() => setFilter(tab.key)}
                  style={active ? {
                    backgroundColor: C.amber, borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 8,
                    shadowColor: C.amber, shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                  } : {
                    backgroundColor: C.bgElevated, borderRadius: 20, borderWidth: 1,
                    borderColor: 'rgba(245,166,35,0.15)',
                    paddingHorizontal: 14, paddingVertical: 8,
                  }}>
                  <Text style={active ? {
                    fontFamily: 'Nunito-Bold', fontSize: 12, color: C.bgDeep,
                  } : {
                    fontFamily: 'DMSans-Medium', fontSize: 12, color: 'rgba(255,255,255,0.48)',
                  }}>
                    {tab.emoji ? `${tab.emoji} ${tab.label}` : tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ─── SORT BAR ─── */}
        <Animated.View entering={FadeIn.delay(440).duration(400)} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted }}>Trié par :</Text>
            <Pressable onPress={() => setShowSort(!showSort)} style={{
              backgroundColor: 'rgba(245,166,35,0.08)',
              borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                {SORT_OPTIONS.find(o => o.key === sortKey)?.label}
              </Text>
              <Text style={{
                fontSize: 8, color: 'rgba(255,255,255,0.35)',
                transform: [{ rotate: showSort ? '180deg' : '0deg' }],
              }}>▼</Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: C.textMuted }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* Sort dropdown */}
        {showSort && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{
            backgroundColor: 'rgba(38,20,0,0.95)',
            borderWidth: 1, borderColor: C.amberBorder,
            borderRadius: 14, padding: 6, marginBottom: 10,
          }}>
            {SORT_OPTIONS.map(opt => (
              <Pressable key={opt.key} onPress={() => { setSortKey(opt.key); setShowSort(false); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: sortKey === opt.key ? C.amberSoft : 'transparent',
                }}>
                <Text style={{
                  fontFamily: sortKey === opt.key ? 'Nunito-SemiBold' : 'DMSans-Regular',
                  fontSize: 13,
                  color: sortKey === opt.key ? C.amber : C.textSecondary,
                }}>{opt.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* ─── URGENCY ALERT ─── */}
        <UrgencyAlert items={urgentItems} />

        {/* ─── FOOD LIST ─── */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((item, i) => (
            <FoodCard key={item.id} item={item} members={members}
              index={i} onConsume={consume} onDelete={handleDelete} />
          ))
        )}
      </ScrollView>

      {/* ─── FAB ─── */}
      <Animated.View style={[{
        position: 'absolute', bottom: 90, right: 20,
        shadowColor: C.amber, shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16, elevation: 12,
      }, fabStyle]}>
        <Pressable onPress={() => setModalVisible(true)}>
          <LinearGradient colors={['#F5A623', '#E8920A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 58, height: 58, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Canvas style={{ width: 24, height: 24 }}>
              <Path path="M12 4 L12 20 M4 12 L20 12" color={C.bgDeep}
                style="stroke" strokeWidth={2.5} strokeCap="round" />
            </Canvas>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ─── ADD MODAL ─── */}
      {modalVisible && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
        }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setModalVisible(false); resetModal(); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View entering={FadeInUp.duration(400).springify()} style={{
              backgroundColor: C.bgMid,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 40 : 24,
              maxHeight: Dimensions.get('window').height * 0.82,
            }}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{
                    width: 40, height: 4, borderRadius: 2,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                  }} />
                </View>
                <Text style={{
                  fontFamily: 'Nunito-Bold', fontSize: 22, color: C.textPrimary, marginBottom: 20,
                }}>Nouvel aliment</Text>

                {/* Name */}
                <Text style={labelStyle}>Nom du produit</Text>
                <TextInput value={mName} onChangeText={setMName}
                  placeholder="Ex: Yaourt nature, Poulet rôti..."
                  placeholderTextColor={C.textMuted} style={inputStyle} autoFocus />

                {/* Category 2×4 */}
                <Text style={[labelStyle, { marginTop: 16 }]}>Catégorie</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {MODAL_CATS.map(cat => {
                    const sel = mCat === cat.key;
                    return (
                      <Pressable key={cat.key} onPress={() => setMCat(cat.key)} style={{
                        width: (SW - 40 - 24) / 4,
                        backgroundColor: sel ? cat.color + '22' : C.bgElevated,
                        borderWidth: 1.5, borderColor: sel ? cat.color : 'rgba(255,255,255,0.08)',
                        borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 4,
                      }}>
                        <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                        <Text style={{
                          fontFamily: 'DMSans-Medium', fontSize: 10,
                          color: sel ? cat.color : C.textSecondary,
                        }}>{cat.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Quantity + Unit */}
                <Text style={[labelStyle, { marginTop: 16 }]}>Quantité</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                  <TextInput value={mQty} onChangeText={setMQty} placeholder="Ex: 500"
                    placeholderTextColor={C.textMuted} keyboardType="numeric"
                    style={[inputStyle, { flex: 1 }]} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                    style={{ flex: 1.5 }}>
                    {UNITS.map(u => (
                      <Pressable key={u} onPress={() => setMUnit(u)} style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                        backgroundColor: mUnit === u ? C.amberSoft : C.bgElevated,
                        borderWidth: 1, borderColor: mUnit === u ? C.amberBorder : 'rgba(255,255,255,0.08)',
                      }}>
                        <Text style={{
                          fontFamily: 'DMSans-Medium', fontSize: 12,
                          color: mUnit === u ? C.amber : C.textSecondary,
                        }}>{u}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* DLC */}
                <Text style={[labelStyle, { marginTop: 16 }]}>Date limite de consommation</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: '+3j', days: 3 }, { label: '+1 sem', days: 7 },
                    { label: '+2 sem', days: 14 }, { label: '+1 mois', days: 30 },
                    { label: '+3 mois', days: 90 },
                  ].map(chip => (
                    <Pressable key={chip.label} onPress={() => setQuickDate(chip.days)} style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBorder,
                    }}>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: C.amber }}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={mExpiry} onChangeText={setMExpiry}
                  placeholder="AAAA-MM-JJ" placeholderTextColor={C.textMuted} style={inputStyle} />
                {expiryPreview && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: C.textSecondary }}>
                      Dans {Math.max(0, expiryPreview.days)} jour{expiryPreview.days !== 1 ? 's' : ''} —
                    </Text>
                    <View style={{
                      backgroundColor: expiryPreview.color + '22', borderRadius: 8,
                      paddingHorizontal: 8, paddingVertical: 2,
                      borderWidth: 1, borderColor: expiryPreview.color + '44',
                    }}>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: expiryPreview.color }}>
                        {expiryPreview.status === 'expired' ? 'Expiré' :
                         expiryPreview.status === 'urgent' ? 'Urgent' :
                         expiryPreview.status === 'warning' ? 'Bientôt' : 'OK'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Submit */}
                <Pressable onPress={addFood} style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden' }}>
                  <LinearGradient colors={['#F5A623', '#E8920A']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                      height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                      shadowColor: C.amber, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
                    }}>
                    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: C.bgDeep }}>
                      Ajouter l'aliment
                    </Text>
                  </LinearGradient>
                </Pressable>
                <View style={{ height: 20 }} />
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

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
            <Canvas style={{ position: 'absolute', width: SW * 0.82, height: 280 }}>
              <Circle cx={SW * 0.41} cy={55} r={90} color="rgba(255,68,68,0.06)" />
              <Circle cx={SW * 0.41} cy={55} r={45} color="rgba(255,68,68,0.04)" />
            </Canvas>

            <View style={{ backgroundColor: '#2A1600', padding: 28, alignItems: 'center', borderRadius: 28 }}>
              {/* Trash icon */}
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(255,68,68,0.12)',
                borderWidth: 1.5, borderColor: 'rgba(255,68,68,0.25)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
                shadowColor: '#FF4444', shadowRadius: 20, shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 0 }, elevation: 8,
              }}>
                <Text style={{ fontSize: 28 }}>🗑️</Text>
              </View>

              <Text style={{
                fontSize: 20, fontFamily: 'Nunito-Bold',
                color: C.textPrimary, marginBottom: 8, textAlign: 'center',
              }}>Supprimer l'aliment</Text>

              <Text style={{
                fontSize: 14, fontFamily: 'DMSans-Regular',
                color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                marginBottom: 6, lineHeight: 20,
              }}>Êtes-vous sûr de vouloir supprimer</Text>
              <Text style={{
                fontSize: 15, fontFamily: 'Nunito-SemiBold',
                color: C.amber, textAlign: 'center', marginBottom: 24,
              }}>« {deleteConfirm?.name} »</Text>

              <LinearGradient
                colors={['transparent', 'rgba(255,68,68,0.25)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1, width: '100%', marginBottom: 20 }}
              />

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
                  style={{ flex: 1, height: 50, borderRadius: 16, overflow: 'hidden' }}>
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
                      fontSize: 15, fontFamily: 'Nunito-Bold', color: '#FFFFFF',
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
  fontFamily: 'DMSans-Medium', fontSize: 13,
  color: C.textSecondary, marginBottom: 8,
} as const;

const inputStyle = {
  height: 50, backgroundColor: C.bgSurface, borderRadius: 14,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  paddingHorizontal: 16, fontFamily: 'DMSans-Regular',
  fontSize: 15, color: C.textPrimary, marginBottom: 4,
} as const;
