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

// ─── Main Bottom Tabs ────────────────────────────────────
export type MainTabParamList = {
  Calendar: undefined;
  Tasks: undefined;
  Events: undefined;
  Food: undefined;
  Shopping: undefined;
  Stats: undefined;
  Settings: undefined;
};

// Typage helper pour les écrans
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
