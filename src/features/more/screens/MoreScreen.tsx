import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StatusBar, Dimensions,
  ScrollView, FlatList,
} from 'react-native';
import Animated, {
  FadeInUp, FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MoreStackParamList } from '@app/navigation/types';
import { useAuthStore } from '@features/auth/store/authStore';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 44) / 2;
const FEAT_W = SW * 0.62;

// ─── Palette ──────────────────────────────────────────────
const C = {
  bgDeep:   '#140B00',
  bgMid:    '#1E1000',
  bgCard:   '#251500',
  bgElev:   '#2E1A00',
  amber:    '#F5A623',
  amberDim: 'rgba(245,166,35,0.18)',
  amberBrd: 'rgba(245,166,35,0.25)',
  text:     '#FFFFFF',
  textSec:  'rgba(255,255,255,0.55)',
  textMut:  'rgba(255,255,255,0.28)',
  border:   'rgba(255,255,255,0.06)',
};

type Nav = StackNavigationProp<MoreStackParamList, 'MoreHome'>;

// ─── Tile definitions ─────────────────────────────────────
interface Tile {
  key: keyof Omit<MoreStackParamList, 'MoreHome'>;
  emoji: string;
  label: string;
  color: string;
  desc: string;
  featured?: boolean;
  badge?: string;
}

const FEATURED: Tile[] = [
  { key: 'Budget',  emoji: '💰', label: 'Budget',       color: '#F5A623', desc: 'Dépenses & soldes partagés', featured: true },
  { key: 'Events',  emoji: '🎉', label: 'Événements',   color: '#FF6B9D', desc: 'Fêtes, sorties & rappels',   featured: true },
  { key: 'Rewards', emoji: '🏆', label: 'Récompenses',  color: '#FFD700', desc: 'Points, badges & classement', featured: true },
];

const SECTIONS: { title: string; icon: string; tiles: Tile[] }[] = [
  {
    title: 'Maison',
    icon: '🏡',
    tiles: [
      { key: 'Food',     emoji: '🥑', label: 'Aliments',  color: '#34D399', desc: 'Frigo & placard'    },
      { key: 'MealPlan', emoji: '🍽️', label: 'Repas',     color: '#FF8C00', desc: 'Planifier la semaine' },
      { key: 'Chores',   emoji: '🔄', label: 'Corvées',   color: '#06B6D4', desc: 'Rotation auto'       },
      { key: 'Weather',  emoji: '🌤️', label: 'Météo',     color: '#60A5FA', desc: 'Prévisions locales'  },
    ],
  },
  {
    title: 'Partage',
    icon: '🤝',
    tiles: [
      { key: 'Notes',     emoji: '📒', label: 'Notes',      color: '#4ECDC4', desc: 'Mémos partagés'    },
      { key: 'Documents', emoji: '📂', label: 'Documents',  color: '#A78BFA', desc: 'Factures & contrats' },
      { key: 'Polls',     emoji: '🗳️', label: 'Sondages',   color: '#8B5CF6', desc: 'Votes du foyer'    },
      { key: 'Timers',    emoji: '⏱️', label: 'Minuteurs',  color: '#C084FC', desc: 'Décomptes partagés' },
      { key: 'Mood',      emoji: '🎭', label: 'Humeurs',    color: '#FBBF24', desc: 'Tableau d\'humeur'  },
    ],
  },
  {
    title: 'Analyse',
    icon: '📊',
    tiles: [
      { key: 'Stats',    emoji: '📈', label: 'Statistiques', color: '#F472B6', desc: 'Graphiques & analyse' },
      { key: 'Settings', emoji: '⚙️', label: 'Réglages',    color: '#94A3B8', desc: 'Compte & préférences' },
    ],
  },
];

// ─── AnimPressable ─────────────────────────────────────────
const AnimCard: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);
  const as = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[as, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={onPress}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ─── Featured Card ─────────────────────────────────────────
const FeaturedCard: React.FC<{ tile: Tile; onPress: () => void; index: number }> = ({ tile, onPress, index }) => (
  <Animated.View entering={FadeInDown.duration(500).delay(index * 100).springify()}>
    <AnimCard onPress={onPress} style={{ width: FEAT_W, marginRight: 12 }}>
      <View style={{
        height: 160, borderRadius: 24, overflow: 'hidden',
        backgroundColor: C.bgElev,
        borderWidth: 1.5, borderColor: tile.color + '35',
        shadowColor: tile.color, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
      }}>
        {/* Ambient glow blob */}
        <View style={{
          position: 'absolute', top: -30, right: -20, width: 130, height: 130,
          borderRadius: 65, backgroundColor: tile.color + '18',
        }} />

        {/* Top gradient bar */}
        <LinearGradient
          colors={[tile.color, tile.color + '00']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 2.5, position: 'absolute', top: 0, left: 0, right: 0 }}
        />

        {/* Background texture lines */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          opacity: 0.04,
          borderTopWidth: 1, borderColor: '#fff',
        }} />

        <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
          {/* Top row: icon + badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{
              width: 54, height: 54, borderRadius: 16,
              backgroundColor: tile.color + '22',
              borderWidth: 1.5, borderColor: tile.color + '40',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 28 }}>{tile.emoji}</Text>
            </View>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
              backgroundColor: tile.color + '18',
              borderWidth: 1, borderColor: tile.color + '35',
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: tile.color, letterSpacing: 0.5 }}>
                À LA UNE
              </Text>
            </View>
          </View>

          {/* Bottom: title + desc */}
          <View>
            <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 4 }}>
              {tile.label}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, lineHeight: 16 }}>
              {tile.desc}
            </Text>
          </View>
        </View>
      </View>
    </AnimCard>
  </Animated.View>
);

