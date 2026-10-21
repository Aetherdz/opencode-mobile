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
    canvas: '#000000',
    surface1: '#0A0A0A',
    surface2: '#121212',
    surface3: '#1B1B1B',
    line: '#242424',
    controlLine: '#4D4D4D',
    text: '#F7F7F7',
    text2: '#A6A6A6',
    text3: '#707070',
    disabled: '#4A4A4A',
    accent: '#FFFFFF',
    accentFill: '#FFFFFF',
    onAccent: '#000000',
    danger: '#FFFFFF',
    dangerSurface: 'rgba(255,255,255,0.04)',
    successSurface: 'rgba(255,255,255,0.08)',
    scrim: 'rgba(0,0,0,0.78)',
    onScrim: '#FFFFFF',

    bg: '#000000',
    surface: '#0D0D0D',
    raised: '#161616',
    border: '#2A2A2A',
    strong: '#444444',
    divider: '#1C1C1C',
    textStrong: '#FFFFFF',
    secondary: '#A0A0A0',
    placeholder: '#8A8A8A',
    textDisabled: '#555555',
    primary: '#FFFFFF',
    onPrimary: '#000000',
  },
  light: {
    canvas: '#FFFFFF',
    surface1: '#FAFAFA',
    surface2: '#F3F3F3',
    surface3: '#E9E9E9',
    line: '#E5E5E5',
    controlLine: '#B0B0B0',
    text: '#0A0A0A',
    text2: '#666666',
    text3: '#8C8C8C',
    disabled: '#BDBDBD',
    accent: '#0A0A0A',
    accentFill: '#0A0A0A',
    onAccent: '#FFFFFF',
    danger: '#0A0A0A',
    dangerSurface: 'rgba(0,0,0,0.04)',
    successSurface: 'rgba(0,0,0,0.05)',
    scrim: 'rgba(0,0,0,0.45)',
    onScrim: '#FFFFFF',

    bg: '#FFFFFF',
    surface: '#F5F5F5',
    raised: '#EBEBEB',
    border: '#D4D4D4',
    strong: '#BBBBBB',
    divider: '#E6E6E6',
    textStrong: '#000000',
    secondary: '#5F5F5F',
    placeholder: '#707070',
    textDisabled: '#A8A8A8',
    primary: '#000000',
    onPrimary: '#FFFFFF',
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
} as const;

export const typography = {
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
