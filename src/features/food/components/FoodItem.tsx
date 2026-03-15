import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@shared/hooks/useTheme';
import { ExpiryBadge } from './ExpiryBadge';
import { CATEGORY_EMOJIS, EXPIRY_COLORS } from '@shared/theme/colors';
import { getExpiryStatus, getDaysUntilExpiry } from '../hooks/useFoodTracker';
import type { FoodItem as FoodItemType, FoodCategory } from '@appTypes/index';

interface FoodItemProps {
  item: FoodItemType;
  index?: number;
}

export const FoodItem: React.FC<FoodItemProps> = React.memo(({ item, index = 0 }) => {
  const { theme } = useTheme();
  const status = getExpiryStatus(item.expiry_date);
  const daysLeft = getDaysUntilExpiry(item.expiry_date);
  const categoryEmoji =
    CATEGORY_EMOJIS[item.category as FoodCategory] ?? '📦';

  return (
    <Animated.View entering={FadeInDown.delay(index * 25).springify()}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardBg,
            borderColor:
              status === 'expired'
                ? EXPIRY_COLORS.expired + '40'
                : theme.colors.cardBorder,
            borderWidth: 1,
          },
        ]}
        accessibilityLabel={`${item.name}, ${status === 'expired' ? 'expiré' : `expire dans ${daysLeft} jours`}`}
      >
        <Text style={styles.emoji}>{categoryEmoji}</Text>
        <View style={styles.content}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View style={styles.meta}>
            {item.quantity ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted },
                ]}
              >
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        <ExpiryBadge status={status} daysLeft={daysLeft} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
