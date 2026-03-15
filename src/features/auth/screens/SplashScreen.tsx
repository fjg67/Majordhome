import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  Canvas,
  Circle,
  RadialGradient,
  vec,
  BlurMask,
  Path,
  Group,
  RoundedRect,
  Line as SkLine,
} from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2 - 40;

// ─── Palette ───
const P = {
  bgDeep: '#1A0E00',
  amber: '#F5A623',
  amberWarm: '#E8920A',
  amberDeep: '#C4720A',
  cream: 'rgba(255,248,230,0.95)',
};

// ─── Particle seed data (positions, sizes, speeds) ───
const PARTICLE_COUNT = 14;
const particleSeeds = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  startX: CX + (Math.random() - 0.5) * 100,
  startY: CY + 20 + Math.random() * 40,
  radius: 2 + Math.random() * 3.5,
  driftY: -(140 + Math.random() * 160),
  driftX: (Math.random() - 0.5) * 70,
  duration: 1800 + i * 110,
  delay: 1000 + i * 100,
  blur: 1.5 + Math.random() * 2.5,
  color: i % 3 === 0 ? P.amber : i % 3 === 1 ? P.amberWarm : P.amberDeep,
}));

// ─── Orbital dot positions ───
const ORBITAL_R = 72;
const orbitalDots = [0, 120, 240].map(deg => ({
  angle: (deg * Math.PI) / 180,
  size: deg === 0 ? 4 : 3,
}));

