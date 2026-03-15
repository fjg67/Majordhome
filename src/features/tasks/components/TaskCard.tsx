import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@shared/hooks/useTheme';
import { AnimatedCheckbox } from '@shared/components/AnimatedCheckbox';
import { PRIORITY_COLORS, CATEGORY_EMOJIS } from '@shared/theme/colors';
import type { Task, Priority, TaskCategory } from '@appTypes/index';

interface TaskCardProps {
  task: Task;
  assigneeName?: string;
  assigneeColor?: string;
  onToggle: (taskId: string, completed: boolean) => void;
  onPress?: () => void;
  index?: number;
}

const PRIORITY_EMOJI: Record<Priority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

export const TaskCard: React.FC<TaskCardProps> = React.memo(({
  task,
  assigneeName,
  assigneeColor,
  onToggle,
  onPress,
  index = 0,
}) => {
  const { theme } = useTheme();
  const isCompleted = task.completed_at !== null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <Pressable
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardBg,
            borderColor: theme.colors.cardBorder,
          },
        ]}
        accessibilityLabel={`Tâche ${task.title}`}
        accessibilityRole="button"
      >
        <AnimatedCheckbox
          checked={isCompleted}
          onToggle={(checked) => onToggle(task.id, checked)}
          color={assigneeColor ?? theme.colors.primary}
        />

        <View style={styles.content}>
          <Text
            style={[
              theme.typography.bodyMedium,
              {
                color: isCompleted ? theme.colors.textMuted : theme.colors.text,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>

          <View style={styles.badges}>
            <Text style={styles.badge}>
              {PRIORITY_EMOJI[task.priority]}
            </Text>
            <Text style={styles.badge}>
              {CATEGORY_EMOJIS[task.category as TaskCategory] ?? '📋'}
            </Text>
            {assigneeName ? (
              <View style={styles.assignee}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: assigneeColor ?? theme.colors.textMuted },
                  ]}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {assigneeName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted },
          ]}
        >
          {task.due_date}
        </Text>
      </Pressable>
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
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    fontSize: 12,
  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
