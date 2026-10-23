export type ThemeMode = 'dark' | 'light' | 'system';

export function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'light';
}
