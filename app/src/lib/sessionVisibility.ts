import { deleteStored, getStored, setStored } from '@/lib/storage';

const HIDDEN_SESSIONS_KEY = 'sessions.hidden.v1';

export async function getHiddenSessionIds(): Promise<string[]> {
  const stored = await getStored(HIDDEN_SESSIONS_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return [...new Set(parsed)];
    }
  } catch {
    // Discard invalid local-only visibility state.
  }
  await deleteStored(HIDDEN_SESSIONS_KEY);
  return [];
}

export async function setHiddenSessionIds(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) {
    await deleteStored(HIDDEN_SESSIONS_KEY);
    return;
  }
  await setStored(HIDDEN_SESSIONS_KEY, JSON.stringify(unique));
}
