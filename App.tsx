import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './src/shared/theme/ThemeContext';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { useAuthStore } from './src/features/auth/store/authStore';
import {
  notificationService,
  setupNotificationHandlers,
} from './src/services/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

// Doit être appelé au top level pour les background events
setupNotificationHandlers();

const App: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const household = useAuthStore(s => s.household);

  useEffect(() => {
    if (user?.id && household?.id) {
      notificationService.initialize(user.id, household.id);
    }
    return () => {
      notificationService.cleanup();
    };
  }, [user?.id, household?.id]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
