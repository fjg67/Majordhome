import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  entering?: 'down' | 'up' | 'none';
  glowColor?: string;
  accessibilityLabel?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  index = 0,
  entering = 'down',
  glowColor,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark;

  const enteringAnimation = useMemo(() => {
    if (entering === 'none') return undefined;
    const anim =
      entering === 'up'
        ? FadeInUp.delay(index * theme.animation.staggerDelay)
        : FadeInDown.delay(index * theme.animation.staggerDelay);
    return anim.duration(theme.animation.cardEntryDuration).springify();
  }, [entering, index, theme.animation]);

  const cardStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: theme.colors.cardBg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 20,
      shadowColor: glowColor || (isDark ? '#7C6BFF' : '#000000'),
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: glowColor ? 0.15 : (isDark ? 0.08 : 0.05),
      shadowRadius: 16,
      elevation: 4,
    }),
    [isDark, glowColor, theme.colors],
  );

  if (entering === 'none') {
    return (
      <View
        style={[styles.container, cardStyle, style]}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      entering={enteringAnimation}
      style={[styles.container, cardStyle, style]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    overflow: 'hidden',
  },
});
