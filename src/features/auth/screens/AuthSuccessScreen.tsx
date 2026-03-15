import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
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
  Skia,
  DashPathEffect,
} from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';
import type { RouteProp } from '@react-navigation/native';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2 - 40;

// ═══════════════════════════════════════════════════════════
// PALETTE — Dark Amber Premium (DO NOT MODIFY)
// ═══════════════════════════════════════════════════════════
const C = {
  bgDeep:      '#1A0E00',
  bgMid:       '#261400',
  bgSurface:   '#2E1A00',
  bgElevated:  '#3A2200',
  amber:       '#F5A623',
  amberWarm:   '#E8920A',
  amberDeep:   '#C4720A',
  amberSoft:   'rgba(245,166,35,0.15)',
  amberGlow:   'rgba(245,166,35,0.40)',
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.58)',
};

const CONFETTI_COLORS = [
  '#F5A623', '#FF6B6B', '#34D399',
  '#4ECDC4', '#A78BFA', '#FFD700', '#FFFFFF',
];

const PARTICLE_TYPES = ['circle', 'square', 'rect', 'diamond', 'line'] as const;
type ParticleType = typeof PARTICLE_TYPES[number];

// ═══════════════════════════════════════════════════════════
// PARTICLE GENERATOR (seeded, reproductible)
// ═══════════════════════════════════════════════════════════
interface ParticleData {
  id: number;
  type: ParticleType;
  color: string;
  size: number;
  vx: number;
  vy: number;
  gravity: number;
  rotationSpeed: number;
}

const generateParticles = (count: number): ParticleData[] =>
  Array.from({ length: count }, (_, i) => {
    const seed = i * 137.508;
    return {
      id: i,
      type: PARTICLE_TYPES[i % PARTICLE_TYPES.length],
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 4 + (i % 4) * 2,
      vx: Math.sin(seed) * 180,
      vy: -(250 + (i % 5) * 80),
      gravity: 280 + (i % 3) * 60,
      rotationSpeed: (i % 2 === 0 ? 1 : -1) * (180 + i * 20),
    };
  });

// ═══════════════════════════════════════════════════════════
// SPARKLE DATA — 8 sparkles around the circle
// ═══════════════════════════════════════════════════════════
const SPARKLE_COUNT = 8;
const SPARKLE_RADIUS = 105;
const sparklePositions = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
  const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
  return { x: Math.cos(angle) * SPARKLE_RADIUS, y: Math.sin(angle) * SPARKLE_RADIUS };
});

