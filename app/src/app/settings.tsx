import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  getConfig,
  getModels,
  listSessions,
  registerPushToken,
  unregisterPushToken,
} from '@/api/client';
import type { ModelSelection } from '@/api/types';
import { bridgeSocket, useConnection } from '@/api/ws';
import { ModelSheet } from '@/components/chat/ModelSheet';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/DialogProvider';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Rtl } from '@/components/ui/Rtl';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatSessionTitle } from '@/lib/format';
import { hapticError, hapticSelection, hapticSuccess } from '@/lib/haptics';
import { translate, useI18n } from '@/lib/i18n';
import { registerForPushNotifications } from '@/lib/notifications';
import { getHiddenSessionIds, setHiddenSessionIds } from '@/lib/sessionVisibility';
import { deleteStored, getStored, setStored } from '@/lib/storage';
import { useAuth } from '@/state/auth';
import { useSettings, type Locale, type ThemeMode } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const MODEL_STORAGE_KEY = 'chat.selectedModel.v1';

function CategoryCard({
  icon,
  iconBg,
  iconColor = '#FFFFFF',
  title,
  subtitle,
  badge,
  children,
}: {
  icon: IconName;
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}>
          <View style={[styles.categoryIconBadge, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="600" color="textStrong">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" color="text3">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        {badge}
      </View>
      <View
        style={[
          styles.cardBox,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            marginHorizontal: theme.spacing.lg,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  iconBg,
  iconColor = '#FFFFFF',
  label,
  description,
  right,
  onPress,
  last = false,
}: {
  icon?: IconName;
  iconBg?: string;
  iconColor?: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.divider,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        },
      ]}
    >
      {icon && iconBg ? (
        <View style={[styles.rowIconBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="500">
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color="text3" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.surface2 : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { showDialog } = useDialog();
  const themeMode = useSettings((state) => state.themeMode);
  const haptics = useSettings((state) => state.haptics);
  const notifications = useSettings((state) => state.notifications);
  const setThemeMode = useSettings((state) => state.setThemeMode);
  const setLocale = useSettings((state) => state.setLocale);
  const setHaptics = useSettings((state) => state.setHaptics);
  const setNotifications = useSettings((state) => state.setNotifications);
  const baseUrl = useAuth((state) => state.baseUrl);
  const clearAuth = useAuth((state) => state.clear);

  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [showBridgeUrl, setShowBridgeUrl] = useState(false);
  const [hiddenSessionIds, setHiddenSessionIdsState] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);

  const connectionState = useConnection((value) => value.state);

  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
    staleTime: 60_000,
  });

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
    staleTime: 300_000,
  });

  const hiddenSessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
    enabled: hiddenSessionIds.length > 0,
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
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void getHiddenSessionIds().then((ids) => {
      if (alive) setHiddenSessionIdsState(ids);
    });
    return () => {
      alive = false;
    };
  }, []);

  const restoreHiddenSession = async (sessionId: string) => {
    const ids = hiddenSessionIds.filter((id) => id !== sessionId);
    setHiddenSessionIdsState(ids);
    await setHiddenSessionIds(ids);
  };

  const listedHiddenIds = new Set((hiddenSessionsQuery.data ?? []).map((session) => session.id));
  const orphanedHiddenIds = hiddenSessionsQuery.isSuccess
    ? hiddenSessionIds.filter((id) => !listedHiddenIds.has(id))
    : [];

  const setTheme = (mode: ThemeMode) => {
    hapticSelection();
    setThemeMode(mode);
  };

  const selectModel = (model: ModelSelection | null) => {
    setSelectedModel(model);
    if (model) void setStored(MODEL_STORAGE_KEY, JSON.stringify(model));
    else void deleteStored(MODEL_STORAGE_KEY);
    hapticSelection();
  };

  const setArgon4 = () => {
    const argonModel: ModelSelection = {
      providerID: 'google',
      modelID: 'antigravity-gemini-4-argon',
    };
    setSelectedModel(argonModel);
    void setStored(MODEL_STORAGE_KEY, JSON.stringify(argonModel));
    hapticSuccess();
  };

  const isArgon4Active =
    selectedModel?.providerID === 'google' &&
    selectedModel.modelID.toLowerCase().includes('argon');

  const selectedModelName = modelsQuery.data?.find(
    (model) => model.providerId === selectedModel?.providerID && model.modelId === selectedModel?.modelID,
  )?.name;

  const toggleNotifications = async (enabled: boolean) => {
    if (pushBusy) return;
    if (!enabled) {
      setPushBusy(true);
      setNotifications(false);
      try {
        let token = pushToken;
        if (!token) {
          const registration = await registerForPushNotifications();
          token = registration.ok ? registration.token : null;
        }
        if (token) {
          await unregisterPushToken(token).catch(() => undefined);
          setPushToken(null);
        }
        hapticSelection();
      } finally {
        setPushBusy(false);
      }
      return;
    }
    setPushBusy(true);
    try {
      const registration = await registerForPushNotifications();
      if (!registration.ok) {
        hapticError();
        const reasonKey =
          registration.reason === 'denied'
            ? 'settings.pushDenied'
            : registration.reason === 'simulator'
              ? 'settings.pushSimulator'
              : registration.reason === 'no_project'
                ? 'settings.pushNoProject'
                : 'settings.pushFailed';
        const message = t(reasonKey);
        const actions: any[] = [{ label: t('common.cancel'), variant: 'cancel' }];
        if (registration.reason === 'denied') {
          actions.unshift({
            label: t('common.openSettings'),
            variant: 'primary',
            onPress: () => {
              void Linking.openSettings().catch(() => undefined);
            },
          });
        }
        showDialog({ title: t('settings.notifications'), message, actions });
        return;
      }
      await registerPushToken(
        registration.token,
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
      );
      setPushToken(registration.token);
      setNotifications(true);
      hapticSuccess();
    } catch (error) {
      hapticError();
      showDialog({
        title: t('settings.notifications'),
        message: error instanceof Error ? error.message : t('settings.pushFailed'),
      });
    } finally {
      setPushBusy(false);
    }
  };

  const disconnect = () => {
    showDialog({
      title: t('settings.disconnect'),
      message: t('settings.disconnectBody'),
      actions: [
        { label: t('common.cancel'), variant: 'cancel' },
        {
          label: t('settings.disconnect'),
          variant: 'destructive',
          onPress: () => {
            bridgeSocket.disconnect();
            void clearAuth().then(() => {
              router.replace('/connect' as never);
            });
          },
        },
      ],
    });
  };

  const themes: { mode: ThemeMode; icon: IconName }[] = [
    { mode: 'dark', icon: 'moon-outline' },
    { mode: 'light', icon: 'sunny-outline' },
    { mode: 'system', icon: 'phone-portrait-outline' },
  ];

  const workdirs = configQuery.data?.workdirs ?? [];

  return (
    <Screen>
      <Rtl style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.title')} onBack={() => router.back()} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: theme.spacing.md, paddingBottom: 56 }}>
          {/* AI AGENT & TASKS / ARGON 4 */}
          <CategoryCard
            icon="flash"
            iconBg="#F59E0B"
            title={t('settings.modelTitle')}
            subtitle={t('settings.modelHint')}
            badge={
              isArgon4Active ? (
                <View style={styles.activePill}>
                  <View style={[styles.pulseDot, { backgroundColor: '#F59E0B' }]} />
                  <AppText variant="caption" weight="600" style={{ color: '#D97706' }}>
                    Argon 4
                  </AppText>
                </View>
              ) : null
            }
          >
            {/* Quick Argon 4 Preset Card */}
            <Pressable
              onPress={setArgon4}
              accessibilityRole="button"
              accessibilityLabel={t('settings.argon4Action')}
              style={({ pressed }) => [
                styles.argonCard,
                {
                  backgroundColor: isArgon4Active ? 'rgba(245, 158, 11, 0.12)' : theme.colors.surface2,
                  borderColor: isArgon4Active ? '#F59E0B' : theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.argonIconBox, { backgroundColor: isArgon4Active ? '#F59E0B' : '#E2E8F0' }]}>
                <Ionicons name="flash" size={18} color={isArgon4Active ? '#FFFFFF' : '#64748B'} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppText variant="body" weight="700">
                    Gemini 4 Argon
                  </AppText>
                  <View style={styles.proTag}>
                    <AppText variant="caption" weight="700" style={{ color: '#D97706', fontSize: 10 }}>
                      AGY
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color="text3">
                  Google · High Reasoning · Tasks & Coding
                </AppText>
              </View>
              <View
                style={[
                  styles.argonActionBtn,
                  {
                    backgroundColor: isArgon4Active ? '#10B981' : theme.colors.primary,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: isArgon4Active ? '#FFFFFF' : theme.colors.onPrimary }}
                >
                  {isArgon4Active ? 'Active' : t('settings.argon4Action')}
                </AppText>
              </View>
            </Pressable>

            {/* Choose Other Models */}
            <SettingsRow
              icon="layers-outline"
              iconBg="#8B5CF6"
              label={t('model.selector')}
              description={selectedModelName ?? (selectedModel ? selectedModel.modelID : t('model.default'))}
              onPress={() => setModelSheetOpen(true)}
              right={<Icon name="chevron-forward" size={16} color="text3" />}
              last
            />
          </CategoryCard>

          {/* APPEARANCE */}
          <CategoryCard icon="color-palette" iconBg="#6366F1" title={t('settings.appearance')}>
            <View style={{ padding: theme.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  borderColor: theme.colors.line,
                  borderWidth: 1,
                  borderRadius: theme.radii.md,
                  borderCurve: 'continuous',
                  backgroundColor: theme.colors.surface2,
                  overflow: 'hidden',
                }}
              >
                {themes.map(({ mode, icon }) => {
                  const selected = themeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setTheme(mode)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 46,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: selected
                          ? theme.colors.surface3
                          : pressed
                            ? theme.colors.surface1
                            : 'transparent',
                      })}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={selected ? theme.colors.primary : theme.colors.text3}
                      />
                      <AppText
                        variant="meta"
                        weight={selected ? '600' : '400'}
                        color={selected ? 'text' : 'text3'}
                      >
                        {mode === 'dark'
                          ? t('settings.dark')
                          : mode === 'light'
                            ? t('settings.light')
                            : t('settings.system')}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </CategoryCard>

          {/* LANGUAGE */}
          <CategoryCard icon="globe" iconBg="#0EA5E9" title={t('settings.language')}>
            <View style={{ padding: theme.spacing.md }}>
              <View
                style={[
                  styles.localeGroup,
                  {
                    borderColor: theme.colors.line,
                    backgroundColor: theme.colors.surface2,
                  },
                ]}
              >
                {(['en', 'ar', 'fr'] as Locale[]).map((code) => {
                  const selected = locale === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => {
                        hapticSelection();
                        const nextRtl = code === 'ar';
                        setLocale(code);
                        if (Platform.OS !== 'web' && nextRtl !== (locale === 'ar')) {
                          showDialog({
                            title: translate(code, 'settings.language'),
                            message: translate(
                              code,
                              nextRtl ? 'settings.rtlRestart' : 'settings.ltrRestart',
                            ),
                          });
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.localeButton,
                        {
                          backgroundColor: selected
                            ? theme.colors.surface3
                            : pressed
                              ? theme.colors.surface1
                              : 'transparent',
                        },
                      ]}
                    >
                      <AppText
                        variant="meta"
                        weight={selected ? '600' : '400'}
                        color={selected ? 'text' : 'text3'}
                      >
                        {code === 'en'
                          ? t('settings.english')
                          : code === 'ar'
                            ? t('settings.arabic')
                            : t('settings.french')}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </CategoryCard>

          {/* BEHAVIOR */}
          <CategoryCard icon="options" iconBg="#EC4899" title={t('settings.behavior')}>
            <SettingsRow
              icon="phone-portrait-outline"
              iconBg="#F43F5E"
              label={t('settings.haptics')}
              description={t('settings.hapticsBody')}
              right={
                <Switch
                  value={haptics}
                  accessibilityLabel={t('settings.haptics')}
                  accessibilityHint={t('settings.hapticsBody')}
                  onValueChange={(value) => {
                    setHaptics(value);
                    if (value) hapticSelection();
                  }}
                  trackColor={{ false: theme.colors.surface3, true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <SettingsRow
              icon="notifications-outline"
              iconBg="#10B981"
              label={t('settings.notifications')}
              description={t('settings.notificationsBody')}
              last
              right={
                <Switch
                  value={notifications}
                  disabled={pushBusy}
                  accessibilityLabel={t('settings.notifications')}
                  accessibilityHint={t('settings.notificationsBody')}
                  onValueChange={(value) => void toggleNotifications(value)}
                  trackColor={{ false: theme.colors.surface3, true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </CategoryCard>

          {/* ALLOWED WORKSPACES */}
          <CategoryCard
            icon="folder-open"
            iconBg="#8B5CF6"
            title={t('settings.workdirsTitle')}
            subtitle={t('settings.workdirsHint')}
            badge={
              <View style={[styles.activePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                <AppText variant="caption" weight="600" style={{ color: '#10B981' }}>
                  {t('settings.workdirsScoped')}
                </AppText>
              </View>
            }
          >
            {workdirs.length === 0 ? (
              <SettingsRow label={t('new.noWorkdirs')} last />
            ) : (
              workdirs.map((dir, idx) => (
                <SettingsRow
                  key={dir}
                  icon="folder-outline"
                  iconBg="#8B5CF6"
                  label={dir}
                  last={idx === workdirs.length - 1}
                />
              ))
            )}
          </CategoryCard>

          {/* CONNECTION */}
          <CategoryCard
            icon="shield-checkmark"
            iconBg="#14B8A6"
            title={t('settings.connection')}
            badge={
              <View
                style={[
                  styles.activePill,
                  {
                    backgroundColor:
                      connectionState === 'open'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : connectionState === 'reconnecting'
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.pulseDot,
                    {
                      backgroundColor:
                        connectionState === 'open'
                          ? '#10B981'
                          : connectionState === 'reconnecting'
                            ? '#F59E0B'
                            : '#EF4444',
                    },
                  ]}
                />
                <AppText
                  variant="caption"
                  weight="600"
                  style={{
                    color:
                      connectionState === 'open'
                        ? '#10B981'
                        : connectionState === 'reconnecting'
                          ? '#D97706'
                          : '#DC2626',
                  }}
                >
                  {connectionState === 'open'
                    ? 'Connected'
                    : connectionState === 'reconnecting'
                      ? 'Reconnecting'
                      : 'Offline'}
                </AppText>
              </View>
            }
          >
            <SettingsRow
              icon="link-outline"
              iconBg="#14B8A6"
              label={t('settings.bridge')}
              description={showBridgeUrl ? baseUrl : '•'.repeat(24)}
              right={
                <Pressable
                  onPress={() => setShowBridgeUrl(!showBridgeUrl)}
                  accessibilityRole="button"
                  accessibilityLabel={showBridgeUrl ? t('common.hide') : t('common.show')}
                  hitSlop={8}
                >
                  <AppText variant="meta" color="accent" weight="600">
                    {showBridgeUrl ? t('common.hide') : t('common.show')}
                  </AppText>
                </Pressable>
              }
            />
            <SettingsRow
              icon="key-outline"
              iconBg="#64748B"
              label={t('settings.token')}
              description={t('settings.tokenBody')}
              last
            />
            <View style={{ padding: theme.spacing.md }}>
              <Button label={t('settings.disconnect')} variant="danger" onPress={disconnect} fullWidth />
            </View>
          </CategoryCard>

          {/* HIDDEN SESSIONS */}
          <CategoryCard icon="eye-off" iconBg="#64748B" title={t('settings.hiddenSessions')}>
            {hiddenSessionIds.length === 0 ? (
              <SettingsRow label={t('settings.noHiddenSessions')} last />
            ) : (
              <>
                <View
                  style={{
                    alignItems: 'flex-end',
                    paddingHorizontal: theme.spacing.md,
                    paddingTop: theme.spacing.sm,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setHiddenSessionIdsState([]);
                      void setHiddenSessionIds([]);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('sessions.restoreAll')}
                    hitSlop={8}
                  >
                    <AppText variant="meta" color="accent" weight="600">
                      {t('sessions.restoreAll')}
                    </AppText>
                  </Pressable>
                </View>
                {(hiddenSessionsQuery.data ?? [])
                  .filter((session) => hiddenSessionIds.includes(session.id))
                  .map((session, idx, arr) => (
                    <SettingsRow
                      key={session.id}
                      icon="chatbubble-outline"
                      iconBg="#64748B"
                      label={formatSessionTitle(session.title, session.createdAt, locale)}
                      description={session.directory}
                      last={idx === arr.length - 1 && orphanedHiddenIds.length === 0}
                      right={
                        <Pressable
                          onPress={() => void restoreHiddenSession(session.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('sessions.restore')}: ${formatSessionTitle(session.title, session.createdAt, locale)}`}
                          hitSlop={8}
                        >
                          <AppText variant="meta" color="accent" weight="600">
                            {t('sessions.restore')}
                          </AppText>
                        </Pressable>
                      }
                    />
                  ))}
                {orphanedHiddenIds.map((sessionId, idx) => (
                  <SettingsRow
                    key={sessionId}
                    label={t('settings.hiddenSessionUnavailable')}
                    last={idx === orphanedHiddenIds.length - 1}
                    right={
                      <Pressable
                        onPress={() => void restoreHiddenSession(sessionId)}
                        accessibilityRole="button"
                        accessibilityLabel={t('sessions.restore')}
                        hitSlop={8}
                      >
                        <AppText variant="meta" color="accent" weight="600">
                          {t('sessions.restore')}
                        </AppText>
                      </Pressable>
                    }
                  />
                ))}
              </>
            )}
          </CategoryCard>

          {/* ABOUT */}
          <CategoryCard icon="information-circle" iconBg="#3B82F6" title={t('settings.about')}>
            <SettingsRow
              icon="hardware-chip-outline"
              iconBg="#3B82F6"
              label={t('settings.version')}
              description={`${t('appName')} ${Constants.expoConfig?.version ?? '1.0.0-beta.11'}`}
              last
            />
            <View style={{ padding: theme.spacing.md }}>
              <AppText variant="caption" color="text3">
                {t('settings.securityNote')}
              </AppText>
            </View>
          </CategoryCard>
        </ScrollView>
      </Rtl>

      <ModelSheet
        visible={modelSheetOpen}
        models={modelsQuery.data ?? []}
        selected={selectedModel}
        loading={modelsQuery.isLoading}
        failed={modelsQuery.isError}
        onClose={() => setModelSheetOpen(false)}
        onSelect={selectModel}
        onRetry={() => void modelsQuery.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  argonCard: {
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  argonIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  argonActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  localeGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  localeButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
