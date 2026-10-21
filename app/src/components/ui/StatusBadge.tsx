import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import type { SessionStatus, SessionSource } from '@/api/types';
import { AppText } from './AppText';

export function StatusBadge({ status }: { status: SessionStatus }) {
  const theme = useTheme();
  const { t } = useI18n();
  const config: Record<SessionStatus, { key: string; color: string; dot: string }> = {
    idle: { key: 'sessions.idle', color: theme.colors.text3, dot: theme.colors.text3 },
    running: { key: 'sessions.running', color: theme.colors.accent, dot: theme.colors.accent },
    needs_approval: {
      key: 'sessions.approval',
      color: theme.colors.text,
      dot: theme.colors.accent,
    },
    waiting_input: {
      key: 'sessions.waitingInput',
      color: theme.colors.text,
      dot: theme.colors.accent,
    },
    error: { key: 'sessions.error', color: theme.colors.danger, dot: theme.colors.danger },
  };
  const item = config[status];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme.colors.surface2, borderColor: theme.colors.line },
      ]}
      accessible
      accessibilityLabel={t(item.key)}
    >
      <View style={[styles.dot, { backgroundColor: item.dot }]} />
      <AppText variant="caption" style={{ color: item.color }}>
        {t(item.key)}
      </AppText>
    </View>
  );
}

export function SourceBadge({ source }: { source: SessionSource }) {
  const { t } = useI18n();
  const key =
    source === 'app'
      ? 'sessions.sourceApp'
      : source === 'telegram'
        ? 'sessions.sourceTelegram'
        : source === 'both'
          ? 'sessions.sourceBoth'
          : 'sessions.sourceUnknown';
  if (source === 'unknown') return null;
  return (
    <AppText variant="caption" color="text3" numberOfLines={1}>
      {t(key)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
