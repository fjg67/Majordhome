import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Platform, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import type { MainTabParamList, MoreStackParamList } from './types';

import { HomeScreen } from '@features/home/screens/HomeScreen';
import { TaskListScreen } from '@features/tasks/screens/TaskListScreen';
import { ChatScreen } from '@features/chat/screens/ChatScreen';
import { ShoppingListScreen } from '@features/shopping/screens/ShoppingListScreen';

// ─── More stack screens ──────────────────────────────────
import { MoreScreen } from '@features/more/screens/MoreScreen';
import { EventListScreen } from '@features/events/screens/EventListScreen';
import { FoodTrackerScreen } from '@features/food/screens/FoodTrackerScreen';
import { BudgetScreen } from '@features/budget/screens/BudgetScreen';
import { NotesScreen } from '@features/notes/screens/NotesScreen';
import { NoteEditorScreen } from '@features/notes/screens/NoteEditorScreen';
import { StatsScreen } from '@features/stats/screens/StatsScreen';
import { RewardsScreen } from '@features/rewards/screens/RewardsScreen';
import { SettingsScreen } from '@features/settings/screens/SettingsScreen';
import { MealPlanScreen } from '@features/meals/screens/MealPlanScreen';
import { ChoresScreen } from '@features/chores/screens/ChoresScreen';
import { PollsScreen } from '@features/polls/screens/PollsScreen';
import { DocumentsScreen } from '@features/documents/screens/DocumentsScreen';
import { DocumentViewerScreen } from '@features/documents/screens/DocumentViewerScreen';
import { WeatherScreen } from '@features/weather/screens/WeatherScreen';
import { SharedTimersScreen } from '@features/timers/screens/SharedTimersScreen';
import { MoodBoardScreen } from '@features/mood/screens/MoodBoardScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const MoreStack = createStackNavigator<MoreStackParamList>();

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
  Chat: { icon: '\u{1F4AC}', label: 'Chat' },
  Shopping: { icon: '\u{1F6D2}', label: 'Courses' },
  More: { icon: '\u2630', label: 'Plus' },
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

// ─── More Stack Navigator ────────────────────────────────
const BackBtn: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <Pressable
    onPress={onPress}
    hitSlop={12}
    style={{
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: 'rgba(245,166,35,0.15)',
      borderWidth: 1, borderColor: 'rgba(245,166,35,0.22)',
      alignItems: 'center', justifyContent: 'center',
      marginLeft: 8,
    }}
  >
    <Text style={{ fontSize: 22, color: '#F5A623', lineHeight: 24, marginLeft: -2 }}>‹</Text>
  </Pressable>
);

const MoreStackNavigator: React.FC = () => (
  <MoreStack.Navigator
    screenOptions={({ navigation }) => ({
      headerStyle: { backgroundColor: '#1A0E00' },
      headerShadowVisible: false,
      headerTitle: '',
      headerBackVisible: false,
      headerLeft: () => <BackBtn onPress={() => navigation.goBack()} />,
    })}
  >
    <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
    <MoreStack.Screen name="Events" component={EventListScreen} />
    <MoreStack.Screen name="Food" component={FoodTrackerScreen} />
    <MoreStack.Screen name="Budget" component={BudgetScreen} options={{ headerShown: false }} />
    <MoreStack.Screen name="Notes" component={NotesScreen} options={{ headerShown: false }} />
    <MoreStack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ headerShown: false }} />
    <MoreStack.Screen name="Stats" component={StatsScreen} />
    <MoreStack.Screen name="Rewards" component={RewardsScreen} />
    <MoreStack.Screen name="Settings" component={SettingsScreen} />
    <MoreStack.Screen name="MealPlan" component={MealPlanScreen} />
    <MoreStack.Screen name="Chores" component={ChoresScreen} />
    <MoreStack.Screen name="Polls" component={PollsScreen} />
    <MoreStack.Screen name="Documents" component={DocumentsScreen} />
    <MoreStack.Screen name="DocumentViewer" component={DocumentViewerScreen} options={{ headerShown: false }} />
    <MoreStack.Screen name="Weather" component={WeatherScreen} />
    <MoreStack.Screen name="Timers" component={SharedTimersScreen} />
    <MoreStack.Screen name="Mood" component={MoodBoardScreen} />
  </MoreStack.Navigator>
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
      fontSize: 10,
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
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: TABS.Chat.label,
          tabBarIcon: ({ focused }) => <TabIcon name="Chat" focused={focused} />,
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
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: TABS.More.label,
          tabBarIcon: ({ focused }) => <TabIcon name="More" focused={focused} />,
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
