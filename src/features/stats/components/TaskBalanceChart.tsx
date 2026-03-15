import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import type { TaskStats } from '@appTypes/index';

interface TaskBalanceChartProps {
  stats: TaskStats[];
}

export const TaskBalanceChart: React.FC<TaskBalanceChartProps> = ({
  stats,
}) => {
  const { theme } = useTheme();
  const maxCount = Math.max(...stats.map((s) => s.total_count), 1);

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.h4, { color: theme.colors.text }]}>
        Balance des tâches
      </Text>
      <View style={styles.chart}>
        {stats.map((stat) => {
          const completedWidth =
            (stat.completed_count / maxCount) * 100;
          const totalWidth = (stat.total_count / maxCount) * 100;

          return (
            <View key={stat.user_id} style={styles.barRow}>
              <View style={styles.label}>
                <View
                  style={[styles.dot, { backgroundColor: stat.color }]}
                />
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {stat.display_name}
                </Text>
              </View>
              <View style={styles.barContainer}>
                {/* Total bar (background) */}
                <View
                  style={[
                    styles.barBg,
                    {
                      width: `${totalWidth}%`,
                      backgroundColor: stat.color + '20',
                    },
                  ]}
                />
                {/* Completed bar (foreground) */}
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${completedWidth}%`,
                      backgroundColor: stat.color,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  theme.typography.monoSmall,
                  { color: theme.colors.textSecondary, minWidth: 50 },
                ]}
              >
                {stat.completed_count}/{stat.total_count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  chart: {
    gap: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barContainer: {
    flex: 1,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  barBg: {
    position: 'absolute',
    height: '100%',
    borderRadius: 10,
  },
  bar: {
    position: 'absolute',
    height: '100%',
    borderRadius: 10,
  },
});
