import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationColor } from '@/theme/tokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: 'denied' | 'simulator' | 'no_project' | 'failed' };

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (!Device.isDevice) return { ok: false, reason: 'simulator' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'OpenCode',
        importance: AndroidImportance.DEFAULT,
        vibrationPattern: [0, 120],
        lightColor: notificationColor,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const id = projectId();
    if (!id) return { ok: false, reason: 'no_project' };
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { ok: true, token: token.data };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
