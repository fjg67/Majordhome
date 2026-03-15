import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import { EXPIRY_COLORS } from '@shared/theme/colors';
import type { ExpiryStatus } from '@appTypes/index';

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  daysLeft: number;
}

const STATUS_CONFIG: Record<ExpiryStatus, { label: string; emoji: string }> = {
  expired: { label: 'Expiré', emoji: '🔴' },
  urgent: { label: 'Urgent', emoji: '🟠' },
  warning: { label: 'À surveiller', emoji: '🟡' },
  ok: { label: 'OK', emoji: '🟢' },
};

export const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({
  status,
  daysLeft,
}) => {
  const { theme } = useTheme();
  const config = STATUS_CONFIG[status];
  const color = EXPIRY_COLORS[status];

  const label =
    daysLeft < 0
      ? `Expiré depuis ${Math.abs(daysLeft)}j`
      : daysLeft === 0
      ? "Expire aujourd'hui"
      : daysLeft === 1
      ? 'Expire demain'
      : `${daysLeft} jours`;

  return (
    <View
      style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}
      accessibilityLabel={`${config.label} : ${label}`}
    >
      <Text style={styles.emoji}>{config.emoji}</Text>
      <Text
        style={[theme.typography.caption, { color, fontWeight: '600' }]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 10,
  },
});
