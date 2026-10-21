import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { getDiff } from '@/api/client';
import { DiffView } from '@/components/diff/DiffView';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useI18n } from '@/lib/i18n';
import { useChat } from '@/state/chat';
import { useTheme } from '@/theme/ThemeProvider';

export default function DiffScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const storeDiff = useChat((state) => (state.sessionId === id ? state.diff : null));
  const query = useQuery({
    queryKey: ['diff', id],
    queryFn: () => getDiff(id),
    enabled: Boolean(id),
  });
  const files = storeDiff ?? query.data ?? [];

  return (
    <Screen>
      <ScreenHeader
        title={t('diff.title')}
        subtitle={files.length === 1 ? t('diff.oneFile') : t('diff.files', { count: files.length })}
        onBack={() => router.back()}
      />
      {query.isLoading && files.length === 0 ? (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.line,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surface1,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  height: 14,
                  width: index === 1 ? '48%' : '68%',
                  borderRadius: 4,
                  backgroundColor: theme.colors.surface2,
                }}
              />
              <View
                style={{
                  height: 10,
                  width: '84%',
                  borderRadius: 4,
                  backgroundColor: theme.colors.surface2,
                }}
              />
            </View>
          ))}
        </View>
      ) : query.isError && files.length === 0 ? (
        <View style={{ padding: theme.spacing.lg }}>
          <ErrorBanner
            message={t('diff.loadError')}
            onRetry={() => void query.refetch()}
            retryLabel={t('common.retry')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.text2}
              colors={[theme.colors.accent]}
            />
          }
        >
          {files.length === 0 ? (
            <EmptyState icon="git-compare-outline" title={t('diff.empty')} />
          ) : (
            <DiffView files={files} />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
