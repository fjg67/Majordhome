import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@shared/hooks/useTheme';
import { AnimatedCheckbox } from '@shared/components/AnimatedCheckbox';
import { PRIORITY_COLORS, CATEGORY_EMOJIS } from '@shared/theme/colors';
import type { Task, Priority, TaskCategory } from '@appTypes/index';

interface TaskItemProps {
  task: Task;
  assigneeName?: string;
  assigneeColor?: string;
  completedByName?: string;
  completedByColor?: string;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  index?: number;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  assigneeName,
  assigneeColor,
  completedByName,
  completedByColor,
  onToggleComplete,
  index = 0,
}) => {
  const { theme } = useTheme();
  const isCompleted = task.completed_at !== null;
  const strikeWidth = useSharedValue(isCompleted ? 1 : 0);

  const handleToggle = useCallback(
    (checked: boolean) => {
      strikeWidth.value = withTiming(checked ? 1 : 0, { duration: 300 });
      onToggleComplete(task.id, checked);
    },
    [task.id, onToggleComplete, strikeWidth],
  );

  const strikeStyle = useAnimatedStyle(() => ({
    width: `${strikeWidth.value * 100}%`,
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.cardBg }]}
      accessibilityLabel={`Tâche : ${task.title}, priorité ${task.priority}`}
    >
      <AnimatedCheckbox
        checked={isCompleted}
        onToggle={handleToggle}
        color={assigneeColor ?? theme.colors.primary}
        accessibilityLabel={`Marquer ${task.title} comme ${isCompleted ? 'non complétée' : 'complétée'}`}
      />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleWrapper}>
            <Text
              style={[
                theme.typography.bodyMedium,
                {
                  color: isCompleted
                    ? theme.colors.textMuted
                    : theme.colors.text,
                },
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            <Animated.View
              style={[
                styles.strikethrough,
                { backgroundColor: theme.colors.textMuted },
                strikeStyle,
              ]}
            />
          </View>
          <Text style={styles.priorityBadge}>
            {PRIORITY_LABELS[task.priority]}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {CATEGORY_EMOJIS[task.category as TaskCategory] ?? '📋'}{' '}
          </Text>
          {assigneeName ? (
            <View style={styles.assignee}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: assigneeColor ?? theme.colors.primary },
                ]}
              />
              <Text
                style={[
                  theme.typography.caption,
                  { color: assigneeColor ?? theme.colors.textSecondary },
                ]}
              >
                {assigneeName}
              </Text>
            </View>
          ) : null}

          {isCompleted && completedByName ? (
            <Text
              style={[
                theme.typography.caption,
                { color: completedByColor ?? theme.colors.success },
              ]}
            >
              ✓ fait par {completedByName}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  strikethrough: {
    position: 'absolute',
    height: 1.5,
    top: '50%',
    left: 0,
    borderRadius: 1,
  },
  priorityBadge: {
    fontSize: 12,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
