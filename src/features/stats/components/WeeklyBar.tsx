import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import type { TaskStats } from '@appTypes/index';

interface WeeklyBarProps {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  maxValue?: number;
}

export const WeeklyBar: React.FC<WeeklyBarProps> = ({ data, maxValue }) => {
  const { theme } = useTheme();
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {data.map((item, index) => {
          const height = (item.value / max) * 120;
          return (
            <View key={index} style={styles.barWrapper}>
              <Text
                style={[
                  theme.typography.monoSmall,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {item.value}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(height, 4),
                    backgroundColor: item.color,
                  },
                ]}
              />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted },
                ]}
              >
                {item.label}
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
    gap: 8,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 20,
  },
  barWrapper: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bar: {
    width: 28,
    borderRadius: 8,
    minHeight: 4,
  },
});
