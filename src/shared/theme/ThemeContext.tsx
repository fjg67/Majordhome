import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Appearance, ColorSchemeName, StatusBar } from 'react-native';
import { ThemeColors, darkColors, lightColors } from './colors';
import { Typography, typography } from './typography';
import { spacing, borderRadius, shadows, ANIMATION } from './spacing';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  typography: Typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  animation: typeof ANIMATION;
  isDark: boolean;
}

export interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const buildTheme = (mode: 'light' | 'dark'): Theme => ({
  mode,
  colors: mode === 'dark' ? darkColors : lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation: ANIMATION,
  isDark: mode === 'dark',
});

export const ThemeContext = createContext<ThemeContextValue>({
  theme: buildTheme('dark'),
  themeMode: 'system',
  setThemeMode: () => {},
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialMode = 'system',
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const theme = useMemo(() => buildTheme(resolvedMode), [resolvedMode]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === 'system') {
        return resolvedMode === 'dark' ? 'light' : 'dark';
      }
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [resolvedMode]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeMode,
      setThemeMode,
      toggleTheme,
    }),
    [theme, themeMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
};
