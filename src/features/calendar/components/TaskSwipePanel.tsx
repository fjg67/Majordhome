import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import { DayEventList } from './DayEventList';
import { TaskItem } from './TaskItem';
import type { Task, CalendarEvent } from '@appTypes/index';

interface TaskSwipePanelProps {
  tasks: Task[];
  events: CalendarEvent[];
  onToggleTask: (taskId: string, completed: boolean) => void;
}

export const TaskSwipePanel: React.FC<TaskSwipePanelProps> = ({
  tasks,
  events,
  onToggleTask,
}) => {
  const { theme } = useTheme();
  const [activePage, setActivePage] = useState(0);

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.indicatorRow}>
        <View style={styles.tabs}>
          <Pressable onPress={() => setActivePage(0)}>
            <Text
              style={[
                theme.typography.caption,
                {
                  color:
                    activePage === 0
                      ? theme.colors.primary
                      : theme.colors.textMuted,
                  fontWeight: activePage === 0 ? '700' : '400',
                },
              ]}
            >
              {'\u{1F4C5}'} {'\u00c9'}v{'\u00e9'}nements ({events.length})
            </Text>
          </Pressable>
          <Pressable onPress={() => setActivePage(1)}>
            <Text
              style={[
                theme.typography.caption,
                {
                  color:
                    activePage === 1
                      ? theme.colors.primary
                      : theme.colors.textMuted,
                  fontWeight: activePage === 1 ? '700' : '400',
                },
              ]}
            >
              {'\u2705'} T{'\u00e2'}ches ({tasks.length})
            </Text>
          </Pressable>
        </View>
        <View style={[styles.indicatorTrack, { backgroundColor: theme.colors.separator }]}>
          <View
            style={[
              styles.indicatorDot,
              {
                backgroundColor: theme.colors.primary,
                left: activePage === 0 ? 0 : 80,
              },
            ]}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        {activePage === 0 ? (
          <DayEventList events={events} />
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.textMuted },
              ]}
            >
              Aucune t{'\u00e2'}che ce jour
            </Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {tasks.map((task, index) => (
              <TaskItem
                key={task.id}
                task={task}
                index={index}
                onToggleComplete={onToggleTask}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicatorRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  indicatorTrack: {
    height: 3,
    borderRadius: 1.5,
    width: 160,
    alignSelf: 'center',
    position: 'relative',
  },
  indicatorDot: {
    height: 3,
    width: 80,
    borderRadius: 1.5,
    position: 'absolute',
  },
  page: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  taskList: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 16,
  },
});