// ═══════════════════════════════════════════════════════════
// SKIA BACKGROUND — Animated Halos
// ═══════════════════════════════════════════════════════════
const SkiaBackground: React.FC<{ progress: Animated.SharedValue<number> }> = ({ progress }) => {
  const radius1 = useDerivedValue(() => progress.value * 280);
  const radius2 = useDerivedValue(() => Math.max(0, (progress.value - 0.1) * 1.1) * 380);
  const radius3 = useDerivedValue(() => Math.max(0, (progress.value - 0.2) * 1.25) * 160);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Main amber halo */}
      <Circle cx={CX} cy={CY} r={radius1}>
        <RadialGradient
          c={vec(CX, CY)}
          r={280}
          colors={['rgba(245,166,35,0.30)', 'rgba(232,146,10,0.12)', 'rgba(196,114,10,0.05)', 'transparent']}
        />
        <BlurMask blur={70} style="normal" />
      </Circle>

      {/* Secondary wider halo */}
      <Circle cx={CX} cy={CY} r={radius2}>
        <RadialGradient
          c={vec(CX, CY)}
          r={380}
          colors={['rgba(245,166,35,0.10)', 'transparent']}
        />
        <BlurMask blur={100} style="normal" />
      </Circle>

      {/* Coral accent halo */}
      <Circle cx={CX + 40} cy={CY - 20} r={radius3}>
        <RadialGradient
          c={vec(CX + 40, CY - 20)}
          r={160}
          colors={['rgba(255,107,107,0.12)', 'transparent']}
        />
        <BlurMask blur={50} style="normal" />
      </Circle>
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// SKIA RINGS — 3 concentric expanding rings
// ═══════════════════════════════════════════════════════════
const SkiaRings: React.FC<{
  ringRadius: Animated.SharedValue<number>;
  ring2Radius: Animated.SharedValue<number>;
  ring3Radius: Animated.SharedValue<number>;
  fillRadius: Animated.SharedValue<number>;
  rotation2: Animated.SharedValue<number>;
  rotation3: Animated.SharedValue<number>;
}> = ({ ringRadius, ring2Radius, ring3Radius, fillRadius, rotation2, rotation3 }) => {
  const r1 = useDerivedValue(() => ringRadius.value);
  const r2 = useDerivedValue(() => ring2Radius.value);
  const r3 = useDerivedValue(() => ring3Radius.value);
  const rFill = useDerivedValue(() => fillRadius.value);
  const transform2 = useDerivedValue(() => [{ rotate: rotation2.value }]);
  const transform3 = useDerivedValue(() => [{ rotate: rotation3.value }]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Fill circle background */}
      <Circle cx={CX} cy={CY} r={rFill}>
        <RadialGradient
          c={vec(CX, CY)}
          r={68}
          colors={['rgba(245,166,35,0.22)', 'rgba(42,26,0,0.85)']}
        />
      </Circle>
      {/* Fill circle border */}
      <Circle cx={CX} cy={CY} r={rFill} style="stroke" strokeWidth={2} color={C.amber} />

      {/* Ring 1 — solid */}
      <Circle cx={CX} cy={CY} r={r1} style="stroke" strokeWidth={2.5} color={C.amber}>
        <BlurMask blur={4} style="normal" />
      </Circle>

      {/* Ring 2 — dashed, rotating */}
      <Group transform={transform2} origin={vec(CX, CY)}>
        <Circle cx={CX} cy={CY} r={r2} style="stroke" strokeWidth={1.5} color="rgba(245,166,35,0.50)">
          <DashPathEffect intervals={[6, 8]} />
        </Circle>
      </Group>

      {/* Ring 3 — dotted, reverse rotation */}
      <Group transform={transform3} origin={vec(CX, CY)}>
        <Circle cx={CX} cy={CY} r={r3} style="stroke" strokeWidth={1} color="rgba(245,166,35,0.25)">
          <DashPathEffect intervals={[3, 12]} />
        </Circle>
      </Group>
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// SKIA CHECKMARK — Animated path draw
// ═══════════════════════════════════════════════════════════
const checkPathStr = 'M 20 54 L 42 76 L 78 32';
const skCheckPath = Skia.Path.MakeFromSVGString(checkPathStr)!;
const checkPathLength = 120; // approximate length

const SkiaCheckmark: React.FC<{
  progress: Animated.SharedValue<number>;
  glowOp: Animated.SharedValue<number>;
}> = ({ progress, glowOp }) => {
  const dashPhase = useDerivedValue(() => checkPathLength * (1 - progress.value));
  const glow = useDerivedValue(() => glowOp.value);

  // Offset to center the 100x100 path in screen center
  const ox = CX - 50;
  const oy = CY - 50;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Glow layer */}
      <Group transform={[{ translateX: ox }, { translateY: oy }]} opacity={glow}>
        <Path
          path={skCheckPath}
          style="stroke"
          strokeWidth={12}
          strokeCap="round"
          strokeJoin="round"
          color="rgba(255,255,255,0.30)"
        >
          <DashPathEffect intervals={[checkPathLength, checkPathLength]} phase={dashPhase} />
          <BlurMask blur={8} style="normal" />
        </Path>
      </Group>

      {/* Main checkmark */}
      <Group transform={[{ translateX: ox }, { translateY: oy }]}>
        <Path
          path={skCheckPath}
          style="stroke"
          strokeWidth={5}
          strokeCap="round"
          strokeJoin="round"
          color="#FFFFFF"
        >
          <DashPathEffect intervals={[checkPathLength, checkPathLength]} phase={dashPhase} />
        </Path>
      </Group>
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// SKIA PULSE WAVES — concentric expanding rings
// ═══════════════════════════════════════════════════════════
const SkiaPulseWave: React.FC<{
  radius: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
}> = ({ radius, opacity }) => {
  const r = useDerivedValue(() => radius.value);
  const op = useDerivedValue(() => opacity.value);
  const sw = useDerivedValue(() => interpolate(opacity.value, [0, 0.6], [0.5, 1.5]));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={CX} cy={CY} r={r} style="stroke" strokeWidth={sw} color={C.amber} opacity={op}>
        <BlurMask blur={2} style="normal" />
      </Circle>
    </Canvas>
  );
};

