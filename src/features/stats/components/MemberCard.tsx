import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@shared/components/GlassCard';
import { UserAvatar } from '@shared/components/UserAvatar';
import { useTheme } from '@shared/hooks/useTheme';

interface MemberCardProps {
  displayName: string;
  color: string;
  emoji: string;
  completedCount: number;
  totalCount: number;
  streak: number;
  trend: 'up' | 'down' | 'stable';
  index?: number;
}

const TREND_ICONS: Record<string, string> = {
  up: '📈',
  down: '📉',
  stable: '➡️',
};

export const MemberCard: React.FC<MemberCardProps> = ({
  displayName,
  color,
  emoji,
  completedCount,
  totalCount,
  streak,
  trend,
  index = 0,
}) => {
  const { theme } = useTheme();
  const percentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <GlassCard
      index={index}
      glowColor={color}
      style={styles.card}
      accessibilityLabel={`Statistiques de ${displayName}`}
    >
      <View style={styles.row}>
        <UserAvatar emoji={emoji} color={color} size={44} />
        <View style={styles.info}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text }]}
          >
            {displayName}
          </Text>
          <View style={styles.statsRow}>
            <Text
              style={[
                theme.typography.monoSmall,
                { color },
              ]}
            >
              {completedCount}/{totalCount} ({percentage}%)
            </Text>
            <Text style={styles.trend}>{TREND_ICONS[trend]}</Text>
          </View>
        </View>
        <View style={styles.streakBox}>
          <Text style={[styles.streakNumber, { color }]}>{streak}</Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted },
            ]}
          >
            🔥 jours
          </Text>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trend: {
    fontSize: 14,
  },
  streakBox: {
    alignItems: 'center',
    gap: 2,
  },
  streakNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
});
