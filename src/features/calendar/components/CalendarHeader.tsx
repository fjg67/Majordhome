import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';

interface CalendarHeaderProps {
  currentMonth: string; // format: "2026-03"
  onPrevious: () => void;
  onNext: () => void;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentMonth,
  onPrevious,
  onNext,
}) => {
  const { theme } = useTheme();

  const title = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }, [currentMonth]);

  return (
    <View style={styles.container}>
      <Text
        style={[styles.arrow, { color: theme.colors.textSecondary }]}
        onPress={onPrevious}
        accessibilityLabel="Mois précédent"
        accessibilityRole="button"
      >
        ‹
      </Text>
      <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text
        style={[styles.arrow, { color: theme.colors.textSecondary }]}
        onPress={onNext}
        accessibilityLabel="Mois suivant"
        accessibilityRole="button"
      >
        ›
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  arrow: {
    fontSize: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
