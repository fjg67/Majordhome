export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  glass: string;
  glassBorder: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  accentLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  // Gradient colors for headers/banners
  gradientStart: string;
  gradientEnd: string;
  // Card
  cardBg: string;
  cardBorder: string;
  // Input
  inputBg: string;
  inputBorder: string;
  inputBorderFocused: string;
  // Separator
  separator: string;
}

export const darkColors: ThemeColors = {
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceElevated: '#222240',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',
  primary: '#7C6BFF',
  primaryLight: 'rgba(124,107,255,0.15)',
  secondary: '#FF9F43',
  accent: '#A78BFA',
  accentLight: 'rgba(167,139,250,0.15)',
  success: '#2ED47A',
  successLight: 'rgba(46,212,122,0.15)',
  warning: '#FFBE0B',
  warningLight: 'rgba(255,190,11,0.15)',
  error: '#FF6B6B',
  errorLight: 'rgba(255,107,107,0.15)',
  text: '#F0F0FF',
  textSecondary: 'rgba(240,240,255,0.6)',
  textMuted: 'rgba(240,240,255,0.35)',
  gradientStart: '#4A3AFF',
  gradientEnd: '#7B6BFF',
  cardBg: 'rgba(26,26,46,0.80)',
  cardBorder: 'rgba(255,255,255,0.08)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  inputBorderFocused: '#7C6BFF',
  separator: 'rgba(255,255,255,0.08)',
};

export const lightColors: ThemeColors = {
  background: '#F4F5FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  glass: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(0,0,0,0.06)',
  primary: '#6C5CE7',
  primaryLight: 'rgba(108,92,231,0.10)',
  secondary: '#FF9F43',
  accent: '#7C3AED',
  accentLight: 'rgba(124,58,237,0.10)',
  success: '#2ED47A',
  successLight: 'rgba(46,212,122,0.10)',
  warning: '#FFBE0B',
  warningLight: 'rgba(255,190,11,0.10)',
  error: '#FF6B6B',
  errorLight: 'rgba(255,107,107,0.10)',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  gradientStart: '#6C5CE7',
  gradientEnd: '#A29BFE',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.06)',
  inputBg: '#F7F7FB',
  inputBorder: '#E5E7EB',
  inputBorderFocused: '#6C5CE7',
  separator: '#F0F0F5',
};

export const MEMBER_COLORS: readonly string[] = [
  '#FF6B6B', // corail
  '#4ECDC4', // turquoise
  '#45B7D1', // bleu ciel
  '#FFA07A', // saumon
  '#98D8C8', // menthe
  '#DDA0DD', // mauve
  '#F0E68C', // kaki clair
  '#87CEEB', // bleu pastel
  '#F5A623', // ambre
  '#A78BFA', // violet
  '#34D399', // émeraude
  '#F472B6', // rose vif
  '#60A5FA', // bleu vif
  '#FBBF24', // jaune doré
  '#FB923C', // orange
  '#E879F9', // fuchsia
] as const;

export const PRIORITY_COLORS = {
  high: '#F87171',
  medium: '#FBBF24',
  low: '#34D399',
} as const;

export const EXPIRY_COLORS = {
  expired: '#EF4444',
  urgent: '#F97316',
  warning: '#FBBF24',
  ok: '#34D399',
} as const;

export const CATEGORY_EMOJIS = {
  cleaning: '🧹',
  cooking: '🍳',
  shopping: '🛒',
  general: '📋',
  dairy: '🥛',
  meat: '🥩',
  vegetables: '🥦',
  fruits: '🍎',
  frozen: '🧊',
  other: '📦',
} as const;

export const EVENT_EMOJIS = {
  birthday: '🎂',
  work: '💼',
  medical: '🏥',
  sport: '🏃',
  social: '🎉',
  travel: '✈️',
  default: '📅',
} as const;
