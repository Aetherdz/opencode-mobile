import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { bridgeSocket, useConnection } from '@/api/ws';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export function ConnectionBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  const state = useConnection((value) => value.state);
  if (state !== 'reconnecting' && state !== 'offline') return null;

  const isReconnecting = state === 'reconnecting';
  const bannerBg = isReconnecting
    ? 'rgba(245, 158, 11, 0.12)'
    : 'rgba(239, 68, 68, 0.12)';
  const bannerBorder = isReconnecting ? '#F59E0B' : '#EF4444';
  const textColor = isReconnecting ? '#D97706' : '#DC2626';

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        hapticSelection();
        bridgeSocket.reconnect();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${isReconnecting ? t('chat.reconnect') : t('chat.offline')}. ${t('chat.reconnectNow')}`}
      accessibilityHint={t('chat.reconnectNow')}
      accessibilityState={{ busy: isReconnecting }}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: pressed ? (isReconnecting ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)') : bannerBg,
          borderBottomColor: bannerBorder,
          borderBottomWidth: 1,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: bannerBorder }]} />
      {isReconnecting ? (
        <ActivityIndicator size="small" color={bannerBorder} />
      ) : (
        <Icon name="cloud-offline" size="sm" color="danger" />
      )}
      <AppText variant="caption" weight="600" style={{ color: textColor, flex: 1 }}>
        {state === 'offline' ? t('chat.offline') : t('chat.reconnect')}
      </AppText>
      <AppText variant="caption" color="text3">
        {t('common.retry')}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
