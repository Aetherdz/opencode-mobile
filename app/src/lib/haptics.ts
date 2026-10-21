import * as Haptics from 'expo-haptics';
import { useSettings } from '@/state/settings';

function enabled(): boolean {
  return useSettings.getState().haptics;
}

export function hapticLight(): void {
  if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function hapticSelection(): void {
  if (enabled()) void Haptics.selectionAsync().catch(() => undefined);
}

export function hapticSuccess(): void {
  if (enabled()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }
}

export function hapticError(): void {
  if (enabled()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }
}

export function hapticWarning(): void {
  if (enabled()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }
}

export function hapticMedium(): void {
  if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}
