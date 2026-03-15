import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onToggle,
  color,
  size = 24,
  accessibilityLabel = 'Checkbox',
}) => {
  const { theme } = useTheme();
  const progress = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);

  const activeColor = color ?? theme.colors.primary;

  const handlePress = useCallback(() => {
    const newValue = !checked;
    scale.value = withSpring(0.85, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    progress.value = withTiming(newValue ? 1 : 0, { duration: 250 });
    onToggle(newValue);
  }, [checked, onToggle, progress, scale]);

  const animatedBoxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['transparent', activeColor],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.textMuted, activeColor],
    ),
  }));

  const animatedCheckStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
        },
        animatedBoxStyle,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Animated.Text
        style={[
          styles.check,
          { fontSize: size * 0.6 },
          animatedCheckStyle,
        ]}
      >
        ✓
      </Animated.Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