// ═══════════════════════════════════════════════════════════
// CONFETTI PIECE — Reanimated View-based
// ═══════════════════════════════════════════════════════════
const ConfettiPiece: React.FC<{
  particle: ParticleData;
  trigger: Animated.SharedValue<number>;
}> = React.memo(({ particle, trigger }) => {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  const dur = 2200 + (particle.id % 5) * 200;
  const drift = particle.vx * 1.8;
  const peak = particle.vy * 0.45;
  const fall = SH * 0.6 + (particle.id % 4) * 60;

  useEffect(() => {
    const d = 1100 + (particle.id % 8) * 40;

    x.value = withDelay(d, withTiming(drift, { duration: dur, easing: Easing.out(Easing.quad) }));
    y.value = withDelay(d, withSequence(
      withTiming(peak, { duration: dur * 0.35, easing: Easing.out(Easing.cubic) }),
      withTiming(fall, { duration: dur * 0.65, easing: Easing.in(Easing.quad) }),
    ));
    rotation.value = withDelay(d, withTiming(particle.rotationSpeed * 3, { duration: dur }));
    opacity.value = withDelay(d, withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(dur * 0.6, withTiming(0, { duration: dur * 0.4 })),
    ));
    scale.value = withDelay(d, withSequence(
      withSpring(1.2, { damping: 8, stiffness: 200 }),
      withTiming(0.6, { duration: dur * 0.7 }),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: CX + x.value - particle.size / 2,
    top: CY + y.value - particle.size / 2,
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const shapeStyle = useMemo(() => {
    const s = particle.size;
    switch (particle.type) {
      case 'circle': return { width: s, height: s, borderRadius: s / 2, backgroundColor: particle.color };
      case 'square': return { width: s, height: s, borderRadius: 2, backgroundColor: particle.color };
      case 'rect': return { width: s * 0.5, height: s * 2, borderRadius: 1.5, backgroundColor: particle.color };
      case 'diamond': return {
        width: s, height: s, borderRadius: 2, backgroundColor: particle.color,
        transform: [{ rotate: '45deg' }],
      };
      case 'line': return { width: 2, height: s * 2.5, borderRadius: 1, backgroundColor: particle.color };
      default: return { width: s, height: s, backgroundColor: particle.color };
    }
  }, [particle]);

  return <Animated.View style={style}><View style={shapeStyle} /></Animated.View>;
});

// ═══════════════════════════════════════════════════════════
// SPARKLE — small star burst around circle
// ═══════════════════════════════════════════════════════════
const Sparkle: React.FC<{
  pos: { x: number; y: number };
  index: number;
}> = React.memo(({ pos, index }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const d = 1100 + index * 50;
    scale.value = withDelay(d, withSequence(
      withSpring(1.3, { damping: 6, stiffness: 180 }),
      withTiming(1, { duration: 200 }),
    ));
    opacity.value = withDelay(d, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(900, withTiming(0, { duration: 400 })),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: CX + pos.x - 6,
    top: CY + pos.y - 6,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 12, color: C.amber }}>✦</Text>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
interface AuthSuccessScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'AuthSuccess'>;
  route: RouteProp<RootStackParamList, 'AuthSuccess'>;
}

export const AuthSuccessScreen: React.FC<AuthSuccessScreenProps> = ({ navigation, route }) => {
  const nextRoute = route.params?.nextRoute ?? 'Main';
  const isLogin = (route.params?.mode ?? 'login') === 'login';
  const isMounted = useRef(true);

  // ─── Particles ───────────────────────────────────────
  const particles = useMemo(() => generateParticles(40), []);

  // ─── Shared values ───────────────────────────────────
  const bgGlow = useSharedValue(0);

  const ringRadius = useSharedValue(0);
  const ring2Radius = useSharedValue(0);
  const ring3Radius = useSharedValue(0);
  const fillRadius = useSharedValue(0);
  const rotation2 = useSharedValue(0);
  const rotation3 = useSharedValue(0);

  const checkProgress = useSharedValue(0);
  const checkGlowOp = useSharedValue(0);
  const flashOp = useSharedValue(0);
  const circleScaleBounce = useSharedValue(1);

  const wave1R = useSharedValue(68);
  const wave1Op = useSharedValue(0);
  const wave2R = useSharedValue(68);
  const wave2Op = useSharedValue(0);
  const wave3R = useSharedValue(68);
  const wave3Op = useSharedValue(0);

  const confettiTrigger = useSharedValue(0);

  const titleOp = useSharedValue(0);
  const titleY = useSharedValue(20);
  const subtitleOp = useSharedValue(0);
  const lineWidth = useSharedValue(0);

  const dotsOp = useSharedValue(0);
  const ctaOp = useSharedValue(0);
  const ctaY = useSharedValue(20);
  const ctaProgress = useSharedValue(1);
  const shimmerX = useSharedValue(-80);

  // ─── Navigation ──────────────────────────────────────
  const navigateNext = useCallback(() => {
    if (isMounted.current) {
      navigation.reset({ index: 0, routes: [{ name: nextRoute as keyof RootStackParamList }] });
    }
  }, [navigation, nextRoute]);

  // ─── Master timeline ─────────────────────────────────
  useEffect(() => {
    // Phase 1 — Ember burst (bg glow)
    bgGlow.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Phase 2 — Ring expansion
    ringRadius.value = withDelay(400, withSpring(72, { damping: 16, stiffness: 140 }));
    ring2Radius.value = withDelay(480, withSpring(96, { damping: 16, stiffness: 140 }));
    ring3Radius.value = withDelay(560, withSpring(118, { damping: 16, stiffness: 140 }));
    fillRadius.value = withDelay(400, withSpring(68, { damping: 14, stiffness: 140 }));

    // Constant ring rotations
    rotation2.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 8000, easing: Easing.linear }), -1,
    );
    rotation3.value = withRepeat(
      withTiming(-Math.PI * 2, { duration: 12000, easing: Easing.linear }), -1,
    );

    // Phase 3 — Checkmark draw
    checkProgress.value = withDelay(650, withTiming(1, {
      duration: 500, easing: Easing.out(Easing.cubic),
    }));
    checkGlowOp.value = withDelay(850, withTiming(0.7, { duration: 400 }));

    // Flash at checkmark completion
    flashOp.value = withDelay(1150, withSequence(
      withTiming(0.45, { duration: 100 }),
      withTiming(0, { duration: 200 }),
    ));
    circleScaleBounce.value = withDelay(1150, withSequence(
      withSpring(1.15, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    ));

    // Phase 4 — Pulse waves (staggered)
    const pulseWave = (r: Animated.SharedValue<number>, op: Animated.SharedValue<number>, delay: number) => {
      r.value = withDelay(delay, withTiming(170, { duration: 800, easing: Easing.out(Easing.cubic) }));
      op.value = withDelay(delay, withSequence(
        withTiming(0.5, { duration: 80 }),
        withTiming(0, { duration: 720, easing: Easing.in(Easing.cubic) }),
      ));
    };
    pulseWave(wave1R, wave1Op, 1150);
    pulseWave(wave2R, wave2Op, 1400);
    pulseWave(wave3R, wave3Op, 1650);

    // Phase 5 — Confetti triggered at 1100ms (done via individual piece delays)
    confettiTrigger.value = withDelay(1100, withTiming(1, { duration: 100 }));

    // Phase 6 — Texts
    titleOp.value = withDelay(1400, withTiming(1, { duration: 400 }));
    titleY.value = withDelay(1400, withSpring(0, { damping: 14, stiffness: 160 }));
    subtitleOp.value = withDelay(1550, withTiming(1, { duration: 300 }));
    lineWidth.value = withDelay(1650, withTiming(80, { duration: 300 }));

    // Phase 7 — Dots + CTA
    dotsOp.value = withDelay(1800, withTiming(1, { duration: 300 }));
    ctaOp.value = withDelay(1800, withTiming(1, { duration: 300 }));
    ctaY.value = withDelay(1800, withSpring(0, { damping: 16, stiffness: 160 }));

    // CTA shimmer (once)
    shimmerX.value = withDelay(2200, withTiming(SW + 80, { duration: 700, easing: Easing.inOut(Easing.ease) }));

    // CTA countdown bar
    ctaProgress.value = withDelay(1800, withTiming(0, {
      duration: isLogin ? 2500 : 3500,
      easing: Easing.linear,
    }));

    // Auto-navigate
    const navDelay = isLogin ? 2500 + 1800 : 3500 + 1800;
    const navTimer = setTimeout(() => {
      if (isMounted.current) { navigateNext(); }
    }, navDelay);

    return () => {
      isMounted.current = false;
      clearTimeout(navTimer);
    };
  }, []);

  // ─── Animated styles ────────────────────────────────
  const flashStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    opacity: flashOp.value,
  }));

  const circleBounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScaleBounce.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOp.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
    opacity: interpolate(lineWidth.value, [0, 40], [0, 1]),
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOp.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOp.value,
    transform: [{ translateY: ctaY.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { rotate: '15deg' }],
  }));

  const countdownStyle = useAnimatedStyle(() => ({
    width: `${ctaProgress.value * 100}%` as any,
  }));

  // ─── Text content ────────────────────────────────────
  const title = isLogin ? 'Content de vous revoir !' : 'Bienvenue chez vous !';
  const subtitle = isLogin ? 'Connexion réussie ✨' : 'Compte créé avec succès 🎉';
  const ctaText = isLogin ? '🚀  Accéder à mon foyer' : '🏠  Configurer mon foyer';

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Couche 0 — Fond vivant Skia */}
      <SkiaBackground progress={bgGlow} />

      {/* Couche 1 — Rings Skia */}
      <Animated.View style={[StyleSheet.absoluteFill, circleBounceStyle]} pointerEvents="none">
        <SkiaRings
          ringRadius={ringRadius}
          ring2Radius={ring2Radius}
          ring3Radius={ring3Radius}
          fillRadius={fillRadius}
          rotation2={rotation2}
          rotation3={rotation3}
        />
      </Animated.View>

      {/* Couche 2 — Checkmark Skia */}
      <SkiaCheckmark progress={checkProgress} glowOp={checkGlowOp} />

      {/* Couche 3 — Pulse waves */}
      <SkiaPulseWave radius={wave1R} opacity={wave1Op} />
      <SkiaPulseWave radius={wave2R} opacity={wave2Op} />
      <SkiaPulseWave radius={wave3R} opacity={wave3Op} />

      {/* Couche 4 — Sparkles */}
      {sparklePositions.map((pos, i) => (
        <Sparkle key={`sparkle-${i}`} pos={pos} index={i} />
      ))}

      {/* Couche 5 — Confetti */}
      {particles.map(p => (
        <ConfettiPiece key={p.id} particle={p} trigger={confettiTrigger} />
      ))}

      {/* Flash overlay */}
      <Animated.View style={flashStyle} pointerEvents="none" />

      {/* Couche 6 — Textes */}
      <View style={styles.textContainer} pointerEvents="none">
        <Animated.Text style={[styles.title, titleStyle]}>
          {title}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          {subtitle}
        </Animated.Text>
        <Animated.View style={[styles.decoLine, lineStyle]}>
          <LinearGradient
            colors={['transparent', C.amber, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, height: 2, borderRadius: 1 }}
          />
        </Animated.View>
      </View>

      {/* Couche 7 — Dots (register only) */}
      {!isLogin && (
        <Animated.View style={[styles.dotsRow, dotsStyle]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={i === 0 ? styles.dotActive : styles.dotInactive}
            />
          ))}
        </Animated.View>
      )}

      {/* Couche 7 — CTA Button */}
      <Animated.View style={[styles.ctaContainer, ctaStyle]}>
        <Pressable
          onPress={navigateNext}
          style={styles.ctaPressable}
        >
          <LinearGradient
            colors={[C.amber, C.amberWarm]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            {/* Shimmer */}
            <Animated.View style={[styles.ctaShimmer, shimmerStyle]} />

            <Text style={styles.ctaText}>{ctaText}</Text>

            {/* Countdown bar */}
            <View style={styles.countdownTrack}>
              <Animated.View style={[styles.countdownBar, countdownStyle]} />
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    top: CY + 100,
    alignItems: 'center',
    width: SW,
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 34,
    color: C.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(245,166,35,0.50)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  decoLine: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  dotsRow: {
    position: 'absolute',
    bottom: SH * 0.22,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.amber,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  ctaContainer: {
    position: 'absolute',
    bottom: SH * 0.10,
    left: 32,
    right: 32,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 18,
    elevation: 12,
  },
  ctaPressable: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  ctaGradient: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaShimmer: {
    position: 'absolute',
    width: 50,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ctaText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 17,
    color: C.bgDeep,
    letterSpacing: 0.2,
  },
  countdownTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
  },
  countdownBar: {
    height: 3,
    backgroundColor: 'rgba(26,14,0,0.30)',
    borderRadius: 1.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
