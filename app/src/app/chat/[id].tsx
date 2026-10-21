import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  deleteSession,
  getConfig,
  getSession,
  renameSession,
} from '@/api/client';
import { bridgeSocket, useConnection } from '@/api/ws';
import type { ChatMessage, MessageFile, SessionSummary } from '@/api/types';
import { ApprovalSheet } from '@/components/chat/ApprovalSheet';
import { ChatTopBar } from '@/components/chat/ChatTopBar';
import { Composer } from '@/components/chat/Composer';
import { InlineQuestionCard } from '@/components/chat/InlineQuestionCard';
import { MessageRow } from '@/components/chat/MessageRow';
import { ImageViewer } from '@/components/attachments/ImageViewer';
import { RenameSheet } from '@/components/sessions/RenameSheet';
import { AppText } from '@/components/ui/AppText';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { useDialog } from '@/components/ui/DialogProvider';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { Rtl } from '@/components/ui/Rtl';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { basename, formatDay } from '@/lib/format';
import type { Locale } from '@/state/settings';
import {
  hapticError,
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { openFile } from '@/lib/openFile';
import { useAttachments } from '@/lib/useAttachments';
import { useChat } from '@/state/chat';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

type Row =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      isFirstInGroup: boolean;
      showTime: boolean;
    };

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function mergeActivities(
  current: ChatMessage['activities'],
  incoming: ChatMessage['activities'],
): ChatMessage['activities'] {
  const merged = new Map<string, NonNullable<ChatMessage['activities']>[number]>();
  for (const activity of [...(current ?? []), ...(incoming ?? [])]) {
    merged.set(activity.id, activity);
  }
  return [...merged.values()];
}

function buildRows(input: ChatMessage[], locale: Locale): Row[] {
  const messages: ChatMessage[] = [];
  for (const message of input) {
    const previous = messages[messages.length - 1];
    if (
      message.role === 'assistant' &&
      !message.text.trim() &&
      message.activities &&
      message.activities.length > 0 &&
      previous &&
      previous.role === 'assistant' &&
      !previous.text.trim() &&
      previous.activities &&
      previous.activities.length > 0
    ) {
      messages[messages.length - 1] = {
        ...previous,
        activities: mergeActivities(previous.activities, message.activities),
      };
      continue;
    }
    messages.push(message);
  }

  const rows: Row[] = [];
  let dayKey = '';
  let previous: ChatMessage | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const nextDay = new Date(message.createdAt).toDateString();
    if (nextDay !== dayKey) {
      dayKey = nextDay;
      rows.push({
        kind: 'day',
        key: `day_${dayKey}`,
        label: formatDay(message.createdAt, locale),
      });
      previous = null;
    }

    const sameGroup =
      previous !== null &&
      previous.role === message.role &&
      message.createdAt - previous.createdAt < GROUP_WINDOW_MS;
    const following = messages[index + 1];
    const nextSameGroup =
      following !== undefined &&
      following.role === message.role &&
      following.createdAt - message.createdAt < GROUP_WINDOW_MS &&
      new Date(following.createdAt).toDateString() === nextDay;

    rows.push({
      kind: 'message',
      key: message.id,
      message,
      isFirstInGroup: !sameGroup,
      showTime: !nextSameGroup,
    });
    previous = message;
  }
  return rows;
}

