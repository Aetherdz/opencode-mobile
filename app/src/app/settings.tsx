import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { registerPushToken, unregisterPushToken } from '@/api/client';
import { bridgeSocket } from '@/api/ws';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/DialogProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { hapticError, hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { registerForPushNotifications } from '@/lib/notifications';
import { useAuth } from '@/state/auth';
import { useSettings, type ThemeMode } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

function Section({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <AppText
      variant="eyebrow"
      color="text3"
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xxl,
        paddingBottom: theme.spacing.sm,
      }}
    >
      {title}
    </AppText>
  );
}

function Row({
  label,
  description,
  right,
  onPress,
  last = false,
}: {
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
          borderBottomColor: theme.colors.line,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
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
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.surface1 : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { showDialog } = useDialog();
  const themeMode = useSettings((state) => state.themeMode);
  const haptics = useSettings((state) => state.haptics);
  const notifications = useSettings((state) => state.notifications);
  const setThemeMode = useSettings((state) => state.setThemeMode);
  const setHaptics = useSettings((state) => state.setHaptics);
  const setNotifications = useSettings((state) => state.setNotifications);
  const baseUrl = useAuth((state) => state.baseUrl);
  const clearAuth = useAuth((state) => state.clear);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const setTheme = (mode: ThemeMode) => {
    hapticSelection();
    setThemeMode(mode);
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (pushBusy) return;
    if (!enabled) {
      setNotifications(false);
      if (pushToken) {
        void unregisterPushToken(pushToken).catch(() => undefined);
        setPushToken(null);
      }
      hapticSelection();
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
        showDialog({ title: t('settings.notifications'), message: t(reasonKey) });
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

  const themes: ThemeMode[] = ['dark', 'light', 'system'];

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} onBack={() => router.back()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
        <Section title={t('settings.appearance')} />
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              borderColor: theme.colors.line,
              borderWidth: 1,
              borderRadius: theme.radii.md,
              borderCurve: 'continuous',
              backgroundColor: theme.colors.surface1,
              overflow: 'hidden',
            }}
          >
            {themes.map((mode) => {
              const selected = themeMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setTheme(mode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected
                      ? theme.colors.surface3
                      : pressed
                        ? theme.colors.surface2
                        : 'transparent',
                  })}
                >
                  <AppText
                    variant="meta"
                    weight={selected ? '500' : '400'}
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

        <Section title={t('settings.behavior')} />
        <Row
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
              trackColor={{ false: theme.colors.surface3, true: theme.colors.accent }}
              thumbColor={haptics ? theme.colors.onAccent : theme.colors.text2}
            />
          }
        />
        <Row
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
              trackColor={{ false: theme.colors.surface3, true: theme.colors.accent }}
              thumbColor={notifications ? theme.colors.onAccent : theme.colors.text2}
            />
          }
        />

        <Section title={t('settings.connection')} />
        <Row label={t('settings.bridge')} description={baseUrl} />
        <Row label={t('settings.token')} description={t('settings.tokenBody')} last />
        <View style={{ padding: theme.spacing.lg }}>
          <Button label={t('settings.disconnect')} variant="danger" onPress={disconnect} fullWidth />
        </View>

        <Section title={t('settings.about')} />
        <Row
          label={t('settings.version')}
          description={`${t('appName')} ${Constants.expoConfig?.version ?? '1.0.0'}`}
          last
        />
        <View style={{ padding: theme.spacing.lg }}>
          <AppText variant="caption" color="text3">
            {t('settings.securityNote')}
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
