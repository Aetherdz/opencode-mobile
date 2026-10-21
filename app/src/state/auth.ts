import { create } from 'zustand';
import { deleteStored, getStored, setStored } from '@/lib/storage';

export interface AuthState {
  hydrated: boolean;
  baseUrl: string;
  token: string;
  hydrate: () => Promise<void>;
  save: (baseUrl: string, token: string) => Promise<void>;
  clear: () => Promise<void>;
}

const AUTH_KEY = 'opencode.auth.v1';

export function normalizeBaseUrl(value: string): string {
  let url = value.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}

export const useAuth = create<AuthState>((set) => ({
  hydrated: false,
  baseUrl: '',
  token: '',
  hydrate: async () => {
    const raw = await getStored(AUTH_KEY, true);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { baseUrl?: string; token?: string };
        set({
          baseUrl: parsed.baseUrl ? normalizeBaseUrl(parsed.baseUrl) : '',
          token: parsed.token ?? '',
          hydrated: true,
        });
        return;
      } catch {
        // fall through
      }
    }
    set({ hydrated: true });
  },
  save: async (baseUrl, token) => {
    const normalized = normalizeBaseUrl(baseUrl);
    const trimmed = token.trim();
    await setStored(AUTH_KEY, JSON.stringify({ baseUrl: normalized, token: trimmed }), true);
    set({ baseUrl: normalized, token: trimmed });
  },
  clear: async () => {
    await deleteStored(AUTH_KEY, true);
    set({ baseUrl: '', token: '' });
  },
}));
