import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@shared/hooks/useTheme';
import { navigationRef } from '@services/notifications/navigationRef';
import type { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SplashScreen } from '@features/auth/screens/SplashScreen';
import { AuthScreen } from '@features/auth/screens/AuthScreen';
import { HouseholdSetupScreen } from '@features/auth/screens/HouseholdSetupScreen';
import { MemberProfileScreen } from '@features/auth/screens/MemberProfileScreen';
import { AuthSuccessScreen } from '@features/auth/screens/AuthSuccessScreen';
import { WelcomeMembersScreen } from '@features/auth/screens/WelcomeMembersScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: theme.isDark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.cardBorder,
          notification: theme.colors.error,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.colors.background },
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="AuthSuccess" component={AuthSuccessScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="WelcomeMembers" component={WelcomeMembersScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
