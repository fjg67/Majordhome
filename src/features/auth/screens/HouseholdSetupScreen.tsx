import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  interpolateColor,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
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
  bgElevated:  '#3A2200',

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

  success: '#34D399',
  error:   '#FF4444',

  cardBg:     'rgba(46,26,0,0.65)',
  cardBorder: 'rgba(245,166,35,0.12)',
};

// ═══════════════════════════════════════════════════════════
// ANIMATED BACKGROUND — Amber Halos
// ═══════════════════════════════════════════════════════════
const AmberHalos: React.FC = () => {
  const r1 = useSharedValue(140);
  const r2 = useSharedValue(100);
  const r3 = useSharedValue(70);

  useEffect(() => {
    r1.value = withRepeat(
      withTiming(190, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    r2.value = withDelay(1500, withRepeat(
      withTiming(140, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true,
    ));
    r3.value = withDelay(800, withRepeat(
      withTiming(110, { duration: 4500, easing: Easing.inOut(Easing.sin) }), -1, true,
    ));
    return () => { r1.value = 140; r2.value = 100; r3.value = 70; };
  }, []);

  const halo1 = useAnimatedStyle(() => ({
    width: r1.value * 2, height: r1.value * 2, borderRadius: r1.value,
  }));
  const halo2 = useAnimatedStyle(() => ({
    width: r2.value * 2, height: r2.value * 2, borderRadius: r2.value,
  }));
  const halo3 = useAnimatedStyle(() => ({
    width: r3.value * 2, height: r3.value * 2, borderRadius: r3.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.08, alignSelf: 'center',
        backgroundColor: 'rgba(245,166,35,0.10)',
      }, halo1]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.55, right: -50,
        backgroundColor: 'rgba(232,146,10,0.07)',
      }, halo2]} />
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.35, left: -35,
        backgroundColor: 'rgba(245,166,35,0.05)',
      }, halo3]} />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// FLOATING AMBER PARTICLES
// ═══════════════════════════════════════════════════════════
const AmberParticle: React.FC<{
  top: number; left: number; size: number; delay: number;
}> = ({ top, left, size, delay }) => {
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0.7, { duration: 2500 + Math.random() * 2000, easing: Easing.inOut(Easing.sin) }),
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
  { top: 100, left: SW * 0.15, size: 3, delay: 0 },
  { top: 150, left: SW * 0.75, size: 2.5, delay: 600 },
  { top: 220, left: SW * 0.5, size: 3.5, delay: 1200 },
  { top: 80, left: SW * 0.88, size: 2, delay: 400 },
  { top: 280, left: SW * 0.25, size: 2.5, delay: 900 },
  { top: SH * 0.7, left: SW * 0.6, size: 3, delay: 1500 },
  { top: SH * 0.8, left: SW * 0.1, size: 2, delay: 700 },
];

// ═══════════════════════════════════════════════════════════
// CODE INPUT — Individual character boxes
// ═══════════════════════════════════════════════════════════
const CodeBox: React.FC<{
  char: string;
  isActive: boolean;
  isFilled: boolean;
  index: number;
}> = ({ char, isActive, isFilled, index }) => {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      glow.value, [0, 1],
      [isFilled ? C.amberBorder : C.inputBorder, C.amber],
    ),
    shadowOpacity: interpolate(glow.value, [0, 1], [0, 0.3]),
    shadowRadius: interpolate(glow.value, [0, 1], [0, 10]),
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: isFilled
      ? 'rgba(245,166,35,0.08)'
      : C.inputBg,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(100 + index * 50).duration(400).springify()}
      style={[styles.codeBox, boxStyle, { shadowColor: C.amber }]}
    >
      <Text style={styles.codeChar}>{char}</Text>
      {isActive && !char && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.codeCursor}
        />
      )}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
type HouseholdMode = 'choose' | 'create' | 'join';

interface HouseholdSetupScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'HouseholdSetup'>;
}