export default function ChatScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { showDialog } = useDialog();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const connection = useConnection((state) => state.state);
  const online = connection === 'open';

  const messages = useChat((state) => state.messages);
  const status = useChat((state) => state.status);
  const busyOrigin = useChat((state) => state.busyOrigin);
  const diff = useChat((state) => state.diff);
  const approvals = useChat((state) => state.approvals);
  const questions = useChat((state) => state.questions);
  const reasoning = useChat((state) => state.reasoning);
  const loading = useChat((state) => state.loading);
  const loadingOlder = useChat((state) => state.loadingOlder);
  const hasOlder = useChat((state) => state.hasOlder);
  const chatError = useChat((state) => state.error);

  const [showLatest, setShowLatest] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ uri: string; headers?: Record<string, string> } | null>(
    null,
  );
  const listRef = useRef<FlashListRef<Row>>(null);
  const didInitialScroll = useRef(false);
  const atBottom = useRef(true);
  const lastScrollAt = useRef(0);
  const previousStatus = useRef(status);
  const autoOpenedInput = useRef<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id),
    enabled: Boolean(id),
    initialData: () =>
      queryClient
        .getQueryData<SessionSummary[]>(['sessions'])
        ?.find((session) => session.id === id),
  });

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
    staleTime: 300_000,
  });

  const attachments = useAttachments(id, {
    maxFiles: configQuery.data?.maxFilesPerMessage ?? 10,
    maxBytes: (configQuery.data?.maxUploadMB ?? 25) * 1024 * 1024,
    maxTotalBytes: (configQuery.data?.maxUploadTotalMB ?? 100) * 1024 * 1024,
  });

  useEffect(() => {
    if (!id) return;
    didInitialScroll.current = false;
    atBottom.current = true;
    setShowLatest(false);
    void useChat.getState().load(id);
    bridgeSocket.subscribe(id);
    return () => {
      bridgeSocket.unsubscribe(id);
    };
  }, [id]);

  useEffect(() => {
    if (!didInitialScroll.current) return;
    if (!atBottom.current) return;
    const now = Date.now();
    if (now - lastScrollAt.current < 160) return;
    lastScrollAt.current = now;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, status]);

  useEffect(() => {
    if (loading || didInitialScroll.current || messages.length === 0) return;
    didInitialScroll.current = true;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [loading, messages.length]);

  useEffect(() => {
    if (previousStatus.current === 'running' && status === 'idle') hapticSuccess();
    if (previousStatus.current !== 'error' && status === 'error') hapticError();
    previousStatus.current = status;
  }, [status]);

  useEffect(() => {
    const question = questions[0];
    if (question) {
      const key = `question:${question.id}`;
      if (autoOpenedInput.current !== key) {
        autoOpenedInput.current = key;
        setApprovalOpen(false);
        setQuestionOpen(true);
        hapticWarning();
      }
      return;
    }
    const approval = approvals[0];
    if (!approval) return;
    const key = `approval:${approval.id}`;
    if (autoOpenedInput.current !== key) {
      autoOpenedInput.current = key;
      setQuestionOpen(false);
      setApprovalOpen(true);
      hapticWarning();
    }
  }, [approvals, questions]);

  const rows = useMemo(() => buildRows(messages, locale), [locale, messages]);

  const scrollToLatest = useCallback(() => {
    atBottom.current = true;
    setShowLatest(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nextAtBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < 96;
    if (nextAtBottom !== atBottom.current) {
      atBottom.current = nextAtBottom;
      setShowLatest(!nextAtBottom);
    }
  }, []);

  const openImage = useCallback((uri: string, headers?: Record<string, string>) => {
    setViewer({ uri, headers });
  }, []);

  const handleOpenFile = useCallback(
    (file: MessageFile) => {
      void openFile(file).catch((error: unknown) => {
        showDialog({
          title: t('chat.document'),
          message: error instanceof Error ? error.message : t('common.error'),
        });
      });
    },
    [showDialog, t],
  );

  const send = useCallback(
    async (text: string, delivery?: 'queue' | 'steer') => {
      const result = await useChat.getState().send({
        text,
        files: attachments.readyFiles,
        ...(delivery ? { delivery } : {}),
      });
      if (result.ok) {
        hapticLight();
        setTimeout(() => scrollToLatest(), 60);
      } else {
        hapticError();
      }
      return result;
    },
    [attachments.readyFiles, scrollToLatest],
  );

  const stop = useCallback(() => {
    hapticLight();
    void useChat.getState().stop();
  }, []);

  const retryLast = useCallback(async () => {
    const result = await useChat.getState().retryLast();
    if (result.ok) {
      hapticLight();
      setTimeout(() => scrollToLatest(), 60);
    } else {
      hapticError();
    }
    return result.ok;
  }, [scrollToLatest]);

  const decideApproval = useCallback(
    async (decision: 'once' | 'always' | 'reject') => {
      const request = approvals[0];
      if (!request) return;
      try {
        await useChat.getState().replyApproval(request.id, decision);
      } catch (error) {
        showDialog({
          title: t('approval.title'),
          message: error instanceof Error ? error.message : t('common.error'),
        });
      }
    },
    [approvals, showDialog, t],
  );

  const submitQuestion = useCallback(
    async (answers: string[][]) => {
      const question = questions[0];
      if (!question) return;
      await useChat.getState().replyQuestion(question.id, answers);
      setTimeout(() => scrollToLatest(), 80);
    },
    [questions, scrollToLatest],
  );

  const skipQuestion = useCallback(async () => {
    const question = questions[0];
    if (!question) return;
    await useChat.getState().rejectQuestion(question.id);
    setTimeout(() => scrollToLatest(), 80);
  }, [questions, scrollToLatest]);

  const confirmDelete = useCallback(() => {
    showDialog({
      title: t('sessions.delete'),
      message: t('sessions.deleteBody'),
      actions: [
        { label: t('common.cancel'), variant: 'cancel' },
        {
          label: t('common.delete'),
          variant: 'destructive',
          onPress: async () => {
            hapticMedium();
            try {
              await deleteSession(id);
              queryClient.removeQueries({ queryKey: ['session', id] });
              void queryClient.invalidateQueries({ queryKey: ['sessions'] });
              router.replace('/sessions' as never);
            } catch (error) {
              showDialog({
                title: t('sessions.delete'),
                message: error instanceof Error ? error.message : t('common.error'),
              });
            }
          },
        },
      ],
    });
  }, [id, queryClient, showDialog, t]);

  const openActions = useCallback(() => {
    showDialog({
      title: sessionQuery.data?.title || t('sessions.untitled'),
      actions: [
        ...(diff.length > 0
          ? [
              {
                label: `${t('chat.viewChanges')} · ${diff.length}`,
                onPress: () => {
                  hapticSelection();
                  router.push({ pathname: '/diff/[id]', params: { id } } as never);
                },
              },
            ]
          : []),
        { label: t('sessions.rename'), onPress: () => setRenameOpen(true) },
        { label: t('sessions.delete'), variant: 'destructive' as const, onPress: confirmDelete },
        { label: t('common.cancel'), variant: 'cancel' as const },
      ],
    });
  }, [confirmDelete, diff.length, id, sessionQuery.data?.title, showDialog, t]);

  const saveRename = useCallback(
    async (title: string) => {
      await renameSession(id, title);
      queryClient.setQueryData<SessionSummary>(['session', id], (current) =>
        current ? { ...current, title } : current,
      );
      queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) =>
        (current ?? []).map((session) => (session.id === id ? { ...session, title } : session)),
      );
      setRenameOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    [id, queryClient],
  );

  if (!id) return null;

  const statusLabel =
    status === 'running'
      ? t('sessions.running')
      : status === 'waiting_input'
        ? t('sessions.waitingInput')
        : status === 'needs_approval'
          ? t('sessions.approval')
          : status === 'error'
            ? t('sessions.error')
            : t('sessions.idle');
  const subtitle = sessionQuery.data
    ? `${basename(sessionQuery.data.directory)} · ${statusLabel}${
        status === 'running' && busyOrigin === 'telegram'
          ? ` · ${t('sessions.sourceTelegram')}`
          : ''
      }`
    : statusLabel;

  return (
    <Screen>
      <Rtl style={styles.body}>
        <ChatTopBar
          title={sessionQuery.data?.title || t('sessions.untitled')}
          subtitle={subtitle}
          onBack={() => router.back()}
          onActions={openActions}
        />
        <ConnectionBanner />

      <KeyboardAvoider
        style={styles.body}
        onOpen={() => {
          if (atBottom.current) setTimeout(() => scrollToLatest(), 80);
        }}
      >
        <View style={styles.body}>
          {loading && messages.length === 0 ? (
            <View
              style={{
                paddingHorizontal: layout.padX,
                paddingTop: 12,
                gap: layout.timelineGap,
              }}
            >
              <Skeleton
                width="58%"
                height={64}
                radius={layout.radiusM}
                style={{ alignSelf: 'flex-end' }}
              />
              <Skeleton width="72%" height={82} radius={8} />
              <Skeleton
                width="46%"
                height={54}
                radius={layout.radiusM}
                style={{ alignSelf: 'flex-end' }}
              />
            </View>
          ) : chatError && messages.length === 0 ? (
            <View style={{ padding: layout.padX }}>
              <ErrorBanner
                message={chatError}
                onRetry={() => void useChat.getState().load(id)}
                retryLabel={t('common.retry')}
                design="new"
              />
            </View>
          ) : (
            <FlashList
              ref={listRef}
              data={rows}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                if (item.kind === 'day') {
                  return (
                    <View style={styles.dayRow}>
                      <AppText variant="section" color="secondary" align="center">
                        {item.label}
                      </AppText>
                    </View>
                  );
                }
                return (
                  <MessageRow
                    message={item.message}
                    isFirstInGroup={item.isFirstInGroup}
                    showTime={item.showTime}
                    reasoning={reasoning[item.message.id]}
                    onOpenImage={openImage}
                    onOpenFile={handleOpenFile}
                    onRetry={status === 'error' ? retryLast : undefined}
                  />
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ height: layout.timelineGap }} />
              )}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: layout.padX,
                paddingTop: 12,
                paddingBottom: 20,
              }}
              ListHeaderComponent={
                hasOlder ? (
                  <View style={{ paddingVertical: theme.spacing.sm, alignItems: 'center' }}>
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={theme.colors.text2} />
                    ) : (
                      <Pressable
                        onPress={() => {
                          hapticSelection();
                          void useChat.getState().loadOlder();
                        }}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                          minHeight: 44,
                          justifyContent: 'center',
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <AppText variant="caption" color="text2">
                          {t('chat.loadOlder')}
                        </AppText>
                      </Pressable>
                    )}
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Icon name="code-slash-outline" size={layout.logo} color="textStrong" />
                  <AppText
                    variant="eyebrow12"
                    color="secondary"
                    style={{ marginTop: 20 }}
                  >
                    {t('chat.assistant')}
                  </AppText>
                  <AppText
                    variant="topBarTitle"
                    align="center"
                    style={{ marginTop: 8 }}
                  >
                    {t('chat.startTitle')}
                  </AppText>
                  <AppText
                    variant="helper"
                    color="secondary"
                    align="center"
                    style={{ marginTop: 6, maxWidth: 300 }}
                  >
                    {t('chat.empty')}
                  </AppText>
                  <View style={styles.starters}>
                    {[t('chat.startReview'), t('chat.startTests'), t('chat.startExplain')].map(
                      (prompt) => (
                        <Pressable
                          key={prompt}
                          onPress={() => {
                            hapticSelection();
                            setSeed(prompt);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={prompt}
                          style={({ pressed }) => [
                            styles.starter,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: pressed
                                ? theme.colors.surface
                                : 'transparent',
                            },
                          ]}
                        >
                          <AppText variant="body15" style={{ flex: 1 }}>
                            {prompt}
                          </AppText>
                          <Icon name="arrow-forward" size={16} color="secondary" />
                        </Pressable>
                      ),
                    )}
                  </View>
                </View>
              }
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 96 }}
            />
          )}

          {showLatest && messages.length > 0 ? (
            <Pressable
              onPress={() => {
                hapticSelection();
                scrollToLatest();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.latest')}
              hitSlop={4}
              style={({ pressed }) => [
                styles.latest,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  bottom: 12,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Icon name="arrow-down" size={16} color="textStrong" />
              <AppText variant="helper" weight="500" color="textStrong">
                {t('chat.latest')}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {questions[0] ? (
          <View style={styles.questionWrap}>
            <InlineQuestionCard
              request={questions[0]}
              collapsed={!questionOpen}
              onToggle={() => setQuestionOpen((value) => !value)}
              onSubmit={submitQuestion}
              onSkip={skipQuestion}
            />
          </View>
        ) : null}

        {questions.length === 0 && approvals.length > 0 ? (
          <Pressable
            onPress={() => {
              hapticSelection();
              setApprovalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('approval.title')}, ${approvals.length}`}
            style={({ pressed }) => [
              styles.approvalBanner,
              {
                backgroundColor: pressed ? theme.colors.surface : 'transparent',
                borderTopColor: theme.colors.divider,
                paddingHorizontal: layout.padX,
                gap: 8,
              },
            ]}
          >
            <Icon name="shield-outline" size={layout.icon} color="textStrong" />
            <AppText variant="body15" weight="500" style={{ flex: 1 }}>
              {t('approval.title')}
            </AppText>
            {approvals.length > 1 ? (
              <AppText variant="helper" color="secondary">
                {approvals.length}
              </AppText>
            ) : null}
            <Icon name="chevron-forward" size={16} color="secondary" />
          </Pressable>
        ) : null}

        <Composer
          sessionId={id}
          status={status}
          online={online}
          attachments={attachments.items}
          attachmentError={attachments.error}
          uploading={attachments.uploading}
          maxFiles={attachments.maxFiles}
          error={chatError}
          seed={seed}
          onSeedConsumed={() => setSeed(null)}
          onSend={send}
          onStop={stop}
          onPickPhotos={() => void attachments.pickPhotos()}
          onTakePhoto={() => void attachments.takePhoto()}
          onPickDocument={() => void attachments.pickDocument()}
          onRemoveAttachment={attachments.remove}
          onRetryUpload={attachments.retry}
          onSent={attachments.clear}
          onOpenImage={(uri) => openImage(uri)}
        />
      </KeyboardAvoider>
      </Rtl>

      {approvalOpen && approvals[0] && questions.length === 0 ? (
        <ApprovalSheet
          request={approvals[0]}
          onClose={() => setApprovalOpen(false)}
          onDecision={decideApproval}
        />
      ) : null}

      <RenameSheet
        visible={renameOpen}
        initial={sessionQuery.data?.title ?? ''}
        onClose={() => setRenameOpen(false)}
        onSave={saveRename}
      />

      <ImageViewer
        visible={Boolean(viewer)}
        uri={viewer?.uri ?? ''}
        headers={viewer?.headers}
        onClose={() => setViewer(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  dayRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  latest: {
    position: 'absolute',
    end: layout.padX,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  starters: {
    marginTop: 20,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  starter: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: layout.radiusS,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  approvalBanner: {
    minHeight: 44,
    borderTopWidth: layout.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionWrap: {
    paddingHorizontal: layout.padX,
    paddingBottom: 8,
  },
});
