import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '@shared/components/GlassCard';
import { useTheme } from '@shared/hooks/useTheme';
import type { CalendarEvent } from '@appTypes/index';

interface EventCardProps {
  event: CalendarEvent;
  creatorName?: string;
  creatorColor?: string;
  onPress?: () => void;
  index?: number;
}

export const EventCard: React.FC<EventCardProps> = React.memo(({
  event,
  creatorName,
  creatorColor,
  onPress,
  index = 0,
}) => {
  const { theme } = useTheme();
  const eventColor = event.color ?? creatorColor ?? theme.colors.accent;

  const time = event.is_all_day
    ? 'Toute la journée'
    : new Date(event.start_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

  const dateStr = new Date(event.start_at).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <Pressable onPress={onPress} accessibilityLabel={`Événement ${event.title}`}>
        <GlassCard
          glowColor={eventColor}
          entering="none"
          style={styles.card}
        >
          <View style={styles.row}>
            <View style={[styles.colorStrip, { backgroundColor: eventColor }]} />
            <View style={styles.content}>
              <View style={styles.topRow}>
                <Text
                  style={[theme.typography.caption, { color: eventColor }]}
                >
                  {dateStr} · {time}
                </Text>
                {event.recurrence !== 'none' ? (
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    🔁 {event.recurrence}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  theme.typography.bodyMedium,
                  { color: theme.colors.text },
                ]}
                numberOfLines={1}
              >
                {event.title}
              </Text>
              {event.description ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {event.description}
                </Text>
              ) : null}
              {creatorName ? (
                <View style={styles.creator}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: creatorColor ?? theme.colors.accent },
                    ]}
                  />
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {creatorName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  colorStrip: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
