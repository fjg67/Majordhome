import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';

import { HomeScreen } from '@features/calendar/screens/HomeScreen';
import { TaskListScreen } from '@features/tasks/screens/TaskListScreen';
import { EventListScreen } from '@features/events/screens/EventListScreen';
import { FoodTrackerScreen } from '@features/food/screens/FoodTrackerScreen';
import { ShoppingListScreen } from '@features/shopping/screens/ShoppingListScreen';
import { StatsScreen } from '@features/stats/screens/StatsScreen';
import { SettingsScreen } from '@features/settings/screens/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── Warm chocolate palette ──────────────────────────────
const C = {
  barBg: '#1E0F08',
  barBorder: 'rgba(255,179,71,0.12)',
  accent: '#FFB347',
  accentGlow: 'rgba(255,179,71,0.20)',
  cream: '#FFF5E6',
  creamMuted: 'rgba(255,245,230,0.30)',
};

interface TabDef {
  icon: string;
  label: string;
}

const TABS: Record<keyof MainTabParamList, TabDef> = {
  Calendar: { icon: '\u{1F4C5}', label: 'Accueil' },
  Tasks: { icon: '\u2705', label: 'Tâches' },
  Events: { icon: '\u{1F389}', label: 'Événements' },
  Food: { icon: '\u{1F951}', label: 'Aliments' },
  Shopping: { icon: '\u{1F6D2}', label: 'Courses' },
  Stats: { icon: '\u{1F4CA}', label: 'Stats' },
  Settings: { icon: '\u2699\uFE0F', label: 'Réglages' },
};

const TabIcon: React.FC<{ name: keyof MainTabParamList; focused: boolean }> = ({ name, focused }) => (
  <View style={styles.iconWrap}>
    <View style={[
      styles.iconBg,
      focused && { backgroundColor: C.accentGlow },
    ]}>
      <Text style={[styles.iconEmoji, { opacity: focused ? 1 : 0.45 }]}>
        {TABS[name].icon}
      </Text>
    </View>
    {focused && <View style={styles.activeDot} />}
  </View>
);

export const MainTabNavigator: React.FC = () => {
  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarStyle: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 88 : 68,
      backgroundColor: C.barBg,
      borderTopWidth: 1,
      borderTopColor: C.barBorder,
      paddingBottom: Platform.OS === 'ios' ? 20 : 6,
      paddingTop: 6,
      elevation: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    tabBarActiveTintColor: C.accent,
    tabBarInactiveTintColor: C.creamMuted,
    tabBarLabelStyle: {
      fontFamily: 'DMSans-Medium',
      fontSize: 9,
      letterSpacing: 0.3,
      marginTop: -2,
    },
    tabBarItemStyle: {
      paddingTop: 2,
    },
  }), []);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Calendar"
        component={HomeScreen}
        options={{
          tabBarLabel: TABS.Calendar.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Calendar" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskListScreen}
        options={{
          tabBarLabel: TABS.Tasks.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Tasks" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventListScreen}
        options={{
          tabBarLabel: TABS.Events.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Events" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Food"
        component={FoodTrackerScreen}
        options={{
          tabBarLabel: TABS.Food.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Food" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Shopping"
        component={ShoppingListScreen}
        options={{
          tabBarLabel: TABS.Shopping.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Shopping" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarLabel: TABS.Stats.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Stats" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: TABS.Settings.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Settings" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 32,
  },
  iconBg: {
    width: 34,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  activeDot: {
    position: 'absolute',
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
});
