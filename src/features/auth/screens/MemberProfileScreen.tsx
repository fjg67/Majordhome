import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withDelay,
  interpolateColor,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { MEMBER_COLORS } from '@shared/theme/colors';
import { useAuthStore } from '../store/authStore';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

const { width: SW, height: SH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:      '#1A0E00',
  bgMid:       '#261400',
  bgSurface:   '#2E1A00',

  amber:       '#F5A623',
  amberWarm:   '#E8920A',
  amberSoft:   'rgba(245,166,35,0.15)',
  amberGlow:   'rgba(245,166,35,0.30)',
  amberBorder: 'rgba(245,166,35,0.22)',

  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
  textMuted:     'rgba(255,255,255,0.32)',

  inputBg:       'rgba(255,255,255,0.06)',
  inputBorder:   'rgba(255,255,255,0.12)',
  inputFocus:    'rgba(245,166,35,0.45)',

  cardBg:     'rgba(46,26,0,0.65)',
  cardBorder: 'rgba(245,166,35,0.12)',
};

const AVATAR_EMOJIS = [
  '\u{1F60A}', '\u{1F60E}', '\u{1F913}', '\u{1F98A}', '\u{1F431}', '\u{1F436}', '\u{1F981}', '\u{1F43C}',
  '\u{1F31F}', '\u{1F308}', '\u{1F525}', '\u{1F48E}', '\u{1F3A8}', '\u{1F3B5}', '\u{1F355}', '\u{1F338}',
  '\u{1F680}', '\u{26A1}', '\u{1F3AE}', '\u{1F3E0}', '\u{1F33B}', '\u{1F98B}', '\u{1F340}', '\u{2728}',
];

interface MemberProfileScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'MemberProfile'>;
}

// ═══════════════════════════════════════════════════════════
// ANIMATED BACKGROUND
// ═══════════════════════════════════════════════════════════
const AmberHalos: React.FC = () => {
  const r1 = useSharedValue(130);
  const r2 = useSharedValue(90);

  useEffect(() => {
    r1.value = withRepeat(
      withTiming(180, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    r2.value = withDelay(1200, withRepeat(
      withTiming(130, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true,
    ));
    return () => { r1.value = 130; r2.value = 90; };
  }, []);

  const halo1 = useAnimatedStyle(() => ({
    width: r1.value * 2, height: r1.value * 2, borderRadius: r1.value,
  }));
  const halo2 = useAnimatedStyle(() => ({
    width: r2.value * 2, height: r2.value * 2, borderRadius: r2.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.05, alignSelf: 'center',
        backgroundColor: 'rgba(245,166,35,0.09)',
      }, halo1]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.50, right: -40,
        backgroundColor: 'rgba(232,146,10,0.06)',
      }, halo2]} />
    </View>
  );
};

const AmberParticle: React.FC<{
  top: number; left: number; size: number; delay: number;
}> = ({ top, left, size, delay }) => {
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0.65, { duration: 2500 + Math.random() * 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
    return () => { opacity.value = 0.2; };
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{
      position: 'absolute', top, left,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.amber,
    }, style]} />
  );
};

