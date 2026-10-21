import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

function webStore(sessionOnly: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  return sessionOnly ? window.sessionStorage : window.localStorage;
}

export async function getStored(key: string, webSessionOnly = false): Promise<string | null> {
  try {
    if (isWeb) return webStore(webSessionOnly)?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setStored(
  key: string,
  value: string,
  webSessionOnly = false,
): Promise<void> {
  try {
    if (isWeb) {
      webStore(webSessionOnly)?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Storage failures must not crash the UI.
  }
}

export async function deleteStored(key: string, webSessionOnly = false): Promise<void> {
  try {
    if (isWeb) {
      webStore(webSessionOnly)?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}
