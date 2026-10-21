import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/state/settings';
import {
  themes,
  spacing,
  radii,
  iconSizes,
  typography,
  fonts,
  type ColorSchemeName,
  type ThemeColors,
} from './tokens';

export interface ThemeValue {
  colors: ThemeColors;
  scheme: ColorSchemeName;
  spacing: typeof spacing;
  radii: typeof radii;
  iconSizes: typeof iconSizes;
  typography: typeof typography;
  fonts: typeof fonts;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSettings((state) => state.themeMode);
  const systemScheme = useColorScheme();
  const { dir, isRTL } = useI18n();
  const scheme: ColorSchemeName =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      colors: themes[scheme],
      scheme,
      spacing,
      radii,
      iconSizes,
      typography,
      fonts,
      dir,
      isRTL,
    }),
    [scheme, dir, isRTL],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