// ─── Grid Card ─────────────────────────────────────────────
const GridCard: React.FC<{ tile: Tile; onPress: () => void; index: number }> = ({ tile, onPress, index }) => (
  <Animated.View entering={FadeInUp.duration(400).delay(index * 55).springify()}
    style={{ width: CARD_W }}>
    <AnimCard onPress={onPress} style={{ flex: 1 }}>
      <View style={{
        borderRadius: 20, overflow: 'hidden',
        backgroundColor: C.bgCard,
        borderWidth: 1.5, borderColor: tile.color + '28',
        minHeight: 118,
        shadowColor: tile.color, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 12, elevation: 5,
      }}>
        {/* Top color bar */}
        <LinearGradient
          colors={[tile.color + 'CC', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 2, position: 'absolute', top: 0, left: 0, right: 0 }}
        />

        {/* Left accent */}
        <View style={{
          position: 'absolute', left: 0, top: 16, bottom: 16, width: 3,
          backgroundColor: tile.color,
          borderTopRightRadius: 2, borderBottomRightRadius: 2,
          shadowColor: tile.color, shadowRadius: 6, shadowOpacity: 1,
        }} />

        {/* Corner glow */}
        <View style={{
          position: 'absolute', top: -20, right: -20, width: 70, height: 70,
          borderRadius: 35, backgroundColor: tile.color + '10',
        }} />

        <View style={{ padding: 16, paddingLeft: 18 }}>
          {/* Icon */}
          <View style={{
            width: 46, height: 46, borderRadius: 14,
            backgroundColor: tile.color + '1A',
            borderWidth: 1, borderColor: tile.color + '30',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Text style={{ fontSize: 24 }}>{tile.emoji}</Text>
          </View>

          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 3 }}>
            {tile.label}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, lineHeight: 14 }}>
            {tile.desc}
          </Text>
        </View>
      </View>
    </AnimCard>
  </Animated.View>
);

// ─── Section Header ────────────────────────────────────────
const SectionHeader: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 14, paddingHorizontal: 4 }}>
    <Text style={{ fontSize: 15, marginRight: 7 }}>{icon}</Text>
    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase' }}>
      {title}
    </Text>
    <View style={{ flex: 1, marginLeft: 12, height: 1 }}>
      <LinearGradient
        colors={['rgba(245,166,35,0.35)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </View>
  </View>
);

// ─── Main Screen ───────────────────────────────────────────
export const MoreScreen: React.FC = () => {
  const nav = useNavigation<Nav>();
  const household = useAuthStore(s => s.household);
  const members   = useAuthStore(s => s.members);

  const go = useCallback((key: keyof Omit<MoreStackParamList, 'MoreHome'>) => {
    nav.navigate(key);
  }, [nav]);

  const totalFeatures = FEATURED.length + SECTIONS.reduce((s, sec) => s + sec.tiles.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />

      {/* Deep background gradient */}
      <LinearGradient
        colors={[C.bgDeep, '#1E1000', C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative ambient orbs */}
      <View style={{
        position: 'absolute', top: -60, left: -40, width: 200, height: 200,
        borderRadius: 100, backgroundColor: 'rgba(245,166,35,0.04)',
      }} />
      <View style={{
        position: 'absolute', top: 80, right: -60, width: 160, height: 160,
        borderRadius: 80, backgroundColor: 'rgba(255,107,157,0.03)',
      }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(600).springify()}>
          <LinearGradient
            colors={['rgba(245,166,35,0.10)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20 }}
          >
            {/* Eyebrow */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBrd,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' }} />
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.amber }}>
                  {household?.name ?? 'Mon foyer'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                {members.length} membre{members.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Main title */}
            <Text style={{ fontSize: 32, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5, lineHeight: 38 }}>
              Toutes les{'\n'}
              <Text style={{ color: C.amber }}>fonctionnalités</Text>
            </Text>

            {/* Feature count pill */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 14, alignSelf: 'flex-start',
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: C.border,
            }}>
              {SECTIONS.map(sec => (
                <View key={sec.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 12 }}>{sec.icon}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }}>
                    {sec.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMut }}>·</Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber }}>
                {totalFeatures}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══ FEATURED ROW ══ */}
        <Animated.View entering={FadeIn.duration(500).delay(150)}>
          <View style={{ paddingLeft: 20, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <LinearGradient
                colors={[C.amber, '#E8920A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ width: 3, height: 14, borderRadius: 2 }}
              />
              <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                À la une
              </Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={FEATURED}
            keyExtractor={t => t.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingRight: 8 }}
            renderItem={({ item, index }) => (
              <FeaturedCard tile={item} onPress={() => go(item.key)} index={index} />
            )}
          />
        </Animated.View>

        {/* ══ SECTIONS ══ */}
        <View style={{ paddingHorizontal: 16 }}>
          {SECTIONS.map((sec, si) => (
            <Animated.View key={sec.title} entering={FadeInUp.duration(400).delay(200 + si * 80)}>
              <SectionHeader icon={sec.icon} title={sec.title} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {sec.tiles.map((tile, ti) => (
                  <GridCard
                    key={tile.key}
                    tile={tile}
                    onPress={() => go(tile.key)}
                    index={si * 10 + ti}
                  />
                ))}
              </View>
            </Animated.View>
          ))}
        </View>

        {/* ══ FOOTER WATERMARK ══ */}
        <Animated.View entering={FadeIn.duration(600).delay(600)}
          style={{ alignItems: 'center', marginTop: 36, paddingBottom: 8 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: 'rgba(245,166,35,0.06)',
            borderWidth: 1, borderColor: 'rgba(245,166,35,0.12)',
          }}>
            <Text style={{ fontSize: 14 }}>🏠</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: 'rgba(245,166,35,0.45)', letterSpacing: 1 }}>
              MAJORDHOME
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};
