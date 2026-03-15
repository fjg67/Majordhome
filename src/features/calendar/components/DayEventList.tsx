import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import { GlassCard } from '@shared/components/GlassCard';
import type { CalendarEvent } from '@appTypes/index';

interface DayEventListProps {
  events: CalendarEvent[];
}

export const DayEventList: React.FC<DayEventListProps> = ({ events }) => {
  const { theme } = useTheme();

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>
          Aucun événement ce jour
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      initialNumToRender={5}
      renderItem={({ item, index }) => {
        const eventColor = item.color ?? theme.colors.accent;
        const time = new Date(item.start_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <GlassCard
            index={index}
            glowColor={eventColor}
            style={styles.card}
            accessibilityLabel={`Événement : ${item.title} à ${time}`}
          >
            <View style={styles.row}>
              <View
                style={[styles.colorBar, { backgroundColor: eventColor }]}
              />
              <View style={styles.content}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: eventColor },
                  ]}
                >
                  {item.is_all_day ? 'Toute la journée' : time}
                </Text>
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.description ? (
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </GlassCard>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  card: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
});
