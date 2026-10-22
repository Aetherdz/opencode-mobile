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
    // A blob: URL inherits this page's origin. Never let a stored HTML/SVG
    // attachment execute as a document in the app origin, where it could read
    // the bridge token from sessionStorage. Only raster images and PDFs keep
    // their type; everything else is forced to plain text.
    const mime = (file.mime || blob.type || '').split(';', 1)[0].trim().toLowerCase();
    const safePreview =
      mime === 'application/pdf' ||
      mime === 'image/png' ||
      mime === 'image/jpeg' ||
      mime === 'image/gif' ||
      mime === 'image/webp';
    const safeBlob = safePreview
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: 'text/plain;charset=utf-8' });
    const globalWithUrl = globalThis as {
      URL?: { createObjectURL?: (value: Blob) => string; revokeObjectURL?: (url: string) => void };
      open?: (url?: string, target?: string, features?: string) => void;
    };
    const objectUrl = globalWithUrl.URL?.createObjectURL?.(safeBlob);
    if (objectUrl && globalWithUrl.open) {
      globalWithUrl.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => globalWithUrl.URL?.revokeObjectURL?.(objectUrl), 60_000);
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