interface SplashScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'Splash'>;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const initialize = useAuthStore(s => s.initialize);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHousehold = useAuthStore(s => s.hasHousehold);
  const hasProfile = useAuthStore(s => s.hasProfile);
  const isLoading = useAuthStore(s => s.isLoading);

  // ── Shared values ──
  // Phase 1: Glow
  const glowProgress = useSharedValue(0);
  // Phase 2: Logo
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  // Orbital ring
  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  // Sparkle on roof
  const sparkleScale = useSharedValue(0);
  // Chimney smoke
  const smoke1Y = useSharedValue(0);
  const smoke2Y = useSharedValue(0);
  const smoke3Y = useSharedValue(0);
  const smoke1Op = useSharedValue(0);
  const smoke2Op = useSharedValue(0);
  const smoke3Op = useSharedValue(0);
  // Phase 3: Particles
  const particleProgress = Array.from({ length: PARTICLE_COUNT }, () => useSharedValue(0));
  const particleOpacity = Array.from({ length: PARTICLE_COUNT }, () => useSharedValue(0));
  // Phase 4: Title
  const titleRevealX = useSharedValue(-SW);
  const lineWidth = useSharedValue(0);
  // Phase 5: Tagline + loader
  const taglineOpacity = useSharedValue(0);
  const loaderOpacity = useSharedValue(0);
  const loaderProgress = useSharedValue(0);
  // Phase 6: Signature
  const signatureOpacity = useSharedValue(0);
  // Phase 7: Exit
  const exitScale = useSharedValue(1);
  const exitOpacity = useSharedValue(1);

  // ── Animation sequence ──
  useEffect(() => {
    // PHASE 1 — Glow (200ms)
    glowProgress.value = withDelay(200, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // PHASE 2 — Logo (600ms)
    logoScale.value = withDelay(600, withSpring(1, { damping: 18, stiffness: 160 }));
    logoOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    // Orbital ring
    ringOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
    ringRotation.value = withDelay(800,
      withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1),
    );

    // Sparkle pulse
    sparkleScale.value = withDelay(1200,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      ),
    );

    // Chimney smoke
    const smokeAnim = (yVal: Animated.SharedValue<number>, opVal: Animated.SharedValue<number>, delay: number) => {
      yVal.value = withDelay(delay,
        withRepeat(withTiming(-14, { duration: 1600, easing: Easing.out(Easing.cubic) }), -1),
      );
      opVal.value = withDelay(delay,
        withRepeat(
          withSequence(
            withTiming(0.5, { duration: 400 }),
            withTiming(0, { duration: 1200 }),
          ),
          -1,
        ),
      );
    };
    smokeAnim(smoke1Y, smoke1Op, 900);
    smokeAnim(smoke2Y, smoke2Op, 1200);
    smokeAnim(smoke3Y, smoke3Op, 1500);

    // PHASE 3 — Particles (1000ms)
    particleSeeds.forEach((seed, i) => {
      particleOpacity[i].value = withDelay(seed.delay, withTiming(0.85, { duration: 250 }));
      particleProgress[i].value = withDelay(seed.delay,
        withRepeat(withTiming(1, { duration: seed.duration, easing: Easing.out(Easing.cubic) }), -1),
      );
    });

    // PHASE 4 — Title (1400ms)
    titleRevealX.value = withDelay(1400, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    lineWidth.value = withDelay(1800, withTiming(120, { duration: 400, easing: Easing.out(Easing.cubic) }));

    // PHASE 5 — Tagline + loader (1700ms)
    taglineOpacity.value = withDelay(1700, withTiming(1, { duration: 400 }));
    loaderOpacity.value = withDelay(1700, withTiming(1, { duration: 300 }));
    loaderProgress.value = withDelay(1800, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }));

    // Signature
    signatureOpacity.value = withDelay(2000, withTiming(0.3, { duration: 500 }));

    // Auth init
    initialize();
  }, []);

  // ── Navigation after auth check ──
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      const doNav = () => {
        if (!isAuthenticated) {
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        } else if (!hasHousehold) {
          navigation.reset({ index: 0, routes: [{ name: 'HouseholdSetup' }] });
        } else if (!hasProfile) {
          navigation.reset({ index: 0, routes: [{ name: 'MemberProfile' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      };
      // Exit animation
      exitScale.value = withTiming(isAuthenticated ? 1.06 : 0.94, { duration: 300 });
      exitOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(() => runOnJS(doNav)(), 320);
    }, 2600);
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, hasHousehold, hasProfile, navigation]);

  // ── Animated styles ──
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: exitScale.value }],
    opacity: exitOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
    opacity: interpolate(sparkleScale.value, [0, 1, 1.3], [0, 1, 0.7]),
  }));

  const titleClipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: titleRevealX.value }],
  }));

  const lineAnimStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }));

  const taglineAnimStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const loaderContainerStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
  }));

  const loaderFillStyle = useAnimatedStyle(() => ({
    width: interpolate(loaderProgress.value, [0, 1], [0, 120]),
  }));

  const signatureStyle = useAnimatedStyle(() => ({
    opacity: signatureOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>

      {/* ═══ COUCHE 0 — Skia Glow Halos ═══ */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Main amber halo */}
        <Group>
          <Circle cx={CX} cy={CY} r={200}>
            <RadialGradient
              c={vec(CX, CY)}
              r={200}
              colors={['rgba(245,166,35,0.22)', 'rgba(245,166,35,0.08)', 'transparent']}
            />
            <BlurMask blur={40} style="normal" />
          </Circle>
        </Group>
        {/* Secondary larger halo */}
        <Group>
          <Circle cx={CX} cy={CY} r={320}>
            <RadialGradient
              c={vec(CX, CY)}
              r={320}
              colors={['rgba(232,146,10,0.10)', 'rgba(232,146,10,0.04)', 'transparent']}
            />
            <BlurMask blur={80} style="normal" />
          </Circle>
        </Group>
        {/* Coral accent halo (offset) */}
        <Group>
          <Circle cx={CX + 20} cy={CY + 30} r={140}>
            <RadialGradient
              c={vec(CX + 20, CY + 30)}
              r={140}
              colors={['rgba(255,107,107,0.06)', 'transparent']}
            />
            <BlurMask blur={60} style="normal" />
          </Circle>
        </Group>
      </Canvas>

      {/* ═══ COUCHE 1 — Particles (Animated.View) ═══ */}
      {particleSeeds.map((seed, i) => (
        <AnimatedParticle
          key={i}
          seed={seed}
          progress={particleProgress[i]}
          opacity={particleOpacity[i]}
        />
      ))}

      {/* ═══ COUCHE 2 — Orbital Ring ═══ */}
      <Animated.View style={[styles.orbitalContainer, ringStyle]}>
        {/* Dashed ring */}
        <View style={styles.dashedRing} />
        {/* 3 orbital dots */}
        {orbitalDots.map((dot, i) => {
          const dx = Math.cos(dot.angle) * ORBITAL_R;
          const dy = Math.sin(dot.angle) * ORBITAL_R;
          return (
            <View
              key={i}
              style={[
                styles.orbitalDot,
                {
                  width: dot.size * 2,
                  height: dot.size * 2,
                  borderRadius: dot.size,
                  left: ORBITAL_R + dx - dot.size,
                  top: ORBITAL_R + dy - dot.size,
                  backgroundColor: P.amber,
                  ...(i === 0 ? {
                    shadowColor: P.amber,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 6,
                    elevation: 4,
                  } : {}),
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* ═══ COUCHE 3 — Logo Maison ═══ */}
      <Animated.View style={[styles.logoOuter, logoStyle]}>
        <LinearGradient
          colors={['rgba(245,166,35,0.18)', 'rgba(38,20,0,0.85)']}
          style={styles.logoBox}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {/* House SVG via Skia */}
          <Canvas style={{ width: 56, height: 56 }}>
            {/* Roof triangle */}
            <Path
              path="M28 4 L4 26 L52 26 Z"
              color={P.amber}
            />
            {/* Chimney */}
            <RoundedRect x={38} y={10} width={7} height={12} r={2} color={P.amberWarm} />
            {/* Body */}
            <RoundedRect x={6} y={26} width={44} height={26} r={2} color="#3A2200">
            </RoundedRect>
            <RoundedRect x={6} y={26} width={44} height={26} r={2}
              style="stroke" strokeWidth={1} color="rgba(245,166,35,0.30)" />
            {/* Door */}
            <RoundedRect x={22} y={36} width={12} height={16} r={3} color={P.amber} />
            {/* Door knob */}
            <Circle cx={31} cy={45} r={1.2} color="#3A2200" />
            {/* Windows */}
            <RoundedRect x={10} y={31} width={9} height={9} r={2}
              color="rgba(245,166,35,0.12)" />
            <RoundedRect x={10} y={31} width={9} height={9} r={2}
              style="stroke" strokeWidth={0.8} color="rgba(245,166,35,0.45)" />
            {/* Window cross */}
            <SkLine p1={vec(14.5, 31)} p2={vec(14.5, 40)}
              style="stroke" strokeWidth={0.6} color="rgba(245,166,35,0.30)" />
            <SkLine p1={vec(10, 35.5)} p2={vec(19, 35.5)}
              style="stroke" strokeWidth={0.6} color="rgba(245,166,35,0.30)" />
            {/* Right window */}
            <RoundedRect x={37} y={31} width={9} height={9} r={2}
              color="rgba(245,166,35,0.12)" />
            <RoundedRect x={37} y={31} width={9} height={9} r={2}
              style="stroke" strokeWidth={0.8} color="rgba(245,166,35,0.45)" />
            <SkLine p1={vec(41.5, 31)} p2={vec(41.5, 40)}
              style="stroke" strokeWidth={0.6} color="rgba(245,166,35,0.30)" />
            <SkLine p1={vec(37, 35.5)} p2={vec(46, 35.5)}
              style="stroke" strokeWidth={0.6} color="rgba(245,166,35,0.30)" />
          </Canvas>

          {/* Sparkle on roof */}
          <Animated.View style={[styles.sparkle, sparkleStyle]}>
            <Text style={styles.sparkleText}>✦</Text>
          </Animated.View>
        </LinearGradient>

        {/* Chimney smoke (3 dots) */}
        <SmokeParticle y={smoke1Y} opacity={smoke1Op} offsetX={-4} />
        <SmokeParticle y={smoke2Y} opacity={smoke2Op} offsetX={0} />
        <SmokeParticle y={smoke3Y} opacity={smoke3Op} offsetX={4} />
      </Animated.View>

      {/* ═══ COUCHE 4 — Title ═══ */}
      <View style={styles.titleContainer}>
        <View style={styles.titleClip}>
          <Animated.View style={titleClipStyle}>
            <Text style={styles.title}>MajordHome</Text>
          </Animated.View>
        </View>
        {/* Decorative line */}
        <Animated.View style={[styles.titleLineWrap, lineAnimStyle]}>
          <LinearGradient
            colors={['transparent', P.amber, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* ═══ COUCHE 5 — Tagline ═══ */}
      <Animated.Text style={[styles.tagline, taglineAnimStyle]}>
        Votre foyer, synchronisé
      </Animated.Text>

      {/* ═══ COUCHE 6 — Loader ═══ */}
      <Animated.View style={[styles.loaderWrap, loaderContainerStyle]}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderFill, loaderFillStyle]}>
            <LinearGradient
              colors={[P.amber, '#FFD700', P.amber]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* ═══ COUCHE 7 — Signature ═══ */}
      <Animated.Text style={[styles.signature, signatureStyle, { bottom: 44 + insets.bottom }]}>
        Fait avec ❤️ pour votre foyer
      </Animated.Text>
    </Animated.View>
  );
};

// ── Smoke particle component ──
const SmokeParticle: React.FC<{
  y: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
  offsetX: number;
}> = ({ y, opacity, offsetX }) => {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[{
      position: 'absolute',
      top: -8,
      right: 12 + offsetX,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: 'rgba(245,166,35,0.35)',
    }, style]} />
  );
};

// ── Animated particle (View-based) ──
const AnimatedParticle: React.FC<{
  seed: typeof particleSeeds[0];
  progress: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
}> = ({ seed, progress, opacity }) => {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      position: 'absolute',
      left: seed.startX + seed.driftX * t - seed.radius,
      top: seed.startY + seed.driftY * t - seed.radius,
      width: seed.radius * 2 * (1 - t * 0.7),
      height: seed.radius * 2 * (1 - t * 0.7),
      borderRadius: seed.radius,
      backgroundColor: seed.color,
      opacity: opacity.value * (1 - t),
    };
  });
  return <Animated.View style={style} pointerEvents="none" />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitalContainer: {
    position: 'absolute',
    width: ORBITAL_R * 2,
    height: ORBITAL_R * 2,
    top: CY - ORBITAL_R,
    left: CX - ORBITAL_R,
  },
  dashedRing: {
    position: 'absolute',
    width: ORBITAL_R * 2,
    height: ORBITAL_R * 2,
    borderRadius: ORBITAL_R,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.18)',
    borderStyle: 'dashed',
  },
  orbitalDot: {
    position: 'absolute',
  },
  logoOuter: {
    marginBottom: 28,
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.45)',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  sparkle: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
  },
  sparkleText: {
    fontSize: 10,
    color: '#FFD700',
    textShadowColor: 'rgba(255,215,0,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleClip: {
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: -1,
    textShadowColor: 'rgba(245,166,35,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  titleLineWrap: {
    height: 2,
    borderRadius: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  tagline: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  loaderWrap: {
    marginTop: 32,
    alignItems: 'center',
  },
  loaderTrack: {
    width: 120,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  loaderFill: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  signature: {
    position: 'absolute',
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
  },
});