const PARTICLES = [
  { top: 80, left: SW * 0.12, size: 3, delay: 0 },
  { top: 130, left: SW * 0.78, size: 2.5, delay: 500 },
  { top: 200, left: SW * 0.45, size: 3, delay: 1000 },
  { top: 60, left: SW * 0.9, size: 2, delay: 300 },
  { top: SH * 0.6, left: SW * 0.2, size: 2.5, delay: 800 },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({
  navigation,
}) => {
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(MEMBER_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState('\u{1F60A}');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarScale = useSharedValue(1);
  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  // Animated input focus
  const nameFocus = useSharedValue(0);
  const nameInputStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      nameFocus.value, [0, 1],
      [C.inputBorder, C.inputFocus],
    ),
    shadowColor: C.amber,
    shadowOpacity: interpolate(nameFocus.value, [0, 1], [0, 0.2]),
    shadowRadius: interpolate(nameFocus.value, [0, 1], [0, 8]),
    shadowOffset: { width: 0, height: 0 },
  }));
  const nameLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      nameFocus.value, [0, 1],
      ['rgba(255,255,255,0.55)', 'rgba(245,166,35,0.80)'],
    ),
  }));

  // Pulsing glow on avatar ring
  const ringGlow = useSharedValue(0.15);
  useEffect(() => {
    ringGlow.value = withRepeat(
      withTiming(0.35, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    return () => { ringGlow.value = 0.15; };
  }, []);
  const ringGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: ringGlow.value,
    shadowOffset: { width: 0, height: 0 },
  }));

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Erreur', 'Choisissez un prénom ou surnom');
      return;
    }

    setIsSubmitting(true);

    const result = await updateProfile({
      displayName: displayName.trim(),
      color: selectedColor,
      avatarEmoji: selectedEmoji,
    });
    if (result.error) {
      setIsSubmitting(false);
      Alert.alert('Erreur', result.error);
      return;
    }

    setIsSubmitting(false);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [displayName, selectedColor, selectedEmoji, updateProfile, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDeep} />
      <LinearGradient
        colors={[C.bgDeep, C.bgMid, C.bgDeep]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <AmberHalos />
      {PARTICLES.map((p, i) => <AmberParticle key={i} {...p} />)}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Header ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).springify()} style={styles.header}>
          <Text style={styles.title}>Votre profil</Text>
          <Text style={styles.subtitle}>
            Comment les autres vous verront
          </Text>
        </Animated.View>

        {/* ─── Avatar preview ─── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(700).springify()}
          style={[avatarAnimStyle, styles.avatarPreview]}
        >
          <Animated.View style={[styles.avatarOuter, {
            shadowColor: selectedColor,
          }, ringGlowStyle]}>
            <View style={[styles.avatarRing, { borderColor: selectedColor + '35' }]}>
              <View style={[styles.avatarCircle, {
                backgroundColor: selectedColor + '18',
                borderColor: selectedColor,
              }]}>
                <Text style={styles.avatarEmoji}>{selectedEmoji}</Text>
              </View>
            </View>
          </Animated.View>
          <Text style={styles.previewName}>
            {displayName || 'Votre nom'}
          </Text>
        </Animated.View>

        {/* ─── Name input ─── */}
        <Animated.View entering={FadeInUp.delay(300).duration(600).springify()}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Animated.Text style={[styles.sectionLabel, nameLabelStyle]}>PRÉNOM OU SURNOM</Animated.Text>
            </View>
            <Animated.View style={[styles.inputContainer, nameInputStyle]}>
              <View style={styles.inputIconWrap}>
                <Text style={styles.inputIcon}>{'\u270F\uFE0F'}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Ex: Alex, Maman, Papa..."
                placeholderTextColor={C.textMuted}
                selectionColor={C.amber}
                value={displayName}
                onChangeText={setDisplayName}
                onFocus={() => { nameFocus.value = withTiming(1, { duration: 200 }); }}
                onBlur={() => { nameFocus.value = withTiming(0, { duration: 200 }); }}
                maxLength={30}
              />
            </Animated.View>
          </View>
        </Animated.View>

        {/* ─── Color picker ─── */}
        <Animated.View entering={FadeInUp.delay(400).duration(600).springify()}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: selectedColor }]} />
              <Text style={styles.sectionTitle}>Votre couleur</Text>
            </View>
            <View style={styles.colorGrid}>
              {MEMBER_COLORS.map((color, i) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    setSelectedColor(color);
                    avatarScale.value = withSpring(1.1, {}, () => {
                      avatarScale.value = withSpring(1);
                    });
                  }}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                >
                  <Animated.View
                    entering={FadeIn.delay(400 + i * 40).duration(300)}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      selectedColor === color && [styles.colorSelected, {
                        borderColor: '#FFFFFF',
                        shadowColor: color,
                      }],
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ─── Emoji picker ─── */}
        <Animated.View entering={FadeInUp.delay(500).duration(600).springify()}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 14 }}>{selectedEmoji}</Text>
              <Text style={styles.sectionTitle}>Votre avatar</Text>
            </View>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((emoji, i) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    setSelectedEmoji(emoji);
                    avatarScale.value = withSpring(1.15, {}, () => {
                      avatarScale.value = withSpring(1);
                    });
                  }}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                >
                  <Animated.View
                    entering={FadeIn.delay(500 + i * 25).duration(250)}
                    style={[
                      styles.emojiCircle,
                      {
                        backgroundColor:
                          selectedEmoji === emoji
                            ? selectedColor + '18'
                            : 'rgba(255,255,255,0.04)',
                        borderColor:
                          selectedEmoji === emoji
                            ? selectedColor
                            : C.inputBorder,
                      },
                    ]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Animated.View>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ─── Save button ─── */}
        <Animated.View entering={FadeInUp.delay(700).duration(600).springify()}>
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.saveBtn, {
              opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.975 : 1 }],
            }]}
          >
            <LinearGradient
              colors={[C.amber, C.amberWarm]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>C'est parti ! {'\u{1F680}'}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgDeep },
  scrollContent: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },

  // ─── Header ───
  header: { alignItems: 'center', marginBottom: 20 },
  title: {
    fontFamily: 'Nunito-Bold', fontSize: 34, color: C.textPrimary,
    letterSpacing: -0.8, marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular', fontSize: 15, color: C.textSecondary,
    letterSpacing: 0.2,
  },

  // ─── Avatar ───
  avatarPreview: { alignItems: 'center', marginBottom: 28 },
  avatarOuter: {
    borderRadius: 60, marginBottom: 14,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, elevation: 8,
  },
  avatarRing: {
    width: 114, height: 114, borderRadius: 57,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 46 },
  previewName: {
    fontFamily: 'Nunito-Bold', fontSize: 24, color: C.textPrimary,
  },

  // ─── Sections ───
  section: {
    padding: 20, marginBottom: 14, borderRadius: 22, borderWidth: 1,
    backgroundColor: C.cardBg, borderColor: C.cardBorder,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber,
  },
  sectionLabel: {
    fontFamily: 'Nunito-Bold', fontSize: 11, letterSpacing: 1.5,
  },
  sectionTitle: {
    fontFamily: 'Nunito-SemiBold', fontSize: 16, color: C.textPrimary,
  },

  // ─── Input ───
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 56,
    backgroundColor: C.inputBg,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  inputIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1, height: 56, fontSize: 16,
    fontFamily: 'DMSans-Regular', color: C.textPrimary, padding: 0,
  },

  // ─── Colors ───
  colorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center',
  },
  colorCircle: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 3, borderColor: 'transparent',
  },
  colorSelected: {
    borderWidth: 3, transform: [{ scale: 1.18 }],
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },

  // ─── Emojis ───
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
  },
  emojiCircle: {
    width: 52, height: 52, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 24 },

  // ─── Save ───
  saveBtn: { marginTop: 8, marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  saveBtnGradient: {
    height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontFamily: 'Nunito-Bold', fontSize: 18, color: '#FFFFFF' },
});
