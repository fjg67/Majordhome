import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Dark Amber palette
const P = {
  bgDeep: '#1A0E00',
  bgMid: '#261400',
  bgSurface: '#2E1A00',
  amber: '#F5A623',
  amberWarm: '#E8920A',
  amberDeep: '#C4720A',
  amberGlow: 'rgba(245, 166, 35, 0.30)',
  amberSoft: 'rgba(245, 166, 35, 0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  textMuted: 'rgba(255, 255, 255, 0.35)',
};

// Floating orb component
const FloatingOrb = ({ delay, size, x, y, color }: {
  delay: number; size: number; x: number; y: number; color: string;
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 4000 + delay * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay: delay * 200 }),
        Animated.timing(anim, { toValue: 0, duration: 4000 + delay * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.35, 0.15] });

  return (
    <Animated.View style={[styles.orb, {
      width: size, height: size, borderRadius: size / 2,
      left: x, top: y, backgroundColor: color,
      transform: [{ translateY }, { scale }], opacity,
    }]} />
  );
};

export const NoInternetScreen: React.FC = () => {
  // Main icon pulse
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // Ring expand
  const ringAnim = useRef(new Animated.Value(0)).current;
  // Fade entrance
  const fadeIn = useRef(new Animated.Value(0)).current;
  // Scanning line
  const scanAnim = useRef(new Animated.Value(0)).current;
  // Dots animation
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance fade
    Animated.timing(fadeIn, {
      toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // Icon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Expanding ring
    Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1, duration: 2500, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ).start();

    // Scanning line
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
      }),
    ).start();

    // Loading dots stagger
    const dotAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.delay(600 - delay),
        ]),
      );
    dotAnim(dot1, 0).start();
    dotAnim(dot2, 200).start();
    dotAnim(dot3, 400).start();
  }, []);

  const iconScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const iconGlow = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 0.15, 0] });

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={P.bgDeep} />

      {/* Background orbs */}
      <FloatingOrb delay={0} size={280} x={-80} y={-60} color={P.amberDeep} />
      <FloatingOrb delay={1} size={200} x={width - 100} y={height * 0.3} color={P.amber} />
      <FloatingOrb delay={2} size={160} x={width * 0.3} y={height * 0.7} color={P.amberWarm} />
      <FloatingOrb delay={3} size={120} x={-30} y={height * 0.55} color={P.amberDeep} />

      {/* Grid pattern overlay */}
      <View style={styles.gridOverlay} />

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>

        {/* Icon container */}
        <View style={styles.iconArea}>
          {/* Expanding ring */}
          <Animated.View style={[styles.expandRing, {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }]} />

          {/* Outer glow ring */}
          <Animated.View style={[styles.outerRing, {
            opacity: iconGlow,
            transform: [{ scale: iconScale }],
          }]} />

          {/* Middle ring */}
          <Animated.View style={[styles.middleRing, {
            transform: [{ scale: iconScale }],
          }]} />

          {/* Icon circle */}
          <Animated.View style={[styles.iconCircle, {
            transform: [{ scale: iconScale }],
          }]}>
            {/* Scan line */}
            <Animated.View style={[styles.scanLine, {
              transform: [{ translateY: scanY }],
            }]} />

            {/* WiFi off icon — built with shapes */}
            <View style={styles.wifiIcon}>
              {/* Arc 3 (outermost) */}
              <View style={[styles.wifiArc, styles.wifiArc3]} />
              {/* Arc 2 */}
              <View style={[styles.wifiArc, styles.wifiArc2]} />
              {/* Arc 1 */}
              <View style={[styles.wifiArc, styles.wifiArc1]} />
              {/* Dot */}
              <View style={styles.wifiDot} />
              {/* Slash line */}
              <View style={styles.wifiSlash} />
            </View>
          </Animated.View>
        </View>

        {/* Badge */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>HORS LIGNE</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Connexion{'\n'}
          <Text style={styles.titleAmber}>interrompue</Text>
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          MajordHome nécessite une connexion internet{'\n'}
          pour synchroniser votre foyer en temps réel.
        </Text>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>📡</Text>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Recherche du réseau</Text>
              <Text style={styles.statusDesc}>La connexion sera restaurée automatiquement</Text>
            </View>
            <View style={styles.dotsRow}>
              <Animated.View style={[styles.loadingDot, { opacity: dot1.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ scale: dot1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
              <Animated.View style={[styles.loadingDot, { opacity: dot2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ scale: dot2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
              <Animated.View style={[styles.loadingDot, { opacity: dot3.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ scale: dot3.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
            </View>
          </View>

          {/* Divider */}
          <View style={styles.statusDivider} />

          {/* Tips */}
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>
              Vérifiez votre Wi-Fi ou vos données mobiles
            </Text>
          </View>
        </View>

        {/* Bottom branding */}
        <View style={styles.branding}>
          <View style={styles.brandingLine} />
          <Text style={styles.brandingText}>MajordHome</Text>
          <View style={styles.brandingLine} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.bgDeep,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    borderWidth: 0.5,
    borderColor: P.amber,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },

  // === Icon Area ===
  iconArea: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  expandRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: P.amber,
  },
  outerRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.15)',
    backgroundColor: 'rgba(245, 166, 35, 0.04)',
  },
  middleRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.12)',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(245, 166, 35, 0.25)',
  },

  // === WiFi Icon ===
  wifiIcon: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  wifiArc: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(245, 166, 35, 0.45)',
    borderLeftColor: 'rgba(245, 166, 35, 0.45)',
    borderRightColor: 'rgba(245, 166, 35, 0.45)',
  },
  wifiArc3: {
    width: 48,
    height: 48,
    borderRadius: 24,
    top: -8,
  },
  wifiArc2: {
    width: 34,
    height: 34,
    borderRadius: 17,
    top: -1,
  },
  wifiArc1: {
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 6,
  },
  wifiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: P.amber,
    marginBottom: 2,
  },
  wifiSlash: {
    position: 'absolute',
    width: 56,
    height: 2.5,
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
    top: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },

  // === Badge ===
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.30)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B6B',
  },
  badgeText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#FF6B6B',
  },

  // === Title ===
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: P.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  titleAmber: {
    color: P.amber,
  },

  // === Subtitle ===
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    lineHeight: 24,
    color: P.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },

  // === Status Card ===
  statusCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.18)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 48,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusIcon: {
    fontSize: 28,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 15,
    color: P.textPrimary,
    marginBottom: 2,
  },
  statusDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: P.textMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: P.amber,
  },
  statusDivider: {
    height: 1,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    marginVertical: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: P.textSecondary,
  },

  // === Branding ===
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandingLine: {
    height: 1,
    width: 32,
    backgroundColor: 'rgba(245, 166, 35, 0.20)',
  },
  brandingText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13,
    letterSpacing: 1,
    color: P.textMuted,
  },
});
