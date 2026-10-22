import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { createSession, getConfig } from '@/api/client';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export default function NewSessionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ seed?: string | string[] }>();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 300_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workdirs = config.data?.workdirs ?? [];
  const active = selected ?? workdirs[0] ?? null;
  const directory = custom.trim()
    ? custom.trim().startsWith('/')
      ? custom.trim()
      : `${(active ?? '').replace(/\/+$/, '')}/${custom.trim().replace(/^\/+/, '')}`
    : active;

  const create = async () => {
    if (!directory || creating) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSession(directory, title.trim() || undefined);
      hapticSuccess();
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.setQueryData(['session', session.id], session);
      const seed = Array.isArray(params.seed) ? params.seed[0] : params.seed;
      router.replace({ pathname: '/chat/[id]', params: { id: session.id, ...(seed ? { seed } : {}) } } as never);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('new.failed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('new.title')} onBack={() => router.back()} />
      {config.isLoading ? (
        <View style={{ padding: theme.spacing.xl, gap: theme.spacing.md }}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                height: 56,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface1,
              }}
            />
          ))}
        </View>
      ) : config.isError ? (
        <View style={{ padding: theme.spacing.lg }}>
          <ErrorBanner
            message={t('new.failed')}
            onRetry={() => void config.refetch()}
            retryLabel={t('common.retry')}
          />
        </View>
      ) : workdirs.length === 0 ? (
        <EmptyState icon="folder-open-outline" title={t('new.noWorkdirs')} />
      ) : (
        <KeyboardAvoider>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: theme.spacing.lg,
              gap: theme.spacing.xxl,
              paddingBottom: 48,
            }}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={config.isRefetching && !config.isLoading}
                onRefresh={() => void config.refetch()}
                tintColor={theme.colors.text2}
                colors={[theme.colors.accent]}
              />
            }
          >
          <View>
            <AppText
              variant="eyebrow"
              color="text3"
              style={{ marginBottom: theme.spacing.sm }}
            >
              {t('new.workdir')}
            </AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('new.workdir')}
              style={{
                borderColor: theme.colors.line,
                borderWidth: 1,
                borderRadius: theme.radii.md,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}
            >
              {workdirs.map((workdir, index) => {
                const isActive = active === workdir;
                return (
                  <Pressable
                    key={workdir}
                    onPress={() => {
                      hapticSelection();
                      setSelected(workdir);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={workdir}
                    style={({ pressed }) => ({
                      minHeight: 58,
                      paddingHorizontal: theme.spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      backgroundColor: pressed
                        ? theme.colors.surface2
                        : isActive
                          ? theme.colors.surface1
                          : 'transparent',
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: theme.colors.line,
                    })}
                  >
                    <Icon
                      name={isActive ? 'radio-button-on' : 'radio-button-off'}
                      size="sm"
                      color={isActive ? 'text' : 'text3'}
                    />
                    <AppText variant="meta" mono numberOfLines={1} style={{ flex: 1 }}>
                      {workdir}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" color="text3" style={{ marginTop: theme.spacing.sm }}>
              {t('new.workdirHint')}
            </AppText>
          </View>

          <TextField
            label={t('new.custom')}
            value={custom}
            onChangeText={setCustom}
            placeholder="projects/my-app"
            autoCapitalize="none"
            autoCorrect={false}
            ltr
            hint={t('new.workdirHint')}
          />

          <TextField
            label={t('new.sessionTitle')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('new.titlePlaceholder')}
            maxLength={120}
            returnKeyType="done"
          />

          {directory ? (
            <View
              style={{
                backgroundColor: theme.colors.surface1,
                borderColor: theme.colors.line,
                borderWidth: 1,
                borderRadius: theme.radii.md,
                borderCurve: 'continuous',
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText variant="eyebrow" color="text3">
                {t('new.workdir')}
              </AppText>
              <AppText variant="caption" mono numberOfLines={2}>
                {directory}
              </AppText>
            </View>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            label={creating ? t('new.creating') : t('new.create')}
            onPress={() => void create()}
            loading={creating}
            disabled={!directory || creating}
            fullWidth
          />
          </ScrollView>
        </KeyboardAvoider>
      )}
    </Screen>
  );
}
