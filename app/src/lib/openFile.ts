import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { absoluteUrl, authHeader } from '@/api/client';
import type { MessageFile } from '@/api/types';

function safeName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'download';
}

export async function openFile(file: MessageFile): Promise<void> {
  const url = absoluteUrl(file.url);
  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers: authHeader() });
    if (!response.ok) throw new Error(`Download failed (${response.status}).`);
    const blob = await response.blob();
    const globalWithUrl = globalThis as {
      URL?: { createObjectURL?: (value: Blob) => string };
      open?: (url?: string) => void;
    };
    const objectUrl = globalWithUrl.URL?.createObjectURL?.(blob);
    if (objectUrl && globalWithUrl.open) {
      globalWithUrl.open(objectUrl);
      return;
    }
    throw new Error('Downloads are not available in this browser.');
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('No cache directory available.');
  const target = `${directory}${file.id.slice(0, 8)}-${safeName(file.name)}`;
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.downloadAsync(url, target, { headers: authHeader() });
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: file.mime,
      dialogTitle: file.name,
      UTI: file.mime,
    });
  } else {
    await Linking.openURL(url);
  }
}
