import React, { useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;
  rightColor?: string;
  accessibilityLabel?: string;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = '✓',
  rightLabel = '🗑',
  leftColor,
  rightColor,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const translateX = useSharedValue(0);

  const activeLeftColor = leftColor ?? theme.colors.success;
  const activeRightColor = rightColor ?? theme.colors.error;

  const handleSwipeLeft = useCallback(() => {
    onSwipeLeft?.();
  }, [onSwipeLeft]);

  const handleSwipeRight = useCallback(() => {
    onSwipeRight?.();
  }, [onSwipeRight]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const maxLeft = onSwipeRight ? -SCREEN_WIDTH * 0.4 : 0;
      const maxRight = onSwipeLeft ? SCREEN_WIDTH * 0.4 : 0;
      translateX.value = Math.max(maxLeft, Math.min(maxRight, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD && onSwipeLeft) {
        runOnJS(handleSwipeLeft)();
      } else if (event.translationX < -SWIPE_THRESHOLD && onSwipeRight) {
        runOnJS(handleSwipeRight)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftBgStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const rightBgStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel}>
      {/* Left background (swipe right = complete) */}
      <Animated.View
        style={[
          styles.background,
          styles.leftBg,
          { backgroundColor: activeLeftColor },
          leftBgStyle,
        ]}
      >
        <Text style={styles.bgLabel}>{leftLabel}</Text>
      </Animated.View>

      {/* Right background (swipe left = delete) */}
      <Animated.View
        style={[
          styles.background,
          styles.rightBg,
          { backgroundColor: activeRightColor },
          rightBgStyle,
        ]}
      >
        <Text style={styles.bgLabel}>{rightLabel}</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedRowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    borderRadius: 20,
  },
  leftBg: {
    alignItems: 'flex-start',
    paddingLeft: 24,
  },
  rightBg: {
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  bgLabel: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
