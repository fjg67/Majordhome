import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@shared/hooks/useTheme';
import { AnimatedCheckbox } from '@shared/components/AnimatedCheckbox';
import type { ShoppingItem as ShoppingItemType } from '@appTypes/index';

interface ShoppingItemProps {
  item: ShoppingItemType;
  adderColor?: string;
  checkedByName?: string;
  onToggle: (itemId: string, checked: boolean) => void;
  index?: number;
}

export const ShoppingItem: React.FC<ShoppingItemProps> = React.memo(({
  item,
  adderColor,
  checkedByName,
  onToggle,
  index = 0,
}) => {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(index * 25).springify()}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
            opacity: item.checked ? 0.6 : 1,
          },
        ]}
        accessibilityLabel={`Article ${item.name}${item.checked ? ', coché' : ''}`}
      >
        <AnimatedCheckbox
          checked={item.checked}
          onToggle={(checked) => onToggle(item.id, checked)}
          color={adderColor ?? theme.colors.primary}
        />
        <View style={styles.content}>
          <Text
            style={[
              theme.typography.bodyMedium,
              {
                color: item.checked
                  ? theme.colors.textMuted
                  : theme.colors.text,
                textDecorationLine: item.checked ? 'line-through' : 'none',
              },
            ]}
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
              </Text>
            ) : null}
            {item.checked && checkedByName ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.success },
                ]}
              >
                ✓ {checkedByName}
              </Text>
            ) : null}
          </View>
        </View>
        {adderColor ? (
          <View
            style={[styles.adderDot, { backgroundColor: adderColor }]}
          />
        ) : null}
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
    borderWidth: 1,
    gap: 12,
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
  adderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
