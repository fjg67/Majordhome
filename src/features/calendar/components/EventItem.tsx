import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@shared/components/GlassCard';
import { useTheme } from '@shared/hooks/useTheme';
import type { CalendarEvent } from '@appTypes/index';

interface EventItemProps {
  event: CalendarEvent;
  creatorName?: string;
  creatorColor?: string;
  index?: number;
}

export const EventItem: React.FC<EventItemProps> = ({
  event,
  creatorName,
  creatorColor,
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

  return (
    <GlassCard
      index={index}
      glowColor={eventColor}
      style={styles.card}
      accessibilityLabel={`Événement : ${event.title}`}
    >
      <View style={styles.row}>
        <View style={[styles.indicator, { backgroundColor: eventColor }]} />
        <View style={styles.content}>
          <Text style={[theme.typography.caption, { color: eventColor }]}>
            {time}
          </Text>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          {creatorName ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}
            >
              par {creatorName}
            </Text>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  indicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
});
