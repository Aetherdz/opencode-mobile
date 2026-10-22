import { create } from 'zustand';
import { getStored, setStored } from '@/lib/storage';

export type ThemeMode = 'dark' | 'light' | 'system';
export type Locale = 'ar' | 'en' | 'fr';

export interface SettingsState {
  hydrated: boolean;
  themeMode: ThemeMode;
  locale: Locale;
  haptics: boolean;
  notifications: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  setHaptics: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
}

const SETTINGS_KEY = 'opencode.settings.v1';

const LOCALES: readonly Locale[] = ['ar', 'en', 'fr'];

function normalizeLocale(value: unknown): Locale {
  return value === 'ar' || value === 'fr' ? value : 'en';
}

function detectLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (tag.startsWith('ar')) return 'ar';
    if (tag.startsWith('fr')) return 'fr';
  } catch {
    // Fall back to English when Intl is unavailable.
  }
  return 'en';
}

interface PersistedSettings {
  themeMode?: ThemeMode;
  locale?: Locale;
  haptics?: boolean;
  notifications?: boolean;
}

let persistChain: Promise<void> = Promise.resolve();

function persist(state: SettingsState): void {
  const payload: PersistedSettings = {
    themeMode: state.themeMode,
    locale: state.locale,
    haptics: state.haptics,
    notifications: state.notifications,
  };
  // Serialize writes so rapid toggles cannot complete out of order.
  persistChain = persistChain
    .then(() => setStored(SETTINGS_KEY, JSON.stringify(payload)))
    .catch(() => undefined);
}

export const useSettings = create<SettingsState>((set, get) => ({
  hydrated: false,
  themeMode: 'dark',
  locale: detectLocale(),
  haptics: true,
  notifications: false,
  hydrate: async () => {
    const raw = await getStored(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedSettings;
        set({
          themeMode:
            parsed.themeMode === 'light' || parsed.themeMode === 'system'
              ? parsed.themeMode
              : 'dark',
          locale: normalizeLocale(parsed.locale),
          haptics: parsed.haptics !== false,
          notifications: parsed.notifications === true,
          hydrated: true,
        });
        return;
      } catch {
        // fall through to defaults
      }
    }
    set({ hydrated: true });
  },
  setThemeMode: (themeMode) => {
    set({ themeMode });
    persist(get());
  },
  setLocale: (locale) => {
    const next = LOCALES.includes(locale) ? locale : 'en';
    set({ locale: next });
    persist(get());
  },
  setHaptics: (haptics) => {
    set({ haptics });
    persist(get());
  },
  setNotifications: (notifications) => {
    set({ notifications });
    persist(get());
  },
}));
