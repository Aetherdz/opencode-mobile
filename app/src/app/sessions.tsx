import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { deleteSession, listSessions, renameSession } from '@/api/client';
import type { SessionSummary } from '@/api/types';
import { RenameSheet } from '@/components/sessions/RenameSheet';
import { SessionRow } from '@/components/sessions/SessionRow';
import { AppText } from '@/components/ui/AppText';
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
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

type SessionListItem =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'session'; key: string; session: SessionSummary };

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
  const { t } = useI18n();
  const { showDialog } = useDialog();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
    refetchInterval: 10_000,
  });

  const filteredSessions = useMemo(() => {
    const list = query.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (session) =>
        session.title.toLowerCase().includes(needle) ||
        session.directory.toLowerCase().includes(needle),
    );
  }, [query.data, search]);

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

  const openActions = useCallback(
    (session: SessionSummary) => {
      showDialog({
        title: session.title || t('sessions.untitled'),
        actions: [
          { label: t('sessions.rename'), onPress: () => setRenameTarget(session) },
          {
            label: t('sessions.delete'),
            variant: 'destructive',
            onPress: () => confirmDelete(session),
          },
          { label: t('common.cancel'), variant: 'cancel' },
        ],
      });
    },
    [confirmDelete, showDialog, t],
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

  const openSettings = useCallback(() => {
    router.push('/settings' as never);
  }, []);
  const openNewSession = useCallback(() => {
    router.push('/new-session' as never);
  }, []);

  return (
    <Screen>
      <Rtl style={styles.flex}>
        <View style={styles.header}>
          <AppText variant="eyebrow12" color="secondary">
            {t('appName')}
          </AppText>
          <AppText
            variant="sessionsTitle"
            style={{ marginTop: 6 }}
            accessibilityRole="header"
          >
            {t('sessions.title')}
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
          contentContainerStyle={{ paddingBottom: 20 }}
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

        <View
          style={[
            styles.bar,
            {
              backgroundColor: theme.colors.bg,
              borderTopColor: theme.colors.divider,
            },
          ]}
        >
          <IconButton
            label={t('sessions.settings')}
            onPress={openSettings}
            size="lg"
            variant="surface"
            hitSlop={layout.hitSlop}
            icon={<Icon name="settings-outline" size={layout.icon} color="textStrong" />}
          />
          <Button
            design="new"
            size="sm"
            shape="pill"
            label={t('sessions.new')}
            onPress={openNewSession}
            icon={<Icon name="add" size={layout.icon} color="onPrimary" />}
          />
        </View>
      </Rtl>

      <RenameSheet
        visible={Boolean(renameTarget)}
        initial={renameTarget?.title ?? ''}
        onClose={() => setRenameTarget(null)}
        onSave={saveRename}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: layout.padX,
    paddingTop: 12,
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: layout.border,
    paddingHorizontal: layout.padX,
    paddingVertical: 12,
  },
});
