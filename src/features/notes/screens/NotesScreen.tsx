import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert,
  Dimensions, StatusBar, Keyboard, FlatList,
} from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withTiming, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  Canvas, Path, Skia, Circle, Group, BlurMask,
  RoundedRect,
} from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MoreStackParamList } from '@app/navigation/types';
import { useAuthStore } from '@features/auth/store/authStore';
import { supabase, subscribeToTable } from '@services/supabase';
import { notificationService } from '@services/notifications';
import type { Note, NoteCategory } from '@appTypes/index';

const { width: SW } = Dimensions.get('window');
const COL_W = (SW - 44) / 2;

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
  teal:      '#4ECDC4',
  purple:    '#A78BFA',
  coral:     '#FF6B6B',
  gold:      '#FFD700',
};

// ═══════════════════════════════════════════════════════════
// CATEGORY CONFIG
// ═══════════════════════════════════════════════════════════
const CAT_CFG: Record<NoteCategory, { emoji: string; label: string; color: string }> = {
  memo:    { emoji: '📝', label: 'Mémo',    color: '#F5A623' },
  recette: { emoji: '🍳', label: 'Recette', color: '#34D399' },
  contact: { emoji: '📋', label: 'Contact', color: '#4ECDC4' },
  code:    { emoji: '🔑', label: 'Code',    color: '#A78BFA' },
  liste:   { emoji: '✅', label: 'Liste',   color: '#FF6B6B' },
  idee:    { emoji: '💡', label: 'Idée',    color: '#FFD700' },
  autre:   { emoji: '📦', label: 'Autre',   color: 'rgba(255,255,255,0.45)' },
};
const CATS = Object.keys(CAT_CFG) as NoteCategory[];

