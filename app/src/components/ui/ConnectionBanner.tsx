import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { bridgeSocket, useConnection } from '@/api/ws';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';

export function ConnectionBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  const state = useConnection((value) => value.state);
  if (state !== 'reconnecting' && state !== 'offline') return null;
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        bridgeSocket.reconnect();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${state === 'offline' ? t('chat.offline') : t('chat.reconnect')}. ${t('chat.reconnectNow')}`}
      accessibilityHint={t('chat.reconnectNow')}
      accessibilityState={{ busy: state === 'reconnecting' }}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface1,
          borderBottomColor: theme.colors.line,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      {state === 'reconnecting' ? (
        <ActivityIndicator size="small" color={theme.colors.text2} />
      ) : (
        <Icon name="cloud-offline-outline" size="sm" color="text2" />
      )}
      <AppText variant="caption" color="text2">
        {state === 'offline' ? t('chat.offline') : t('chat.reconnect')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
