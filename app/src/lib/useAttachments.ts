import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { ApiError, uploadFile, type UploadAsset } from '@/api/client';
import type { MessageFile } from '@/api/types';
import { useDialog } from '@/components/ui/DialogProvider';
import { useI18n } from '@/lib/i18n';

export interface PendingAttachment {
  id: string;
  uri: string;
  name: string;
  mime: string;
  size?: number;
  status: 'uploading' | 'ready' | 'error';
  progress?: number;
  file?: MessageFile;
  asset: UploadAsset;
  error?: string;
}

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.apk',
  '.ipa',
  '.jar',
  '.class',
  '.wasm',
  '.scr',
  '.pif',
]);

function blockedExtension(name: string): string | null {
  const match = /\.[^.]+$/.exec(name);
  const ext = match?.[0]?.toLowerCase();
  return ext && BLOCKED_EXTENSIONS.has(ext) ? ext : null;
}

function uploadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const status =
      error.status > 0
        ? `HTTP ${error.status}`
        : error.code === 'timeout'
          ? 'Timeout'
          : 'Network';
    return `${error.message} (${status} · ${error.code})`;
  }
  return error instanceof Error ? error.message : fallback;
}

let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `att_${Date.now()}_${sequence}`;
}

export interface AttachmentLimits {
  maxFiles: number;
  maxBytes: number;
  maxTotalBytes: number;
}

export function useAttachments(sessionId: string | undefined, limits: AttachmentLimits) {
  const { t } = useI18n();
  const { showDialog } = useDialog();
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const activeUploads = useRef(0);
  const mounted = useRef(true);
  const removedIds = useRef(new Set<string>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const maxFiles = Math.max(1, limits.maxFiles);
  const maxBytes = Math.max(1, limits.maxBytes);
  const maxTotalBytes = Math.max(1, limits.maxTotalBytes);

  const uploadOne = useCallback(
    async (pending: PendingAttachment) => {
      if (!sessionId) return;
      activeUploads.current += 1;
      setUploading(true);
      setItems((current) =>
        current.map((item) =>
          item.id === pending.id
            ? { ...item, status: 'uploading', progress: 0, error: undefined }
            : item,
        ),
      );
      try {
        const file = await uploadFile(sessionId, pending.asset, (fraction) => {
          if (!mounted.current || removedIds.current.has(pending.id)) return;
          setItems((current) =>
            current.map((item) =>
              item.id === pending.id && item.status === 'uploading'
                ? { ...item, progress: fraction }
                : item,
            ),
          );
        });
        if (!mounted.current || removedIds.current.has(pending.id)) return;
        setItems((current) =>
          current.map((item) =>
            item.id === pending.id
              ? { ...item, status: 'ready' as const, progress: 1, file, error: undefined }
              : item,
          ),
        );
      } catch (uploadError) {
        if (!mounted.current || removedIds.current.has(pending.id)) return;
        const message = uploadErrorMessage(uploadError, t('chat.uploadFailed'));
        setItems((current) =>
          current.map((item) =>
            item.id === pending.id
              ? { ...item, status: 'error' as const, progress: undefined, error: message }
              : item,
          ),
        );
        setError(message);
      } finally {
        activeUploads.current = Math.max(0, activeUploads.current - 1);
        if (activeUploads.current === 0 && mounted.current) setUploading(false);
      }
    },
    [sessionId, t],
  );

  const upload = useCallback(
    async (pending: PendingAttachment[]) => {
      if (!sessionId || pending.length === 0) return;
      setError(null);
      await Promise.allSettled(pending.map((item) => uploadOne(item)));
    },
    [sessionId, uploadOne],
  );

  const addAssets = useCallback(
    (assets: UploadAsset[]) => {
      setError(null);
      const remaining = maxFiles - items.length;
      if (remaining <= 0) {
        setError(t('chat.tooManyFiles', { count: maxFiles }));
        return;
      }
      const totalBytes = items.reduce((sum, item) => sum + (item.size ?? 0), 0);
      let nextTotal = totalBytes;
      const accepted: PendingAttachment[] = [];
      for (const asset of assets.slice(0, remaining)) {
        const blocked = blockedExtension(asset.name);
        if (blocked) {
          setError(t('chat.fileTypeBlocked', { ext: blocked }));
          continue;
        }
        if (asset.size && asset.size > maxBytes) {
          setError(t('chat.fileTooLarge', { size: Math.round(maxBytes / 1024 / 1024) }));
          continue;
        }
        if (asset.size && nextTotal + asset.size > maxTotalBytes) {
          setError(t('chat.totalTooLarge', { size: Math.round(maxTotalBytes / 1024 / 1024) }));
          continue;
        }
        nextTotal += asset.size ?? 0;
        accepted.push({
          id: nextId(),
          uri: asset.uri,
          name: asset.name,
          mime: asset.mime,
          ...(asset.size ? { size: asset.size } : {}),
          status: 'uploading',
          progress: 0,
          asset,
        });
      }
      if (assets.length > remaining) {
        setError(t('chat.tooManyFiles', { count: maxFiles }));
      }
      if (accepted.length === 0) return;
      setItems((current) => [...current, ...accepted]);
      void upload(accepted);
    },
    [items, maxBytes, maxFiles, maxTotalBytes, t, upload],
  );

  const pickPhotos = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog({
        title: t('chat.photo'),
        message: t('chat.photoPermission'),
        actions: [
          { label: t('common.cancel'), variant: 'cancel' },
          {
            label: t('common.openSettings'),
            onPress: () => void Linking.openSettings(),
          },
        ],
      });
      return;
    }
    const remaining = Math.max(1, maxFiles - items.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      orderedSelection: true,
    });
    if (result.canceled) return;
    addAssets(
      result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `image-${Date.now()}-${index}.jpg`,
        mime: asset.mimeType ?? 'image/jpeg',
        ...(asset.fileSize ? { size: asset.fileSize } : {}),
      })),
    );
  }, [addAssets, items.length, maxFiles, showDialog, t]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showDialog({
        title: t('chat.camera'),
        message: t('chat.cameraPermission'),
        actions: [
          { label: t('common.cancel'), variant: 'cancel' },
          {
            label: t('common.openSettings'),
            onPress: () => void Linking.openSettings(),
          },
        ],
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    addAssets(
      result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
        mime: asset.mimeType ?? 'image/jpeg',
        ...(asset.fileSize ? { size: asset.fileSize } : {}),
      })),
    );
  }, [addAssets, showDialog, t]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    addAssets(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mime: asset.mimeType ?? 'application/octet-stream',
        ...(asset.size ? { size: asset.size } : {}),
      })),
    );
  }, [addAssets]);

  const remove = useCallback((id: string) => {
    removedIds.current.add(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const retry = useCallback(() => {
    const failed = items.filter((item) => item.status === 'error');
    if (failed.length > 0) void upload(failed);
  }, [items, upload]);

  const clear = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const readyFiles = useMemo(
    () => items.flatMap((item) => (item.status === 'ready' && item.file ? [item.file] : [])),
    [items],
  );

  return {
    items,
    error,
    uploading,
    maxFiles,
    maxBytes,
    readyFiles,
    addAssets,
    pickPhotos,
    takePhoto,
    pickDocument,
    remove,
    retry,
    clear,
  };
}