const EMPTY_TEXTS: Record<NoteCategory | 'all', string> = {
  all:     'Aucune note partagée',
  memo:    'Aucun mémo pour l\'instant',
  recette: 'Aucune recette enregistrée',
  contact: 'Aucun contact sauvegardé',
  code:    'Aucun code ou mot de passe',
  liste:   'Aucune liste créée',
  idee:    'Aucune idée notée',
  autre:   'Aucune autre note',
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const estimateCardHeight = (note: Note): number => {
  const baseH = 120;
  if (note.category === 'liste' && note.checklist?.length) {
    return baseH + Math.min(note.checklist.length, 4) * 26;
  }
  if (note.category === 'recette') return 155;
  if (note.category === 'contact') return 120;
  if (note.content) return baseH + Math.min(note.content.length * 0.7, 100);
  return baseH;
};

// ═══════════════════════════════════════════════════════════
// SKIA EMPTY STATE
// ═══════════════════════════════════════════════════════════
const EmptyState: React.FC<{ category: NoteCategory | 'all'; onAdd: () => void }> = ({ category, onAdd }) => {
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const orbit  = useSharedValue(0);

  useEffect(() => {
    pulse1.value = withRepeat(withSequence(
      withTiming(1.25, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1,    { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
    pulse2.value = withRepeat(withSequence(
      withTiming(1.25, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      withTiming(1,    { duration: 2800, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
    orbit.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [pulse1, pulse2, orbit]);

  const spark1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }], opacity: interpolate(pulse1.value, [1, 1.25], [0.5, 0.9]),
  }));
  const spark2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }], opacity: interpolate(pulse2.value, [1, 1.25], [0.35, 0.7]),
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2 - 10;

  const notebookPath = Skia.Path.Make();
  notebookPath.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 54, cy - 64, 108, 118), 14, 14));

  const coverPath = Skia.Path.Make();
  coverPath.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 54, cy - 64, 108, 118), 14, 14));

  const shadowPath = Skia.Path.Make();
  shadowPath.addOval(Skia.XYWHRect(cx - 44, cy + 52, 88, 18));

  return (
    <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 20 }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>

        {/* Sparkles */}
        <Animated.View style={[{ position: 'absolute', top: 18, right: 40, width: 12, height: 12 }, spark1Style]}>
          <Text style={{ fontSize: 12 }}>✦</Text>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', top: 30, left: 28, width: 10, height: 10 }, spark2Style]}>
          <Text style={{ fontSize: 10, color: C.teal }}>✦</Text>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: 40, right: 28, width: 8, height: 8 }, spark2Style]}>
          <Text style={{ fontSize: 9, color: C.coral }}>✦</Text>
        </Animated.View>

        {/* Orbit dots */}
        <Animated.View style={[{ position: 'absolute', width: SIZE * 0.85, height: SIZE * 0.85 }, orbitStyle]}>
          <View style={{ position: 'absolute', top: 0, left: '50%', width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber, opacity: 0.4, marginLeft: -3 }} />
          <View style={{ position: 'absolute', bottom: 12, left: '25%', width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal, opacity: 0.35 }} />
          <View style={{ position: 'absolute', top: '30%', right: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: C.coral, opacity: 0.3 }} />
        </Animated.View>

        {/* Skia notebook */}
        <Canvas style={{ width: SIZE, height: SIZE }}>
          {/* Shadow */}
          <Path path={shadowPath} color="rgba(0,0,0,0.30)">
            <BlurMask blur={10} style="normal" />
          </Path>

          {/* Notebook body fill */}
          <Path path={coverPath} color="rgba(58,34,0,0.70)" />

          {/* Notebook body stroke */}
          <Path path={notebookPath} color="rgba(245,166,35,0.45)" style="stroke" strokeWidth={1.8} />

          {/* Spiral rings */}
          {[0, 1, 2, 3, 4].map(i => {
            const ringY = cy - 44 + i * 24;
            const p = Skia.Path.Make();
            p.addArc({ x: cx - 60, y: ringY - 7, width: 14, height: 14 }, 0, -180);
            return (
              <Path key={i} path={p} color="rgba(245,166,35,0.55)" style="stroke" strokeWidth={2.2} strokeCap="round" />
            );
          })}

          {/* Dashed horizontal lines */}
          {[0, 1, 2, 3, 4].map(i => {
            const lineY = cy - 28 + i * 22;
            const p = Skia.Path.Make();
            p.moveTo(cx - 34, lineY); p.lineTo(cx + 44, lineY);
            return (
              <Path key={`l${i}`} path={p} color="rgba(255,255,255,0.12)" style="stroke" strokeWidth={1} strokeCap="round" />
            );
          })}

          {/* Bookmark */}
          <RoundedRect x={cx + 34} y={cy - 64} width={12} height={26} r={3} color="rgba(245,166,35,0.65)" />

          {/* Pen / pencil */}
          <Group transform={[{ rotate: -0.26 }, { translateX: cx + 20 }, { translateY: cy - 10 }]}>
            <Path
              path={(() => { const p = Skia.Path.Make(); p.moveTo(0, -32); p.lineTo(4, 32); p.lineTo(-4, 32); p.close(); return p; })()}
              color="rgba(245,166,35,0.70)"
            />
            <Path
              path={(() => { const p = Skia.Path.Make(); p.moveTo(-4, 32); p.lineTo(4, 32); p.lineTo(0, 44); p.close(); return p; })()}
              color="rgba(245,166,35,0.40)"
            />
          </Group>
        </Canvas>
      </View>

      <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: C.text, textAlign: 'center', marginBottom: 8 }}>
        {EMPTY_TEXTS[category]}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 32 }}>
        Appuie sur + pour créer{'\n'}ta première note partagée !
      </Text>

      <Pressable onPress={onAdd} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.amberSoft,
        borderWidth: 1, borderColor: C.amberBrd, borderRadius: 14,
        paddingHorizontal: 22, paddingVertical: 13,
      }}>
        <Text style={{ fontSize: 18, color: C.amber, lineHeight: 22 }}>+</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: C.amber }}>Créer une note</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// NOTE CARD (grid)
