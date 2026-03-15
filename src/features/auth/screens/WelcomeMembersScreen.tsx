import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
  FadeIn,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '@shared/hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@app/navigation/types';

const { width: SW, height: SH } = Dimensions.get('window');

interface WelcomeMembersScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'WelcomeMembers'>;
}

// ─── Floating orb configs ────────────────────────────────
const ORBS = [
  { x: SW * 0.15, y: SH * 0.12, size: 120, color: 'rgba(124,107,255,0.15)', delay: 0 },
  { x: SW * 0.75, y: SH * 0.08, size: 90, color: 'rgba(46,212,122,0.12)', delay: 200 },
  { x: SW * 0.85, y: SH * 0.35, size: 70, color: 'rgba(255,190,11,0.10)', delay: 400 },
  { x: SW * 0.1, y: SH * 0.7, size: 100, color: 'rgba(167,139,250,0.12)', delay: 300 },
  { x: SW * 0.7, y: SH * 0.75, size: 80, color: 'rgba(255,107,107,0.10)', delay: 500 },
];

// ─── Sparkle component ───────────────────────────────────
const Sparkle: React.FC<{ x: number; y: number; delay: number; size: number }> = ({
  x, y, delay, size,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSequence(
      withSpring(1, { damping: 6, stiffness: 120 }),
      withDelay(1500, withTiming(0, { duration: 600 })),
    ));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(1500, withTiming(0, { duration: 600 })),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    width: size,
    height: size,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: size, textAlign: 'center' }}>✦</Text>
    </Animated.View>
  );
};

// ─── Floating orb ────────────────────────────────────────
const FloatingOrb: React.FC<{
  x: number; y: number; size: number; color: string; delay: number;
}> = ({ x, y, size, color, delay }) => {
  const scale = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 60 }));
    translateY.value = withDelay(delay + 500, withSequence(
      withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={style} />;
};

// ─── Member avatar bubble ────────────────────────────────
const MemberBubble: React.FC<{
  emoji: string;
  name: string;
  color: string;
  index: number;
  total: number;
}> = ({ emoji, name, color, index, total }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);
  const floatY = useSharedValue(0);

  const delay = 800 + index * 200;

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 100 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 12, stiffness: 80 }));

    // Gentle floating after entrance
    floatY.value = withDelay(delay + 600, withSequence(
      withTiming(-6, { duration: 1500 + index * 200, easing: Easing.inOut(Easing.ease) }),
      withTiming(6, { duration: 1500 + index * 200, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value + floatY.value },
    ],
  }));

  // Arrange in a nice layout
  const isEven = total % 2 === 0;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const itemsInRow = Math.min(3, total - row * 3);
  const rowOffset = (3 - itemsInRow) * 55;

  return (
    <Animated.View style={[styles.memberBubble, style, { marginLeft: col === 0 ? rowOffset : 0 }]}>
      {/* Glow ring */}
      <View style={[styles.glowRing, { borderColor: color + '40' }]}>
        <LinearGradient
          colors={[color + '30', color + '10', 'transparent']}
          style={styles.avatarGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.avatarCircle, { backgroundColor: color + '20', borderColor: color + '60' }]}>
            <Text style={styles.avatarEmoji}>{emoji || '👤'}</Text>
          </View>
        </LinearGradient>
      </View>
      <Text style={styles.memberName} numberOfLines={1}>{name || 'Membre'}</Text>
    </Animated.View>
  );
};

// ─── Main screen ─────────────────────────────────────────
export const WelcomeMembersScreen: React.FC<WelcomeMembersScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const members = useAuthStore((s) => s.members);
  const household = useAuthStore((s) => s.household);

  // Animations
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(30);
  const householdOpacity = useSharedValue(0);
  const householdScale = useSharedValue(0.8);
  const subtitleOpacity = useSharedValue(0);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    // Phase 1: Title
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    titleY.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 90 }));

    // Phase 2: Household name badge
    householdOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    householdScale.value = withDelay(500, withSpring(1, { damping: 10, stiffness: 100 }));

    // Phase 3: Subtitle (after members appear)
    const membersDelay = 800 + members.length * 200 + 400;
    subtitleOpacity.value = withDelay(membersDelay, withTiming(1, { duration: 500 }));

    // Phase 4: Fade out and navigate
    const totalDuration = membersDelay + 2500;
    fadeOut.value = withDelay(totalDuration, withTiming(0, { duration: 500 }));

    const timer = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }, totalDuration + 600);

    return () => clearTimeout(timer);
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const householdStyle = useAnimatedStyle(() => ({
    opacity: householdOpacity.value,
    transform: [{ scale: householdScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
  }));

  return (
    <Animated.View style={[styles.root, containerStyle]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={isDark
          ? ['#0F0F1A', '#1A1040', '#0F0F1A']
          : ['#EDE8FF', '#D4C8FF', '#F4F5FA']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating orbs */}
      {ORBS.map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}

      {/* Sparkles */}
      <Sparkle x={SW * 0.12} y={SH * 0.18} delay={1200} size={14} />
      <Sparkle x={SW * 0.82} y={SH * 0.15} delay={1500} size={10} />
      <Sparkle x={SW * 0.9} y={SH * 0.55} delay={1800} size={12} />
      <Sparkle x={SW * 0.05} y={SH * 0.6} delay={2000} size={11} />

      <View style={styles.content}>
        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={[styles.welcomeEmoji]}>🏠</Text>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
            Bienvenue dans
          </Text>
        </Animated.View>

        {/* Household name badge */}
        <Animated.View style={[styles.householdBadge, householdStyle]}>
          <LinearGradient
            colors={['#6C5CE7', '#A78BFA']}
            style={styles.badgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.householdName}>
              {household?.name || 'Votre foyer'}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Members */}
        <View style={styles.membersContainer}>
          <Animated.Text style={[styles.membersLabel, subtitleStyle, { color: isDark ? '#A0A0C0' : '#6B7280' }]}>
            {members.length > 1
              ? `${members.length} membres vous accompagnent`
              : 'Votre espace personnel'}
          </Animated.Text>

          <View style={styles.membersGrid}>
            {members.map((m, i) => (
              <MemberBubble
                key={m.id}
                emoji={m.avatar_emoji}
                name={m.display_name}
                color={m.color || '#7C6BFF'}
                index={i}
                total={members.length}
              />
            ))}
          </View>
        </View>

        {/* Bottom tagline */}
        <Animated.View style={[styles.taglineContainer, subtitleStyle]}>
          <Text style={[styles.tagline, { color: isDark ? '#7C6BFF' : '#6C5CE7' }]}>
            Tout est prêt ✨
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  welcomeEmoji: {
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  householdBadge: {
    marginTop: 12,
    marginBottom: 40,
    borderRadius: 20,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  badgeGradient: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
  },
  householdName: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  membersContainer: {
    alignItems: 'center',
    width: '100%',
  },
  membersLabel: {
    fontSize: 15,
    fontFamily: 'DMSans-Medium',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  memberBubble: {
    alignItems: 'center',
    width: 100,
    marginBottom: 12,
  },
  glowRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 30,
  },
  memberName: {
    fontSize: 13,
    fontFamily: 'DMSans-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 90,
  },
  taglineContainer: {
    marginTop: 40,
  },
  tagline: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    letterSpacing: 0.5,
  },
});