export const HouseholdSetupScreen: React.FC<HouseholdSetupScreenProps> = ({
  navigation,
}) => {
  const createHousehold = useAuthStore((s) => s.createHousehold);
  const joinHousehold = useAuthStore((s) => s.joinHousehold);

  const [mode, setMode] = useState<HouseholdMode>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  // Animated values for input focus
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

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Donnez un nom à votre foyer');
      return;
    }
    setIsSubmitting(true);
    const result = await createHousehold(name.trim());
    setIsSubmitting(false);
    if (result.error) {
      Alert.alert('Erreur', result.error);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MemberProfile' }] });
  }, [name, createHousehold, navigation]);

  const handleJoin = useCallback(async () => {
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 8) {
      Alert.alert('Erreur', "Le code d'invitation doit contenir 8 caractères");
      return;
    }
    setIsSubmitting(true);
    const result = await joinHousehold(cleaned);
    setIsSubmitting(false);
    if (result.error) {
      Alert.alert('Erreur', result.error);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MemberProfile' }] });
  }, [code, joinHousehold, navigation]);

  // Code chars split for individual boxes
  const codeChars = code.padEnd(8, '').split('').slice(0, 8);

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

      <View style={styles.content}>
        {/* ─── Header ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).springify()} style={styles.header}>
          <View style={styles.emojiBox}>
            <LinearGradient
              colors={[C.amberGlow, 'rgba(245,166,35,0.08)']}
              style={styles.emojiGlow}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>🏠</Text>
            </View>
          </View>

          <Text style={styles.title}>
            {mode === 'choose' ? 'Votre foyer' : mode === 'create' ? 'Créer un foyer' : 'Rejoindre'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'choose'
              ? 'Créez ou rejoignez un foyer familial'
              : mode === 'create'
              ? 'Donnez un nom à votre espace ✨'
              : 'Entrez le code d\'invitation 🔗'}
          </Text>
        </Animated.View>

        {/* ─── Choose mode ─── */}
        {mode === 'choose' && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(700).springify()}
            layout={Layout.springify()}
            style={styles.choiceRow}
          >
            {/* Create Card */}
            <Pressable
              onPress={() => setMode('create')}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Animated.View
                entering={FadeInUp.delay(350).duration(600).springify()}
                style={styles.choiceCard}
              >
                <View style={[styles.choiceGlowBar, { backgroundColor: C.amber }]} />
                <View style={styles.choiceIconWrap}>
                  <LinearGradient
                    colors={['rgba(245,166,35,0.20)', 'rgba(245,166,35,0.05)']}
                    style={styles.choiceIconCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.choiceEmoji}>✨</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.choiceTitle}>Créer</Text>
                <Text style={styles.choiceDesc}>Nouveau foyer</Text>
              </Animated.View>
            </Pressable>

            {/* Join Card */}
            <Pressable
              onPress={() => setMode('join')}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Animated.View
                entering={FadeInUp.delay(450).duration(600).springify()}
                style={styles.choiceCard}
              >
                <View style={[styles.choiceGlowBar, { backgroundColor: C.success }]} />
                <View style={styles.choiceIconWrap}>
                  <LinearGradient
                    colors={['rgba(52,211,153,0.20)', 'rgba(52,211,153,0.05)']}
                    style={styles.choiceIconCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.choiceEmoji}>🔗</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.choiceTitle}>Rejoindre</Text>
                <Text style={styles.choiceDesc}>Code d'invitation</Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        )}

        {/* ─── Create form ─── */}
        {mode === 'create' && (
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} layout={Layout.springify()}>
            <View style={styles.formCard}>
              <View style={styles.formAccent}>
                <LinearGradient
                  colors={[C.amber, C.amberWarm, 'rgba(245,166,35,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.formAccentGradient}
                />
              </View>

              <Animated.Text style={[styles.label, nameLabelStyle]}>NOM DU FOYER</Animated.Text>
              <Animated.View style={[styles.inputContainer, nameInputStyle]}>
                <View style={styles.inputIconWrap}>
                  <Text style={styles.inputIcon}>🏠</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: La maison Dupont"
                  placeholderTextColor={C.textMuted}
                  selectionColor={C.amber}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => { nameFocus.value = withTiming(1, { duration: 200 }); }}
                  onBlur={() => { nameFocus.value = withTiming(0, { duration: 200 }); }}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              </Animated.View>

              <Pressable
                onPress={handleCreate}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.submitBtn, {
                  opacity: isSubmitting ? 0.65 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.975 : 1 }],
                }]}
              >
                <LinearGradient
                  colors={[C.amber, C.amberWarm]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>Créer le foyer ✨</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => { setMode('choose'); setName(''); }}
                style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={styles.backText}>← Retour</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* ─── Join form ─── */}
        {mode === 'join' && (
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} layout={Layout.springify()}>
            <View style={styles.formCard}>
              <View style={styles.formAccent}>
                <LinearGradient
                  colors={[C.success, 'rgba(52,211,153,0.4)', 'rgba(52,211,153,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.formAccentGradient}
                />
              </View>

              <Text style={styles.labelStatic}>CODE D'INVITATION</Text>
              <Text style={styles.codeHint}>Entrez le code à 8 caractères partagé par un membre du foyer</Text>

              {/* Individual code boxes */}
              <Pressable
                onPress={() => codeInputRef.current?.focus()}
                style={styles.codeBoxRow}
              >
                {codeChars.map((char, i) => (
                  <CodeBox
                    key={i}
                    char={char}
                    isActive={i === code.length && code.length < 8}
                    isFilled={!!char.trim()}
                    index={i}
                  />
                ))}
                {/* Hidden input */}
                <TextInput
                  ref={codeInputRef}
                  style={styles.hiddenInput}
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  autoFocus
                  autoCapitalize="characters"
                  maxLength={8}
                  returnKeyType="done"
                  onSubmitEditing={handleJoin}
                  caretHidden
                />
              </Pressable>

              {/* Progress dots */}
              <View style={styles.progressRow}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      { backgroundColor: i < code.length ? C.amber : 'rgba(255,255,255,0.12)' },
                    ]}
                  />
                ))}
              </View>

              <Pressable
                onPress={handleJoin}
                disabled={isSubmitting || code.length < 8}
                style={({ pressed }) => [styles.submitBtn, {
                  opacity: isSubmitting ? 0.65 : code.length < 8 ? 0.4 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.975 : 1 }],
                }]}
              >
                <LinearGradient
                  colors={code.length === 8 ? [C.success, '#2BBF8A'] : ['rgba(52,211,153,0.3)', 'rgba(52,211,153,0.15)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>Rejoindre le foyer 🔗</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => { setMode('choose'); setCode(''); }}
                style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={styles.backText}>← Retour</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgDeep },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  // ─── Header ───
  header: { alignItems: 'center', marginBottom: 36 },
  emojiBox: { alignItems: 'center', justifyContent: 'center', marginBottom: 18, width: 88, height: 88 },
  emojiGlow: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44,
  },
  emojiCircle: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1, borderColor: C.amberBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 36 },
  title: {
    fontFamily: 'Nunito-Bold', fontSize: 34, color: C.textPrimary,
    letterSpacing: -0.8, marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular', fontSize: 15, color: C.textSecondary,
    textAlign: 'center', letterSpacing: 0.2, lineHeight: 22,
    paddingHorizontal: 20,
  },

  // ─── Choice cards ───
  choiceRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  choiceCard: {
    width: 158, alignItems: 'center',
    paddingVertical: 28, paddingHorizontal: 16,
    borderRadius: 22, borderWidth: 1,
    backgroundColor: C.cardBg,
    borderColor: C.cardBorder,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  choiceGlowBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  choiceIconWrap: { marginBottom: 14, marginTop: 4 },
  choiceIconCircle: {
    width: 58, height: 58, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceEmoji: { fontSize: 28 },
  choiceTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: C.textPrimary, marginBottom: 4 },
  choiceDesc: { fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textSecondary, textAlign: 'center' },

  // ─── Form card ───
  formCard: {
    borderRadius: 24, borderWidth: 1,
    backgroundColor: C.cardBg,
    borderColor: C.cardBorder,
    padding: 24, paddingTop: 0,
    overflow: 'hidden',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  formAccent: {
    height: 3, marginHorizontal: -24, marginBottom: 22,
    overflow: 'hidden',
  },
  formAccentGradient: { flex: 1, height: 3 },

  // ─── Label ───
  label: {
    fontFamily: 'Nunito-Bold', fontSize: 11,
    letterSpacing: 1.5, marginTop: 4, marginBottom: 8, marginLeft: 2,
  },
  labelStatic: {
    fontFamily: 'Nunito-Bold', fontSize: 11,
    letterSpacing: 1.5, marginTop: 4, marginBottom: 6, marginLeft: 2,
    color: 'rgba(255,255,255,0.55)',
  },

  // ─── Input ───
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 0,
    height: 56,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  inputIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1, marginLeft: 10,
    fontFamily: 'DMSans-Regular', fontSize: 16,
    color: C.textPrimary, padding: 0, height: 56,
  },

  // ─── Code boxes ───
  codeHint: {
    fontFamily: 'DMSans-Regular', fontSize: 13, color: C.textMuted,
    marginBottom: 18, lineHeight: 18,
  },
  codeBoxRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    position: 'relative',
  },
  codeBox: {
    width: 38, height: 50,
    borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  codeChar: {
    fontFamily: 'Nunito-Bold', fontSize: 22, color: C.amber,
    letterSpacing: 0,
  },
  codeCursor: {
    width: 2, height: 24, borderRadius: 1,
    backgroundColor: C.amber,
  },
  hiddenInput: {
    position: 'absolute', width: 1, height: 1,
    opacity: 0,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    marginTop: 12, marginBottom: 4,
  },
  progressDot: {
    width: 6, height: 6, borderRadius: 3,
  },

  // ─── Submit button ───
  submitBtn: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  submitGradient: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: 'Nunito-Bold', fontSize: 16, color: '#FFFFFF', letterSpacing: 0.3 },

  // ─── Back ───
  backBtn: { alignSelf: 'center', paddingVertical: 14, marginTop: 4 },
  backText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: C.textMuted },
});
