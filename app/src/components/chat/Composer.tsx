import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Delivery, SessionStatus } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { useRtl } from '@/components/ui/Rtl';
import { Sheet } from '@/components/ui/Sheet';
import type { PendingAttachment } from '@/lib/useAttachments';
import { deleteStored, getStored, setStored } from '@/lib/storage';
import { fileIcon } from '@/lib/fileIcon';
import { formatBytes } from '@/lib/format';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { hasArabic, textDirection } from '@/lib/textDirection';
import { layout } from '@/theme/layout';
import { radii } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { SendResult } from '@/state/chat';

export interface ComposerProps {
  sessionId: string;
  status: SessionStatus;
  online: boolean;
  attachments: PendingAttachment[];
  attachmentError: string | null;
  uploading: boolean;
  maxFiles: number;
  error: string | null;
  modelName?: string;
  onModelSelect: () => void;
  seed?: string | null;
  onSeedConsumed?: () => void;
  onSend: (text: string, delivery?: Delivery) => Promise<SendResult>;
  onStop: () => void;
  onPickPhotos: () => void;
  onTakePhoto: () => void;
  onPickDocument: () => void;
  onRemoveAttachment: (id: string) => void;
  onRetryUpload: () => void;
  onSent: () => void;
  onOpenImage: (uri: string) => void;
}

