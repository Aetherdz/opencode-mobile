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
    // Claude-inspired editorial dark palette: warm ink canvas, paper text, hairline borders.
    canvas: '#0B0B09',
    surface1: '#12120F',
    surface2: '#181814',
    surface3: '#22221D',
    line: '#2B2B24',
    controlLine: '#45453E',
    text: '#F4F4F0',
    text2: '#A8A89F',
    text3: '#7A7A71',
    disabled: '#4C4C45',
    accent: '#F4F4F0',
    accentFill: '#F4F4F0',
    onAccent: '#0B0B09',
    danger: '#E0837A',
    dangerSurface: 'rgba(224,131,122,0.10)',
    successSurface: 'rgba(120,200,160,0.10)',
    scrim: 'rgba(0,0,0,0.70)',
    onScrim: '#F4F4F0',

    bg: '#0B0B09',
    surface: '#141411',
    raised: '#1E1E19',
    border: '#2A2A23',
    strong: '#F4F4F0',
    divider: 'rgba(255,255,255,0.07)',
    textStrong: '#F4F4F0',
    secondary: '#A8A89F',
    placeholder: '#8E8E87',
    textDisabled: '#54544D',
    primary: '#F4F4F0',
    onPrimary: '#0B0B09',
  },
  light: {
    // Claude-inspired editorial light palette: warm parchment canvas, crisp ink text.
    canvas: '#F5F5F0',
    surface1: '#F8F8F4',
    surface2: '#FFFFFF',
    surface3: '#ECECE5',
    line: '#D8D8D0',
    controlLine: '#BFBFB5',
    text: '#0C0C0A',
    text2: '#60605A',
    text3: '#6C6C66',
    disabled: '#B4B4AC',
    accent: '#0C0C0A',
    accentFill: '#0C0C0A',
    onAccent: '#F5F5F0',
    danger: '#B3261E',
    dangerSurface: 'rgba(179,38,30,0.06)',
    successSurface: 'rgba(31,122,77,0.08)',
    scrim: 'rgba(12,12,10,0.42)',
    onScrim: '#F5F5F0',

    bg: '#F5F5F0',
    surface: '#FFFFFF',
    raised: '#EBEBE4',
    border: 'rgba(12,12,10,0.14)',
    strong: '#0C0C0A',
    divider: 'rgba(12,12,10,0.07)',
    textStrong: '#0C0C0A',
    secondary: '#60605A',
    placeholder: '#6C6C66',
    textDisabled: '#B4B4AC',
    primary: '#0C0C0A',
    onPrimary: '#F5F5F0',
  },
};

/**
 * Claude.apk-inspired motion tokens for 120fps-smooth, ultra-snappy animations.
 */
export const motion = {
  duration: {
    instant: 80,
    fast: 120,
    normal: 180,
    slow: 240,
  },
  spring: {
    snappy: { stiffness: 380, damping: 28, mass: 0.8 },
    press: { stiffness: 450, damping: 30, mass: 0.6 },
    gentle: { stiffness: 260, damping: 24, mass: 1 },
    bouncy: { stiffness: 420, damping: 22, mass: 0.8 },
  },
} as const;

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
