import { TextStyle } from 'react-native';

// Fonts à charger via react-native-google-fonts ou assets locaux
export const FONTS = {
  heading: 'Nunito',
  headingBold: 'Nunito-Bold',
  headingSemiBold: 'Nunito-SemiBold',
  body: 'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodyBold: 'DMSans-Bold',
  mono: 'JetBrainsMono-Regular',
  monoBold: 'JetBrainsMono-Bold',
} as const;

export interface Typography {
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  h4: TextStyle;
  body: TextStyle;
  bodyMedium: TextStyle;
  bodySmall: TextStyle;
  caption: TextStyle;
  label: TextStyle;
  mono: TextStyle;
  monoSmall: TextStyle;
  button: TextStyle;
  tabLabel: TextStyle;
}

export const typography: Typography = {
  h1: {
    fontFamily: FONTS.headingBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: FONTS.headingBold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    lineHeight: 22,
  },
  monoSmall: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  tabLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
};
