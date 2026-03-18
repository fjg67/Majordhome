import type { NavigatorScreenParams } from '@react-navigation/native';

// ─── Root Stack ──────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  AuthSuccess: { nextRoute: 'Main' | 'HouseholdSetup' | 'MemberProfile' | 'WelcomeMembers'; mode: 'login' | 'register' };
  HouseholdSetup: undefined;
  MemberProfile: undefined;
  WelcomeMembers: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ─── More Stack (inside "Plus" tab) ─────────────────────
export type MoreStackParamList = {
  MoreHome: undefined;
  Events: undefined;
  Food: undefined;
  Budget: undefined;
  Notes: undefined;
  NoteEditor: { noteId?: string; category?: string } | undefined;
  Stats: undefined;
  Rewards: undefined;
  Settings: undefined;
  MealPlan: undefined;
  Chores: undefined;
  Polls: undefined;
  Documents: undefined;
  DocumentViewer: { docId: string } | undefined;
  Weather: undefined;
  Timers: undefined;
  Mood: undefined;
};

// ─── Main Bottom Tabs ────────────────────────────────────
export type MainTabParamList = {
  Calendar: undefined;
  Tasks: undefined;
  Chat: undefined;
  Shopping: undefined;
  More: NavigatorScreenParams<MoreStackParamList>;
};

// Typage helper pour les écrans
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