// ═══════════════════════════════════════════════════════════
interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
  memberName: string;
  memberColor: string;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPress, onLongPress, memberName, memberColor }) => {
  const cat   = CAT_CFG[note.category] ?? CAT_CFG.autre;
  const color = note.accent_color ?? cat.color;
  const scale = useSharedValue(1);
  const as    = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const checklist    = note.checklist ?? [];
  const checkDone    = checklist.filter(i => i.checked).length;
  const checkTotal   = checklist.length;
  const previewItems = checklist.slice(0, 3);

  return (
    <Animated.View entering={FadeInUp.duration(350).springify()} style={as}>
      <Pressable
        onPress={() => onPress(note)}
        onLongPress={() => onLongPress(note)}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 12 }); }}
        style={{
          backgroundColor: C.bgSurface,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: color + '28',
          overflow: 'hidden',
          marginBottom: 10,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* Top color bar */}
        <LinearGradient
          colors={[color, color + '55']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 3 }}
        />

        {/* Top highlight line */}
        <LinearGradient
          colors={['transparent', color + '40', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 1 }}
        />

        {/* Corner glow */}
        <View style={{
          position: 'absolute', top: -20, right: -20,
          width: 70, height: 70, borderRadius: 35,
          backgroundColor: color + '12',
        }} />

        {/* Pinned badge */}
        {note.is_pinned && (
          <View style={{
            position: 'absolute', top: 8, right: 10,
            flexDirection: 'row', alignItems: 'center', gap: 2,
            backgroundColor: C.amber, borderRadius: 6,
            paddingHorizontal: 5, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 7 }}>📌</Text>
            <Text style={{ fontSize: 7, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Épinglé</Text>
          </View>
        )}

        <View style={{ padding: 13, paddingTop: 10 }}>
          {/* Category + title row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 8 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 9,
              backgroundColor: color + '20',
              borderWidth: 1, borderColor: color + '35',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            </View>
            <Text style={{
              flex: 1, fontSize: 14, fontFamily: 'Nunito-Bold', color: C.text, lineHeight: 20,
            }} numberOfLines={2}>
              {note.title}
            </Text>
          </View>

          {/* Content preview by type */}
          {note.category === 'liste' && checkTotal > 0 ? (
            <View style={{ marginBottom: 8 }}>
              {previewItems.map(item => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{
                    width: 14, height: 14, borderRadius: 4,
                    backgroundColor: item.checked ? C.green + 'AA' : 'transparent',
                    borderWidth: 1.5, borderColor: item.checked ? C.green : C.amberBrd,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.checked && <Text style={{ fontSize: 8, color: '#fff' }}>✓</Text>}
                  </View>
                  <Text style={{
                    flex: 1, fontSize: 11, fontFamily: 'DMSans-Regular',
                    color: item.checked ? C.textMut : C.textSec,
                    textDecorationLine: item.checked ? 'line-through' : 'none',
                  }} numberOfLines={1}>{item.text}</Text>
                </View>
              ))}
              {checkTotal > 3 && (
                <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, marginTop: 2 }}>
                  +{checkTotal - 3} éléments…
                </Text>
              )}
              {/* Progress bar */}
              <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6 }}>
                <View style={{
                  height: 3, borderRadius: 2, backgroundColor: C.green,
                  width: checkTotal > 0 ? `${(checkDone / checkTotal) * 100}%` : '0%',
                }} />
              </View>
            </View>
          ) : note.category === 'recette' && note.recipe_data ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec, marginBottom: 4 }}>
                🍳 {note.recipe_data.portions} portion{note.recipe_data.portions > 1 ? 's' : ''} · ⏱ {note.recipe_data.prepTime + note.recipe_data.cookTime} min
              </Text>
              {note.recipe_data.ingredients.slice(0, 2).map((ing, i) => (
                <Text key={i} style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }} numberOfLines={1}>
                  · {ing}
                </Text>
              ))}
            </View>
          ) : note.category === 'contact' && note.contact_data ? (
            <View style={{ marginBottom: 8 }}>
              {note.contact_data.phone ? (
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }} numberOfLines={1}>
                  📞 {note.contact_data.phone}
                </Text>
              ) : null}
              {note.contact_data.email ? (
                <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.textSec }} numberOfLines={1}>
                  ✉️ {note.contact_data.email}
                </Text>
              ) : null}
            </View>
          ) : note.category === 'code' ? (
            <View style={{
              backgroundColor: C.purple + '14',
              borderRadius: 8, padding: 6, marginBottom: 8,
            }}>
              <Text style={{ fontSize: 10, color: C.textMut, fontFamily: 'DMSans-Regular' }}>
                🔒 Contenu protégé
              </Text>
            </View>
          ) : note.content ? (
            <Text style={{
              fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec,
              lineHeight: 17, marginBottom: 8,
            }} numberOfLines={4}>
              {note.content}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textMut, fontStyle: 'italic', marginBottom: 8 }}>
              (Note vide)
            </Text>
          )}

          {/* Tags */}
          {note.tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {note.tags.slice(0, 2).map(tag => (
                <View key={tag} style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
            paddingTop: 7, marginTop: 2,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: memberColor, marginRight: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut, flex: 1 }} numberOfLines={1}>
              {memberName}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
              {timeAgo(note.updated_at)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MASONRY GRID
// ═══════════════════════════════════════════════════════════
interface MasonryProps {
  notes: Note[];
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
  getMemberName: (id: string) => string;
  getMemberColor: (id: string) => string;
}

const MasonryGrid: React.FC<MasonryProps> = ({ notes, onPress, onLongPress, getMemberName, getMemberColor }) => {
  const [col1, col2] = useMemo(() => {
    const left: Note[] = [];
    const right: Note[] = [];
    let lH = 0, rH = 0;
    notes.forEach(n => {
      const h = estimateCardHeight(n);
      if (lH <= rH) { left.push(n); lH += h; }
      else { right.push(n); rH += h; }
    });
    return [left, right];
  }, [notes]);

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 10 }}>
      <View style={{ flex: 1 }}>
        {col1.map(n => (
          <NoteCard key={n.id} note={n} onPress={onPress} onLongPress={onLongPress}
            memberName={getMemberName(n.created_by)} memberColor={getMemberColor(n.created_by)} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {col2.map(n => (
          <NoteCard key={n.id} note={n} onPress={onPress} onLongPress={onLongPress}
            memberName={getMemberName(n.created_by)} memberColor={getMemberColor(n.created_by)} />
        ))}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// PINNED SECTION
// ═══════════════════════════════════════════════════════════
const PinnedSection: React.FC<MasonryProps & { visible: boolean }> = ({ notes, onPress, onLongPress, getMemberName, getMemberColor, visible }) => {
  const pinOscillate = useSharedValue(0);
  useEffect(() => {
    pinOscillate.value = withRepeat(
      withSequence(
        withTiming(6,  { duration: 800,  easing: Easing.inOut(Easing.ease) }),
        withTiming(-6, { duration: 800,  easing: Easing.inOut(Easing.ease) }),
        withTiming(0,  { duration: 400 }),
      ), -1, false,
    );
  }, [pinOscillate]);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${pinOscillate.value}deg` }] }));

  if (!visible || notes.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10, marginTop: 4 }}>
        <Animated.Text style={[{ fontSize: 14 }, pinStyle]}>📌</Animated.Text>
        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 2, textTransform: 'uppercase' }}>
          Épinglées
        </Text>
        <LinearGradient
          colors={['rgba(245,166,35,0.35)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1, height: 1 }}
        />
      </View>
      <FlatList
        horizontal
        data={notes}
        keyExtractor={n => n.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingRight: 8 }}
        renderItem={({ item, index }) => {
          const cat = CAT_CFG[item.category] ?? CAT_CFG.autre;
          const color = item.accent_color ?? cat.color;
          return (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
              <Pressable
                onPress={() => onPress(item)}
                onLongPress={() => onLongPress(item)}
                style={{
                  width: 150, backgroundColor: C.bgSurface,
                  borderRadius: 16, borderWidth: 1.5, borderColor: color + '30',
                  overflow: 'hidden',
                  shadowColor: color, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
                }}
              >
                <LinearGradient
                  colors={[color, color + '44']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 3 }}
                />
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 20, marginBottom: 8 }}>{cat.emoji}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 4 }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>
                    {timeAgo(item.updated_at)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// ADD NOTE MODAL
// ═══════════════════════════════════════════════════════════
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { title: string; content: string; category: NoteCategory; tags: string[] }) => Promise<void>;
}

const AddNoteModal: React.FC<AddModalProps> = ({ visible, onClose, onSave }) => {
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [category, setCategory] = useState<NoteCategory>('memo');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags]         = useState<string[]>([]);

  const reset = () => { setTitle(''); setContent(''); setCategory('memo'); setTags([]); setTagInput(''); };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('', 'Ajoute un titre.'); return; }
    await onSave({ title: title.trim(), content, category, tags });
    reset(); onClose(); Keyboard.dismiss();
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  return (
    // Modal via View overlay (no native Modal to avoid Keyboard issues)
    visible ? (
      <Pressable onPress={() => { onClose(); Keyboard.dismiss(); reset(); }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 100 }}>
        <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: C.bgMid, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', borderTopWidth: 1, borderTopColor: C.amberBrd }}>
          <LinearGradient colors={['rgba(245,166,35,0.22)', 'transparent']} style={{ height: 2, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontSize: 22, fontFamily: 'Nunito-Bold', color: C.text, marginBottom: 18 }}>Nouvelle note</Text>

            {/* Category chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATS.map(k => {
                  const sel = category === k;
                  const col = CAT_CFG[k].color;
                  return (
                    <Pressable key={k} onPress={() => setCategory(k)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: sel ? col + '22' : C.bgElev,
                      borderWidth: 1.5, borderColor: sel ? col : 'rgba(245,166,35,0.15)',
                    }}>
                      <Text style={{ fontSize: 13 }}>{CAT_CFG[k].emoji}</Text>
                      <Text style={{ fontSize: 11, fontFamily: sel ? 'Nunito-Bold' : 'DMSans-Regular', color: sel ? col : C.textSec }}>
                        {CAT_CFG[k].label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Title */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TITRE</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Titre de la note"
              placeholderTextColor={C.textMut}
              style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'Nunito-Bold', fontSize: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }} />

            {/* Content */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>CONTENU</Text>
            <TextInput value={content} onChangeText={setContent} placeholder="Écris ta note ici…"
              placeholderTextColor={C.textMut} multiline
              style={{ backgroundColor: C.bgSurface, borderRadius: 14, padding: 14, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16, minHeight: 90 }} />

            {/* Tags */}
            <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: C.amber, letterSpacing: 1, marginBottom: 8 }}>TAGS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tags.map(t => (
                <Pressable key={t} onPress={() => setTags(prev => prev.filter(x => x !== t))} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: C.amberSoft, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4,
                  borderWidth: 1, borderColor: C.amberBrd,
                }}>
                  <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular', color: C.amber }}>#{t}</Text>
                  <Text style={{ fontSize: 10, color: C.textMut }}>✕</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag}
                placeholder="ajouter-tag" placeholderTextColor={C.textMut} returnKeyType="done"
                style={{ flex: 1, backgroundColor: C.bgSurface, borderRadius: 12, padding: 10, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 13, borderWidth: 1, borderColor: C.border }} />
              <Pressable onPress={addTag} style={{ backgroundColor: C.amberSoft, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.amberBrd }}>
                <Text style={{ color: C.amber, fontSize: 18 }}>+</Text>
              </Pressable>
            </View>

            {/* Submit */}
            <Pressable onPress={handleSave} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 8 }}>
              <LinearGradient colors={['#F5A623', '#E8920A']} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#1A0E00' }}>Créer la note</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => { onClose(); reset(); Keyboard.dismiss(); }} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textMut }}>Annuler</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    ) : null
  );
};

// ═══════════════════════════════════════════════════════════
// SPEED DIAL FAB
// ═══════════════════════════════════════════════════════════
const SpeedDialFAB: React.FC<{ onSelect: (cat: NoteCategory) => void }> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const items    = useSharedValue(0);
  const fabPulse = useSharedValue(0);

  useEffect(() => {
    fabPulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [fabPulse]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 12 });
    items.value    = withSpring(next ? 1 : 0, { damping: 14, stiffness: 180 });
  };

  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 45])}deg` }],
  }));
  const fabGlow = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + fabPulse.value * 0.3,
    shadowRadius:  10 + fabPulse.value * 8,
    transform: [{ scale: 1 + fabPulse.value * 0.025 }],
  }));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable onPress={toggle} style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 98,
        }} />
      )}

      {/* Speed dial items */}
      <View style={{ position: 'absolute', bottom: 90, right: 16, zIndex: 99, alignItems: 'flex-end' }}>
        {CATS.map((cat, i) => {
          const cfg = CAT_CFG[cat];
          const itemAnim = useAnimatedStyle(() => ({
            transform: [
              { translateY: interpolate(items.value, [0, 1], [0, -(i + 1) * 60]) },
              { scale: items.value },
            ],
            opacity: items.value,
          }));
          return (
            <Animated.View key={cat} style={[{ position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, itemAnim]}>
              {/* Label */}
              <Animated.View entering={open ? FadeIn.delay(i * 40).duration(200) : undefined}>
                <View style={{
                  backgroundColor: 'rgba(26,14,0,0.92)',
                  borderWidth: 1, borderColor: cfg.color + '55',
                  borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
                }}>
                  <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.text }}>{cfg.label}</Text>
                </View>
              </Animated.View>
              {/* Mini FAB */}
              <Pressable onPress={() => { toggle(); onSelect(cat); }} style={{
                width: 46, height: 46, borderRadius: 14,
                backgroundColor: cfg.color + '22',
                borderWidth: 1.5, borderColor: cfg.color,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: cfg.color, shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
              }}>
                <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View style={[fabGlow, {
          shadowColor: C.amber, shadowOffset: { width: 0, height: 6 }, elevation: 12,
          zIndex: 100,
        }]}>
          <Pressable onPress={toggle} style={{ width: 58, height: 58, borderRadius: 18, overflow: 'hidden' }}>
            <LinearGradient
              colors={['#F5A623', '#E8920A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Animated.Text style={[{ fontSize: 28, color: '#1A0E00', lineHeight: 32 }, rotStyle]}>+</Animated.Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
type Nav = StackNavigationProp<MoreStackParamList, 'Notes'>;

export const NotesScreen: React.FC = () => {
  const household = useAuthStore(s => s.household);
  const user      = useAuthStore(s => s.user);
  const members   = useAuthStore(s => s.members);

  const [notes,      setNotes]      = useState<Note[]>([]);
  const [catFilter,  setCatFilter]  = useState<NoteCategory | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [viewMode,   setViewMode]   = useState<'grid' | 'list'>('grid');
  const [showModal,  setShowModal]  = useState(false);
  const [newCat,     setNewCat]     = useState<NoteCategory>('memo');
  const searchFocused = useSharedValue(0);
  const searchRef     = useRef<TextInput>(null);

  // ── Member helpers ──
  const myMember = useMemo(() => members.find(m => m.user_id === user?.id), [members, user?.id]);

  const getMemberName = useCallback((id: string): string => {
    const m = members.find(x => x.id === id || x.user_id === id);
    return m ? m.display_name.split(' ')[0] : 'Toi';
  }, [members]);

  const getMemberColor = useCallback((id: string): string => {
    const m = members.find(x => x.id === id || x.user_id === id);
    return m?.color ?? C.amber;
  }, [members]);

  // ── Data loading ──
  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data } = await supabase.from('notes')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    setNotes((data ?? []) as Note[]);
  }, [household?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!household?.id) return;
    return subscribeToTable('notes', household.id, () => load());
  }, [household?.id, load]);

  // ── Search (debounce 300ms) ──
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching,   setIsSearching]   = useState(false);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchText.trim() || searchText.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      if (!household?.id) return;
      try {
        const { data } = await supabase.rpc('search_notes', {
          p_household_id: household.id, p_query: searchText.trim(),
        });
        setSearchResults((data ?? []) as Note[]);
      } catch {
        // Fallback: local filter
        const q = searchText.toLowerCase();
        setSearchResults(notes.filter(n =>
          n.title.toLowerCase().includes(q) ||
          (n.content ?? '').toLowerCase().includes(q),
        ));
      } finally { setIsSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText, household?.id, notes]);

  // ── Filtered notes ──
  const displayNotes = useMemo(() => {
    const base = searchText.length >= 2 ? searchResults : notes;
    if (catFilter === 'all') return base;
    return base.filter(n => n.category === catFilter);
  }, [notes, searchResults, searchText, catFilter]);

  const pinnedNotes   = useMemo(() => displayNotes.filter(n => n.is_pinned),    [displayNotes]);
  const unpinnedNotes = useMemo(() => displayNotes.filter(n => !n.is_pinned), [displayNotes]);

  // Count per category
  const catCounts = useMemo(() => {
    const map: Record<string, number> = { all: notes.length };
    CATS.forEach(c => { map[c] = notes.filter(n => n.category === c).length; });
    return map;
  }, [notes]);

  // ── CRUD ──
  const createNote = useCallback(async (data: { title: string; content: string; category: NoteCategory; tags: string[] }) => {
    if (!household?.id || !myMember) return;
    await supabase.from('notes').insert({
      household_id: household.id,
      created_by:   myMember.id,
      last_edited_by: myMember.id,
      title:        data.title,
      content:      data.content || null,
      category:     data.category,
      tags:         data.tags,
      is_pinned:    false,
      is_archived:  false,
      attachments:  [],
    });
    load();
    // Notification
    notificationService.displayNotification({
      type: 'NOTE_CREATED' as any,
      householdId: household.id,
      triggeredByName: myMember.display_name,
      data: { title: data.title, category: data.category, catColor: CAT_CFG[data.category].color },
    }).catch(() => {});
  }, [household?.id, myMember, load]);

  const togglePin = useCallback(async (note: Note) => {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id);
    load();
  }, [load]);

  const deleteNote = useCallback((note: Note) => {
    Alert.alert('Supprimer', `Supprimer "${note.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('notes').delete().eq('id', note.id);
        load();
      }},
    ]);
  }, [load]);

  const handleCardLongPress = useCallback((note: Note) => {
    Alert.alert(note.title, '', [
      { text: note.is_pinned ? '📌 Désépingler' : '📌 Épingler', onPress: () => togglePin(note) },
      { text: '🗑️ Supprimer', style: 'destructive', onPress: () => deleteNote(note) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [togglePin, deleteNote]);

  // ── Search bar animation ──
  const searchAnimStyle = useAnimatedStyle(() => ({
    borderColor: searchFocused.value === 1 ? 'rgba(245,166,35,0.45)' : 'rgba(255,255,255,0.10)',
    shadowOpacity: searchFocused.value * 0.15,
    shadowRadius: searchFocused.value * 8,
  }));

  // ── FAB speed dial handler ──
  const handleSpeedDial = (cat: NoteCategory) => {
    setNewCat(cat);
    setShowModal(true);
  };

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* Ambient glow */}
      <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(245,166,35,0.04)' }} />
      <View style={{ position: 'absolute', top: 120, left: -60, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(78,205,196,0.03)' }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">

        {/* ══ HEADER ══ */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['rgba(245,166,35,0.09)', 'rgba(245,166,35,0.02)', 'transparent']}
            style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 12 }}>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              {/* Icon + Title */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Skia notebook icon */}
                <View style={{ width: 36, height: 36 }}>
                  <Canvas style={{ width: 36, height: 36 }}>
                    <RoundedRect x={6} y={2} width={24} height={30} r={5} color="rgba(245,166,35,0.18)" />
                    <RoundedRect x={6} y={2} width={24} height={30} r={5} color="rgba(245,166,35,0.55)" style="stroke" strokeWidth={1.5} />
                    {[0, 1, 2].map(i => {
                      const p = Skia.Path.Make();
                      p.moveTo(12, 10 + i * 7); p.lineTo(26, 10 + i * 7);
                      return <Path key={i} path={p} color="rgba(245,166,35,0.35)" style="stroke" strokeWidth={1} strokeCap="round" />;
                    })}
                    {/* Spiral */}
                    {[0, 1, 2].map(i => {
                      const p = Skia.Path.Make();
                      p.addArc({ x: 2, y: 7 + i * 8, width: 8, height: 8 }, 0, -180);
                      return <Path key={`s${i}`} path={p} color="rgba(245,166,35,0.60)" style="stroke" strokeWidth={1.5} strokeCap="round" />;
                    })}
                    {/* Bookmark */}
                    <RoundedRect x={26} y={2} width={4} height={9} r={1} color="rgba(245,166,35,0.70)" />
                  </Canvas>
                </View>

                <Text style={{ fontSize: 30, fontFamily: 'Nunito-Bold', color: C.text, letterSpacing: -0.5 }}>
                  Notes
                </Text>
              </View>

              {/* View toggle */}
              <View style={{
                flexDirection: 'row', gap: 2,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12, padding: 3,
                borderWidth: 1, borderColor: C.amberBrd,
              }}>
                {(['grid', 'list'] as const).map(mode => (
                  <Pressable key={mode} onPress={() => setViewMode(mode)} style={{
                    width: 34, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: viewMode === mode ? C.amber : 'transparent',
                  }}>
                    <Text style={{ fontSize: 14, color: viewMode === mode ? '#1A0E00' : C.textMut }}>
                      {mode === 'grid' ? '⊞' : '≡'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Counter */}
            <Text style={{ fontSize: 13, fontFamily: 'DMSans-Regular', color: C.textSec }}>
              {notes.length} note{notes.length !== 1 ? 's' : ''} partagée{notes.length !== 1 ? 's' : ''}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ══ SEARCH BAR ══ */}
        <Animated.View entering={FadeIn.duration(400).delay(80)} style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <Animated.View style={[{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 18, borderWidth: 1,
            paddingHorizontal: 14, paddingVertical: 11, gap: 10,
            shadowColor: C.amber,
          }, searchAnimStyle]}>
            <Text style={{ fontSize: 16, color: 'rgba(245,166,35,0.55)' }}>🔍</Text>
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => { searchFocused.value = withSpring(1); }}
              onBlur={() => { searchFocused.value = withSpring(0); }}
              placeholder="Rechercher une note…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              style={{ flex: 1, color: C.text, fontFamily: 'DMSans-Regular', fontSize: 15, padding: 0 }}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 10, color: C.text }}>✕</Text>
              </Pressable>
            )}
            {isSearching && <Text style={{ fontSize: 12, color: C.textMut }}>…</Text>}
          </Animated.View>
        </Animated.View>

        {/* ══ CATEGORY TABS ══ */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
            {/* "Tout" chip */}
            {(['all', ...CATS] as (NoteCategory | 'all')[]).map(cat => {
              const active = catFilter === cat;
              const cfg    = cat === 'all' ? null : CAT_CFG[cat];
              const color  = cfg ? cfg.color : C.amber;
              const label  = cat === 'all' ? 'Tout' : cfg!.label;
              const emoji  = cat === 'all' ? '🗂️'   : cfg!.emoji;
              const count  = catCounts[cat] ?? 0;
              return (
                <Pressable key={cat} onPress={() => setCatFilter(cat)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? color : C.bgElev,
                  borderWidth: 1, borderColor: active ? color : 'rgba(245,166,35,0.15)',
                  shadowColor: active ? color : 'transparent',
                  shadowOffset: { width: 0, height: 3 }, shadowOpacity: active ? 0.45 : 0,
                  shadowRadius: 10, elevation: active ? 6 : 0,
                }}>
                  <Text style={{ fontSize: 13 }}>{emoji}</Text>
                  <Text style={{
                    fontSize: 12, fontFamily: active ? 'Nunito-Bold' : 'DMSans-Regular',
                    color: active ? '#1A0E00' : 'rgba(255,255,255,0.48)',
                  }}>{label}</Text>
                  {count > 0 && (
                    <View style={{
                      width: 16, height: 16, borderRadius: 8,
                      backgroundColor: active ? 'rgba(26,14,0,0.35)' : color + 'CC',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: active ? '#1A0E00' : '#1A0E00' }}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ══ PINNED SECTION ══ */}
        <PinnedSection
          notes={pinnedNotes}
          onPress={() => {}}
          onLongPress={handleCardLongPress}
          getMemberName={getMemberName}
          getMemberColor={getMemberColor}
          visible={pinnedNotes.length > 0 && searchText.length < 2}
        />
        {pinnedNotes.length > 0 && searchText.length < 2 && (
          <View style={{ height: 18 }} />
        )}

        {/* ══ CONTENT ══ */}
        {displayNotes.length === 0 ? (
          <EmptyState category={catFilter} onAdd={() => setShowModal(true)} />
        ) : viewMode === 'grid' ? (
          <MasonryGrid
            notes={unpinnedNotes}
            onPress={() => {}}
            onLongPress={handleCardLongPress}
            getMemberName={getMemberName}
            getMemberColor={getMemberColor}
          />
        ) : (
          /* ── LIST VIEW ── */
          <View style={{ paddingHorizontal: 16 }}>
            {unpinnedNotes.map((note, i) => {
              const cat   = CAT_CFG[note.category] ?? CAT_CFG.autre;
              const color = note.accent_color ?? cat.color;
              return (
                <Animated.View key={note.id} entering={FadeInUp.duration(350).delay(i * 45)}>
                  <Pressable
                    onLongPress={() => handleCardLongPress(note)}
                    style={{
                      flexDirection: 'row', backgroundColor: C.bgSurface,
                      borderRadius: 16, borderWidth: 1, borderColor: color + '20',
                      marginBottom: 8, overflow: 'hidden',
                      shadowColor: color, shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
                    }}
                  >
                    {/* Left accent */}
                    <View style={{ width: 4, backgroundColor: color, shadowColor: color, shadowRadius: 6, shadowOpacity: 0.8 }} />
                    <View style={{ flex: 1, padding: 13 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <Text style={{ fontSize: 15 }}>{cat.emoji}</Text>
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito-Bold', color: C.text }} numberOfLines={1}>{note.title}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{timeAgo(note.updated_at)}</Text>
                      </View>
                      {note.content ? (
                        <Text style={{ fontSize: 12, fontFamily: 'DMSans-Regular', color: C.textSec, marginBottom: 5 }} numberOfLines={1}>{note.content}</Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getMemberColor(note.created_by) }} />
                        <Text style={{ fontSize: 10, fontFamily: 'DMSans-Regular', color: C.textMut }}>{getMemberName(note.created_by)}</Text>
                        {note.tags.slice(0, 2).map(t => (
                          <View key={t} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 9, fontFamily: 'DMSans-Regular', color: C.textMut }}>#{t}</Text>
                          </View>
                        ))}
                        {note.category === 'liste' && note.checklist && note.checklist.length > 0 && (
                          <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 4 }}>
                            <View style={{
                              height: 3, borderRadius: 2, backgroundColor: C.green,
                              width: `${(note.checklist.filter(i => i.checked).length / note.checklist.length) * 100}%`,
                            }} />
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ══ FAB SPEED DIAL ══ */}
      <SpeedDialFAB onSelect={handleSpeedDial} />

      {/* ══ ADD MODAL ══ */}
      <AddNoteModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={createNote}
      />
    </View>
  );
};