export function Composer({
  sessionId,
  status,
  online,
  attachments,
  attachmentError,
  uploading,
  maxFiles,
  error,
  modelName,
  onModelSelect,
  seed,
  onSeedConsumed,
  onSend,
  onStop,
  onPickPhotos,
  onTakePhoto,
  onPickDocument,
  onRemoveAttachment,
  onRetryUpload,
  onSent,
  onOpenImage,
}: ComposerProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const forcedRtl = useRtl();
  const isRtl = theme.isRTL || forcedRtl;
  const { fontScale } = useWindowDimensions();
  const inputLineHeight = Math.round(22 * Math.max(1, fontScale));
  const maxInputHeight = inputLineHeight * 6 + 10;
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const textRef = useRef('');
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [delivery, setDelivery] = useState<Delivery>('steer');
  const [localError, setLocalError] = useState<string | null>(null);
  const draftKey = `opencode.draft.${sessionId}`;

  useEffect(() => {
    let cancelled = false;
    setDraftReady(false);
    void getStored(draftKey).then((value) => {
      if (cancelled) return;
      const draft = value ?? '';
      setText(draft);
      textRef.current = draft;
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!seed) return;
    setText(seed);
    textRef.current = seed;
    onSeedConsumed?.();
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [onSeedConsumed, seed]);

  useEffect(() => {
    textRef.current = text;
    if (!draftReady) return;
    const timer = setTimeout(() => {
      if (text.trim()) void setStored(draftKey, text);
      else void deleteStored(draftKey);
    }, 300);
    return () => clearTimeout(timer);
  }, [draftKey, draftReady, text]);

  useEffect(
    () => () => {
      if (textRef.current.trim()) void setStored(draftKey, textRef.current);
    },
    [draftKey],
  );

  const hasFiles = attachments.some((item) => item.status === 'ready');
  const hasFailedUpload = attachments.some((item) => item.status === 'error');
  const canSend =
    online &&
    (text.trim().length > 0 || hasFiles) &&
    !uploading &&
    !hasFailedUpload &&
    !sending;
  const busy =
    status === 'running' || status === 'waiting_input' || status === 'needs_approval';
  const showDelivery = status === 'running';
  const empty = text.length === 0;
  const direction = textDirection(text || t('chat.placeholder'), isRtl);
  const textAlign = empty ? (isRtl ? 'right' : 'left') : direction === 'rtl' ? 'right' : 'left';

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setLocalError(null);
    const result = await onSend(text.trim(), busy ? delivery : 'steer');
    setSending(false);
    if (result.ok) {
      setText('');
      textRef.current = '';
      void deleteStored(draftKey);
      onSent();
      inputRef.current?.focus();
    } else {
      setLocalError(
        result.reason === 'busy'
          ? t('chat.busy')
          : result.reason === 'offline'
            ? t('chat.offline')
            : t('common.error'),
      );
    }
  };

  const handleKeyPress = (event: { nativeEvent: unknown }) => {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent as { ctrlKey?: boolean; metaKey?: boolean; key?: string };
    if ((native.ctrlKey || native.metaKey) && native.key === 'Enter') {
      void submit();
    }
  };

  const activeSend = canSend || sending;

  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: theme.colors.bg,
          paddingHorizontal: layout.padX,
          paddingTop: 8,
          paddingBottom: 8,
        },
      ]}
    >
      {error || localError || attachmentError ? (
        <View style={styles.errorBlock}>
          <AppText variant="helper" color="danger" accessibilityLiveRegion="polite">
              {localError ?? attachmentError ?? (error === 'outside_workdir' ? t('chat.workdirError') : error)}
          </AppText>
          {hasFailedUpload ? (
            <Pressable
              onPress={() => {
                hapticSelection();
                onRetryUpload();
              }}
              accessibilityRole="button"
              hitSlop={layout.hitSlop}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <AppText
                variant="helper"
                weight="500"
                color="textStrong"
                style={styles.retryText}
              >
                {t('chat.uploadRetry')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showDelivery ? (
        <View
          style={[
            styles.segment,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.bg,
            },
          ]}
        >
          {(['queue', 'steer'] as const).map((mode, index) => {
            const selected = delivery === mode;
            return (
              <PressableScale
                key={mode}
                onPress={() => {
                  hapticSelection();
                  setDelivery(mode);
                }}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.segmentItem,
                  {
                    borderStartWidth: index === 0 ? 0 : 1,
                    borderStartColor: theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.raised
                      : 'transparent',
                  },
                ]}
              >
                <AppText
                  variant="helper"
                  weight="500"
                  color={selected ? 'textStrong' : 'secondary'}
                >
                  {mode === 'queue' ? t('chat.queue') : t('chat.steer')}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: focused ? theme.colors.strong : theme.colors.border,
          },
        ]}
      >
        {attachments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, flexDirection: 'row' }}
            style={styles.attachmentTray}
          >
            {attachments.map((item) => {
              const isImage = item.mime.startsWith('image/');
              const failed = item.status === 'error';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.attachment,
                    {
                      borderColor: failed ? theme.colors.strong : theme.colors.border,
                      backgroundColor: theme.colors.raised,
                    },
                  ]}
                >
                  {isImage ? (
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        onOpenImage(item.uri);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('chat.viewImage')}: ${item.name}`}
                      accessibilityState={{ busy: item.status === 'uploading' }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={[
                          styles.attachmentImage,
                          { borderColor: theme.colors.border },
                        ]}
                        contentFit="cover"
                      />
                      {item.status === 'uploading' ? (
                        <View style={[styles.imageOverlay, { backgroundColor: theme.colors.scrim }]}>
                          <ActivityIndicator size="small" color={theme.colors.onScrim} />
                        </View>
                      ) : null}
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.attachmentIcon,
                        { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <Icon
                        name={failed ? 'alert-circle-outline' : fileIcon(item.name, item.mime)}
                        size={layout.icon}
                        color={failed ? 'textStrong' : 'secondary'}
                      />
                    </View>
                  )}

                  <View style={styles.attachmentBody}>
                    <AppText variant="helper" weight="500" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <View style={styles.attachmentMeta}>
                      {item.status === 'uploading' ? (
                        <ActivityIndicator size="small" color={theme.colors.secondary} />
                      ) : null}
                      <AppText
                        variant="helper"
                        color={failed ? 'textStrong' : 'secondary'}
                        numberOfLines={1}
                        style={styles.flex}
                      >
                        {failed
                          ? item.error ?? t('chat.uploadFailed')
                          : item.status === 'uploading'
                            ? item.progress !== undefined
                              ? t('chat.uploadingPercent', {
                                  percent: Math.round(item.progress * 100),
                                })
                              : t('chat.uploading')
                            : item.size
                              ? formatBytes(item.size)
                              : ''}
                      </AppText>
                    </View>
                    {item.status === 'uploading' ? (
                      <View
                        style={[
                          styles.uploadTrack,
                          { backgroundColor: theme.colors.border },
                        ]}
                      >
                        <View
                          style={{
                            height: 2,
                            width: `${Math.round((item.progress ?? 0) * 100)}%`,
                            backgroundColor: theme.colors.primary,
                          }}
                        />
                      </View>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      onRemoveAttachment(item.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('chat.removeAttachment')}: ${item.name}`}
                    hitSlop={layout.hitSlop}
                    style={({ pressed }) => [
                      styles.attachmentRemove,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Icon name="close" size={16} color="secondary" />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={theme.colors.placeholder}
            selectionColor={theme.colors.primary}
            cursorColor={theme.colors.primary}
            multiline
            maxLength={100_000}
            accessibilityLabel={t('chat.placeholder')}
            style={{
              flex: 1,
              color: theme.colors.textStrong,
              fontFamily: hasArabic(`${text}${t('chat.placeholder')}`)
                ? theme.fonts.sansArabic
                : theme.fonts.sans,
              fontSize: 15,
              lineHeight: inputLineHeight,
              minHeight: 32,
              maxHeight: maxInputHeight,
              paddingVertical: 5,
              paddingHorizontal: 0,
              borderWidth: 0,
              ...(Platform.OS === 'web'
                ? ({ outlineStyle: 'none' } as object)
                : null),
              textAlign,
              writingDirection: direction,
            }}
          />

        </View>

        <View style={styles.actionsRow}>
          <PressableScale
            onPress={() => setMenuOpen(true)}
            disabled={attachments.length >= maxFiles}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={t('chat.attach')}
            style={[
              styles.attachBtn,
              {
                backgroundColor: theme.colors.raised,
                opacity: attachments.length >= maxFiles ? 0.4 : 1,
              },
            ]}
          >
            <Icon name="add" size={18} color="textStrong" />
          </PressableScale>

          <PressableScale
            onPress={onModelSelect}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={`${t('model.selector')}${modelName ? `: ${modelName}` : ''}`}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.modelSelector,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={[styles.modelDot, { backgroundColor: theme.colors.secondary }]} />
            <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.modelName}>
              {modelName || t('model.selector')}
            </AppText>
            <Icon name="chevron-down" size={13} color="secondary" />
          </PressableScale>

          <View style={styles.actionsSpacer} />

          {sending ? (
            <View
              style={[
                styles.send,
                { backgroundColor: theme.colors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              accessibilityState={{ busy: true }}
            >
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
            </View>
          ) : status === 'running' && !text.trim() && !hasFiles ? (
            <PressableScale
              onPress={onStop}
              scaleTo={0.92}
              accessibilityRole="button"
              accessibilityLabel={t('chat.stop')}
              style={[
                styles.send,
                {
                  backgroundColor: theme.colors.raised,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Icon name="stop" size={15} color="textStrong" />
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => void submit()}
              disabled={!canSend}
              scaleTo={canSend ? 0.92 : 1}
              accessibilityRole="button"
              accessibilityLabel={
                busy
                  ? delivery === 'steer'
                    ? t('chat.steer')
                    : t('chat.queue')
                  : t('chat.send')
              }
              accessibilityState={{ disabled: !canSend }}
              style={[
                styles.send,
                {
                  backgroundColor: activeSend ? theme.colors.primary : 'transparent',
                  borderWidth: activeSend ? 0 : 1,
                  borderColor: theme.colors.border,
                  opacity: canSend || sending ? 1 : 0.45,
                },
              ]}
            >
              <Icon
                name="arrow-up"
                size={18}
                color={activeSend ? 'onPrimary' : 'textDisabled'}
              />
            </PressableScale>
          )}
        </View>
      </View>

      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t('chat.addTitle')}
        titleAlign="center"
      >
        <View style={styles.menu}>
          {[
            { icon: 'document-outline' as const, label: t('chat.document'), action: onPickDocument },
            { icon: 'images-outline' as const, label: t('chat.photo'), action: onPickPhotos },
            { icon: 'camera-outline' as const, label: t('chat.camera'), action: onTakePhoto },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                hapticSelection();
                setMenuOpen(false);
                // Native pickers present their own full-screen UI. Let the
                // animated modal finish dismissing first to avoid competing
                // Android/iOS window transitions. Keep web synchronous because
                // browsers require file pickers to open in the user gesture.
                if (Platform.OS === 'web') {
                  item.action();
                } else {
                  setTimeout(item.action, 240);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.menuTile,
                { backgroundColor: pressed ? theme.colors.raised : theme.colors.surface2 },
              ]}
            >
              <View style={[styles.menuIconDisc, { backgroundColor: theme.colors.surface1 }]}>
                <Icon name={item.icon} size={22} color="textStrong" />
              </View>
              <AppText variant="helper" align="center" numberOfLines={2}>{item.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    gap: 8,
  },
  errorBlock: {
    gap: 4,
  },
  retryText: {
    textDecorationLine: 'underline',
  },
  segment: {
    alignSelf: 'flex-start',
    height: 32,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segmentItem: {
    minWidth: 64,
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radii.composer,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 36,
  },
  actionsRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsSpacer: { flex: 1 },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelSelector: {
    minHeight: 32,
    maxWidth: 196,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  modelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modelName: {
    maxWidth: 190,
  },
  plus: {
    marginBottom: 0,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentTray: {
    maxHeight: 64,
  },
  attachment: {
    width: 236,
    height: 64,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: 8,
    gap: 8,
  },
  attachmentImage: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  attachmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadTrack: {
    height: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  attachmentRemove: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  flex: { flex: 1 },
  menu: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  menuTile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 6,
    borderRadius: 20,
  },
  menuIconDisc: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
});
