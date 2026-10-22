import { Platform } from 'react-native';

export type ColorSchemeName = 'dark' | 'light';

export interface ThemeColors {
  canvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  line: string;
  controlLine: string;
  text: string;
  text2: string;
  text3: string;
  disabled: string;
  accent: string;
  accentFill: string;
  onAccent: string;
  danger: string;
  dangerSurface: string;
  successSurface: string;
  scrim: string;
  onScrim: string;

  /** Monochrome redesign palette. Kept separate so existing screens do not shift. */
  bg: string;
  surface: string;
  raised: string;
  border: string;
  strong: string;
  divider: string;
  textStrong: string;
  secondary: string;
  placeholder: string;
  textDisabled: string;
  primary: string;
  onPrimary: string;
}

export const themes: Record<ColorSchemeName, ThemeColors> = {
  dark: {
    // Site palette, inverted: ink canvas, paper text.
    canvas: '#0A0A0A',
    surface1: '#121210',
    surface2: '#181815',
    surface3: '#22221E',
    line: '#2B2B26',
    controlLine: '#484840',
    text: '#F3F3EF',
    text2: '#A9A9A0',
    text3: '#7B7B72',
    disabled: '#4C4C45',
    accent: '#F3F3EF',
    accentFill: '#F3F3EF',
    onAccent: '#0A0A0A',
    danger: '#E0837A',
    dangerSurface: 'rgba(224,131,122,0.10)',
    successSurface: 'rgba(120,200,160,0.10)',
    scrim: 'rgba(0,0,0,0.72)',
    onScrim: '#F3F3EF',

    bg: '#0A0A0A',
    surface: '#141412',
    raised: '#1E1E1A',
    border: '#2E2E28',
    strong: '#F3F3EF',
    divider: '#232320',
    textStrong: '#F3F3EF',
    secondary: '#A9A9A0',
    placeholder: '#8F8F88',
    textDisabled: '#55554E',
    primary: '#F3F3EF',
    onPrimary: '#0A0A0A',
  },
  light: {
    // The website's paper and ink.
    canvas: '#F3F3EF',
    surface1: '#F7F7F3',
    surface2: '#FFFFFF',
    surface3: '#EAEAE4',
    line: '#DCDCD4',
    controlLine: '#C2C2B8',
    text: '#0A0A0A',
    text2: '#62625C',
    text3: '#6E6E68',
    disabled: '#B4B4AC',
    accent: '#0A0A0A',
    accentFill: '#0A0A0A',
    onAccent: '#F3F3EF',
    danger: '#B3261E',
    dangerSurface: 'rgba(179,38,30,0.06)',
    successSurface: 'rgba(31,122,77,0.08)',
    scrim: 'rgba(10,10,10,0.45)',
    onScrim: '#F3F3EF',

    bg: '#F3F3EF',
    surface: '#FFFFFF',
    raised: '#EAEAE4',
    border: 'rgba(10,10,10,0.18)',
    strong: '#0A0A0A',
    divider: 'rgba(10,10,10,0.09)',
    textStrong: '#0A0A0A',
    secondary: '#62625C',
    placeholder: '#6E6E68',
    textDisabled: '#B4B4AC',
    primary: '#0A0A0A',
    onPrimary: '#F3F3EF',
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

/** Icon sizes on a 4pt rhythm. Use these instead of ad-hoc numbers. */
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  bubble: 18,
  composer: 20,
  sheet: 24,
  full: 999,
} as const;

export const fonts = {
  sans: 'Inter-Regular',
  sansMedium: 'Inter-Medium',
  sansSemiBold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
  sansArabic: 'NotoSansArabic-Regular',
  sansArabicMedium: 'NotoSansArabic-Medium',
  sansArabicSemiBold: 'NotoSansArabic-SemiBold',
  sansArabicBold: 'NotoSansArabic-Bold',
  mono: 'JetBrainsMono',
  monoMedium: 'JetBrainsMono-Medium',
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'ui-serif, "Iowan Old Style", Georgia, "Times New Roman", serif',
  }) as string,
} as const;

export const typography = {
  greeting: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '400' as const,
    letterSpacing: -0.7,
  },
  wordmark: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400' as const,
    letterSpacing: -0.5,
  },
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  code: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },

  /** Redesign variants. Existing screens keep the variants above. */
  connectTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  sessionsTitle: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  topBarTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600' as const,
  },
  body15: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  fieldLabel: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  buttonLabel: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  eyebrow12: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 1.68,
    textTransform: 'uppercase' as const,
  },
  section: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 1.44,
    textTransform: 'uppercase' as const,
  },
  helper: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  subtitle13: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  mono13: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
  pill: { fontSize: 14, lineHeight: 18, fontWeight: '500' as const },
} as const;

/** Android notification LED accent; monochrome and theme-independent. */
export const notificationColor = '#FFFFFF';

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const HIT_SLOP_4 = { top: 4, bottom: 4, left: 4, right: 4 } as const;
export const MIN_TARGET = 44;
