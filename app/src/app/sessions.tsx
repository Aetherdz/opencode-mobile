import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { ApiError, deleteSession, getModels, listSessions, renameSession } from '@/api/client';
import type { ModelSelection, SessionSummary } from '@/api/types';
import { ModelSheet } from '@/components/chat/ModelSheet';
import { RenameSheet } from '@/components/sessions/RenameSheet';
import { SessionRow } from '@/components/sessions/SessionRow';
import { AppDrawer } from '@/components/nav/AppDrawer';
import { AppText } from '@/components/ui/AppText';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { useDialog } from '@/components/ui/DialogProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Rtl } from '@/components/ui/Rtl';
import { Screen } from '@/components/ui/Screen';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatSessionTitle } from '@/lib/format';
import { getStored, setStored, deleteStored } from '@/lib/storage';
import { getHiddenSessionIds, setHiddenSessionIds } from '@/lib/sessionVisibility';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettings } from '@/state/settings';

type SessionListItem =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'session'; key: string; session: SessionSummary };

const MODEL_STORAGE_KEY = 'chat.selectedModel.v1';

function SkeletonRow() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.skeleton,
        {
          borderBottomColor: theme.colors.divider,
          paddingHorizontal: layout.padX,
          paddingVertical: layout.rowPadY,
        },
      ]}
    >
      <View style={styles.skeletonLine}>
        <Skeleton width="52%" height={15} radius={4} />
        <Skeleton width={42} height={13} radius={4} />
      </View>
      <Skeleton width="34%" height={13} radius={4} style={{ marginTop: 8 }} />
    </View>
  );
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export default function SessionsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { showDialog } = useDialog();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [homePrompt, setHomePrompt] = useState('');
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const [hiddenSessionIds, setHiddenSessionIdsState] = useState<string[]>([]);
  const setThemeMode = useSettings((state) => state.setThemeMode);

  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
    // Also enabled once a model is persisted, so the chip can show its name.
    enabled: modelSheetOpen || Boolean(selectedModel),
    staleTime: 60_000,
  });

  useEffect(() => {
    let alive = true;
    void getStored(MODEL_STORAGE_KEY).then((saved) => {
      if (!alive || !saved) return;
      try {
        const parsed = JSON.parse(saved) as Partial<ModelSelection>;
        if (typeof parsed.providerID === 'string' && typeof parsed.modelID === 'string') {
          setSelectedModel({ providerID: parsed.providerID, modelID: parsed.modelID });
        }
      } catch {
        void deleteStored(MODEL_STORAGE_KEY);
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    void getHiddenSessionIds().then((ids) => {
      if (alive) setHiddenSessionIdsState(ids);
    });
    return () => { alive = false; };
  }, []);

  const selectedModelName = modelsQuery.data?.find(
    (model) => model.providerId === selectedModel?.providerID && model.modelId === selectedModel?.modelID,
  )?.name;
  const modelLoadError = modelsQuery.error;
  const modelErrorDetail =
    modelLoadError instanceof ApiError && modelLoadError.status === 404
      ? t('model.bridgeNotFound')
      : modelLoadError instanceof ApiError &&
          !['network', 'timeout', 'tls', 'secure_unreachable', 'unreachable'].some(
            (code) => code === modelLoadError.code,
          )
        ? modelLoadError.message
      : undefined;

  useEffect(() => {
    if (!modelsQuery.isSuccess || !selectedModel) return;
    const available = modelsQuery.data.some(
      (model) =>
        model.providerId === selectedModel.providerID && model.modelId === selectedModel.modelID,
    );
    if (!available) {
      setSelectedModel(null);
      void deleteStored(MODEL_STORAGE_KEY);
    }
  }, [modelsQuery.data, modelsQuery.isSuccess, selectedModel]);

  const selectModel = useCallback((model: ModelSelection | null) => {
    setSelectedModel(model);
    if (model) void setStored(MODEL_STORAGE_KEY, JSON.stringify(model));
    else void deleteStored(MODEL_STORAGE_KEY);
    setModelSheetOpen(false);
  }, []);

  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
    refetchInterval: 10_000,
  });

  const filteredSessions = useMemo(() => {
    const hidden = new Set(hiddenSessionIds);
    const list = (query.data ?? []).filter((session) => !hidden.has(session.id));
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (session) =>
        session.title.toLowerCase().includes(needle) ||
        session.directory.toLowerCase().includes(needle),
    );
  }, [hiddenSessionIds, query.data, search]);

  const listItems = useMemo<SessionListItem[]>(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = todayStart - 86_400_000;
    const today: SessionSummary[] = [];
    const yesterday: SessionSummary[] = [];
    const earlier: SessionSummary[] = [];

    for (const session of filteredSessions) {
      if (session.lastActivity >= todayStart) today.push(session);
      else if (session.lastActivity >= yesterdayStart) yesterday.push(session);
      else earlier.push(session);
    }

    const waitingRank = (session: SessionSummary) =>
      session.status === 'waiting_input' || session.status === 'needs_approval' ? 0 : 1;
    today.sort(
      (a, b) => waitingRank(a) - waitingRank(b) || b.lastActivity - a.lastActivity,
    );

    const items: SessionListItem[] = [];
    const pushGroup = (key: string, label: string, group: SessionSummary[]) => {
      if (group.length === 0) return;
      items.push({ type: 'header', key: `header-${key}`, label, count: group.length });
      for (const session of group) {
        items.push({ type: 'session', key: session.id, session });
      }
    };
    pushGroup('today', t('sessions.today'), today);
    pushGroup('yesterday', t('sessions.yesterday'), yesterday);
    pushGroup('earlier', t('sessions.earlier'), earlier);
    return items;
  }, [filteredSessions, t]);

  const confirmDelete = useCallback(
    (session: SessionSummary) => {
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
              setActionError(null);
              try {
                await deleteSession(session.id);
                queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) =>
                  (current ?? []).filter((item) => item.id !== session.id),
                );
                await queryClient.invalidateQueries({ queryKey: ['sessions'] });
              } catch (error) {
                setActionError(error instanceof Error ? error.message : t('common.error'));
              }
            },
          },
        ],
      });
    },
    [queryClient, showDialog, t],
  );

  const hideSession = useCallback(async (session: SessionSummary) => {
    const ids = [...new Set([...hiddenSessionIds, session.id])];
    setHiddenSessionIdsState(ids);
    await setHiddenSessionIds(ids);
  }, [hiddenSessionIds]);

  const openActions = useCallback(
    (session: SessionSummary) => {
      showDialog({
        title: formatSessionTitle(session.title, session.createdAt, locale),
        actions: [
          { label: t('sessions.rename'), onPress: () => setRenameTarget(session) },
          { label: t('sessions.hideLocal'), onPress: () => void hideSession(session) },
          {
            label: t('sessions.delete'),
            variant: 'destructive',
            onPress: () => confirmDelete(session),
          },
          { label: t('common.cancel'), variant: 'cancel' },
        ],
      });
    },
    [confirmDelete, hideSession, showDialog, t, locale],
  );

  const saveRename = async (title: string) => {
    if (!renameTarget) return;
    await renameSession(renameTarget.id, title);
    queryClient.setQueryData<SessionSummary[]>(['sessions'], (current) =>
      (current ?? []).map((session) =>
        session.id === renameTarget.id ? { ...session, title } : session,
      ),
    );
    queryClient.setQueryData<SessionSummary>(['session', renameTarget.id], (current) =>
      current ? { ...current, title } : current,
    );
    setRenameTarget(null);
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  };

  const openSession = useCallback((session: SessionSummary) => {
    router.push({ pathname: '/chat/[id]', params: { id: session.id } } as never);
  }, []);

  const openNewSession = useCallback(() => {
    router.push('/new-session' as never);
  }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greeting') : hour < 18 ? t('home.greetingAfternoon') : t('home.greetingEvening');

  return (
    <Screen>
      <KeyboardAvoider style={styles.flex}>
      <Rtl style={styles.flex}>
        <View style={styles.topBar}>
          <IconButton
            label={t('home.menu')}
            onPress={() => setDrawerOpen(true)}
            size="md"
            variant="borderless"
            icon={<Icon name="menu-outline" size={22} color="textStrong" />}
          />
          <View style={styles.brandTitle}>
            <Image source={require('../../assets/images/brand-mark.png')} style={styles.brandMark} accessibilityLabel="OpenCode Mobile" />
            <AppText variant="eyebrow12" color="secondary">{t('appName')}</AppText>
          </View>
          <IconButton
            label={t('home.theme')}
            onPress={() => setThemeMode(theme.scheme === 'dark' ? 'light' : 'dark')}
            size="md"
            variant="borderless"
            icon={<Icon name={theme.scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color="textStrong" />}
          />
        </View>

        <View style={styles.greeting}>
          <AppText
            variant="greeting"
            style={{ fontFamily: theme.isRTL ? undefined : theme.fonts.serif }}
            align="center"
            accessibilityRole="header"
          >
            {greeting}
          </AppText>
          <AppText variant="helper" color="secondary" align="center" style={styles.greetingSub}>
            {t('home.subtitle')}
          </AppText>
        </View>

        <View style={styles.searchWrap}>
          <TextField
            design="new"
            value={search}
            onChangeText={setSearch}
            placeholder={t('sessions.search')}
            accessibilityLabel={t('sessions.search')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            fieldMinHeight={layout.search}
            leadingAccessory={
              <Icon name="search-outline" size={layout.icon} color="secondary" />
            }
            rightAccessory={
              search ? (
                <IconButton
                  label={t('sessions.clearSearch')}
                  onPress={() => setSearch('')}
                  size="sm"
                  variant="borderless"
                  hitSlop={layout.hitSlop}
                  icon={<Icon name="close" size={layout.icon} color="secondary" />}
                />
              ) : undefined
            }
          />
        </View>

        <ConnectionBanner />

        {actionError ? (
          <View style={styles.bannerWrap}>
            <ErrorBanner
              message={actionError}
              onRetry={() => setActionError(null)}
              retryLabel={t('common.close')}
              design="new"
            />
          </View>
        ) : null}

        <FlashList
          style={styles.flex}
          data={listItems}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          renderItem={({ item, index }) => {
            if (item.type === 'header') {
              return (
                <SectionLabel
                  label={item.label}
                  count={item.count}
                  style={{
                    paddingHorizontal: layout.padX,
                    paddingTop: index === 0 ? 0 : 20,
                    paddingBottom: 6,
                  }}
                />
              );
            }
            return (
              <SessionRow
                session={item.session}
                onPress={openSession}
                onLongPress={openActions}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isLoading}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.secondary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={
            query.isError && query.data ? (
              <View style={styles.listBanner}>
                <ErrorBanner
                  message={t('sessions.loadError')}
                  onRetry={() => void query.refetch()}
                  retryLabel={t('common.retry')}
                  design="new"
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            query.isLoading ? (
              <View>
                {[0, 1, 2, 3, 4].map((index) => (
                  <SkeletonRow key={index} />
                ))}
              </View>
            ) : query.isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                title={t('sessions.loadError')}
                body={query.error instanceof Error ? query.error.message : undefined}
                action={
                  <Button
                    label={t('common.retry')}
                    variant="secondary"
                    design="new"
                    onPress={() => void query.refetch()}
                  />
                }
              />
            ) : search ? (
              <EmptyState
                icon="search-outline"
                title={t('common.search')}
                body={t('sessions.emptyHint')}
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title={t('sessions.empty')}
                body={t('sessions.emptyHint')}
                action={
                  <Button
                    label={t('sessions.new')}
                    design="new"
                    onPress={openNewSession}
                  />
                }
              />
            )
          }
        />

        <View style={styles.composerDock}>
          <View style={[styles.composerCard, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
            <TextInput
              value={homePrompt}
              onChangeText={setHomePrompt}
              placeholder={t('home.placeholder')}
              placeholderTextColor={theme.colors.placeholder}
              selectionColor={theme.colors.primary}
              accessibilityLabel={t('home.placeholder')}
              returnKeyType="send"
              onSubmitEditing={() => {
                const seed = homePrompt.trim();
                router.push({ pathname: '/new-session', params: seed ? { seed } : {} } as never);
              }}
              style={[styles.homeInput, { color: theme.colors.textStrong, textAlign: theme.isRTL ? 'right' : 'left' }]}
            />
            <Pressable
              onPress={() => {
                const seed = homePrompt.trim();
                router.push({ pathname: '/new-session', params: seed ? { seed } : {} } as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              style={({ pressed }) => [styles.sendButton, { backgroundColor: homePrompt.trim() ? theme.colors.primary : theme.colors.surface3, opacity: pressed ? 0.78 : 1 }]}
            >
              <Icon name="arrow-up" size={20} color={homePrompt.trim() ? 'onPrimary' : 'text3'} />
            </Pressable>
          </View>
          <View style={styles.dockActions}>
            <Pressable
              onPress={openNewSession}
              accessibilityRole="button"
              accessibilityLabel={t('sessions.new')}
              style={({ pressed }) => [
                styles.newChip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Icon name="add" size={16} color="textStrong" />
              <AppText variant="caption" weight="600" color="textStrong">
                {t('sessions.new')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setModelSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('model.selector')}${selectedModelName ? `: ${selectedModelName}` : ''}`}
              style={({ pressed }) => [
                styles.modelChip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.modelChipLabel}>
                {selectedModelName ?? t('model.selector')}
              </AppText>
              <Icon name="chevron-down" size={14} color="secondary" />
            </Pressable>
          </View>
        </View>
      </Rtl>
      </KeyboardAvoider>

      <RenameSheet
        visible={Boolean(renameTarget)}
        initial={renameTarget?.title ?? ''}
        onClose={() => setRenameTarget(null)}
        onSave={saveRename}
      />
      <AppDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={query.data ?? []}
      />
      <ModelSheet
        visible={modelSheetOpen}
        models={modelsQuery.data ?? []}
        selected={selectedModel}
        loading={modelsQuery.isLoading}
        failed={modelsQuery.isError}
        errorDetail={modelErrorDetail}
        onClose={() => setModelSheetOpen(false)}
        onSelect={selectModel}
        onRetry={() => void modelsQuery.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 28, height: 28, borderRadius: 7 },
  flex: { flex: 1 },
  topBar: {
    minHeight: 56,
    paddingHorizontal: layout.padX,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    minHeight: 124,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.padX,
    paddingTop: 4,
    paddingBottom: 10,
  },
  greetingSub: {
    maxWidth: 300,
    marginTop: 10,
  },
  searchWrap: {
    paddingHorizontal: layout.padX,
    marginTop: 20,
    marginBottom: 14,
  },
  bannerWrap: {
    paddingHorizontal: layout.padX,
    marginBottom: 12,
  },
  listBanner: {
    paddingHorizontal: layout.padX,
    paddingBottom: 12,
  },
  skeleton: {
    minHeight: 68,
    justifyContent: 'center',
    borderBottomWidth: layout.border,
  },
  skeletonLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerDock: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  dockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
  },
  newChip: {
    minHeight: layout.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  modelChip: {
    minHeight: layout.chip,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  modelChipLabel: { flexShrink: 1 },
  homeInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 6,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});
