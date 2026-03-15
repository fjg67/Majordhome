import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface UserAvatarProps {
  emoji: string;
  color: string;
  size?: number;
  name?: string;
  showName?: boolean;
  accessibilityLabel?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  emoji,
  color,
  size = 36,
  name,
  showName = false,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={styles.wrapper}
      accessibilityLabel={accessibilityLabel ?? `Avatar de ${name ?? 'membre'}`}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color + '22',
            borderColor: color + '55',
          },
        ]}
      >
        <Text style={[styles.emoji, { fontSize: size * 0.5 }]}>{emoji}</Text>
      </View>
      {showName && name ? (
        <Text
          style={[
            styles.name,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emoji: {
    textAlign: 'center',
  },
  name: {
    maxWidth: 60,
    textAlign: 'center',
  },
});
