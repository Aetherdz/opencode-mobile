import { create } from 'zustand';
import { getStored, setStored } from '@/lib/storage';

export type ThemeMode = 'dark' | 'light' | 'system';
export type Locale = 'ar' | 'en';

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

function detectLocale(): Locale {
  // The 1.1.3 interface is English-first. The Arabic strings remain in the
  // i18n table for a later opt-in language setting.
  return 'en';
}

interface PersistedSettings {
  themeMode?: ThemeMode;
  locale?: Locale;
  haptics?: boolean;
  notifications?: boolean;
}

function persist(state: SettingsState): void {
  const payload: PersistedSettings = {
    themeMode: state.themeMode,
    locale: state.locale,
    haptics: state.haptics,
    notifications: state.notifications,
  };
  void setStored(SETTINGS_KEY, JSON.stringify(payload));
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
          locale: 'en',
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
    set({ locale });
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
