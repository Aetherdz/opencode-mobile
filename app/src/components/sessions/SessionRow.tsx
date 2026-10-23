import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SessionSummary } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { basename, formatRelative } from '@/lib/format';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { useChat } from '@/state/chat';

export const SessionRow = memo(function SessionRow({
  session,
  onPress,
  onLongPress,
}: {
  session: SessionSummary;
  onPress: (session: SessionSummary) => void;
  onLongPress: (session: SessionSummary) => void;
}) {
  const theme = useTheme();
  const selected = useChat((state) => state.sessionId === session.id);
  const { t, locale } = useI18n();
  const status =
    session.status === 'running'
      ? { label: t('sessions.running') }
      : session.status === 'waiting_input'
        ? { label: t('sessions.waitingInput') }
        : session.status === 'needs_approval'
          ? { label: t('sessions.approval') }
          : session.status === 'error'
            ? { label: t('sessions.error') }
            : null;
  const title = session.title || t('sessions.untitled');
  const folder = basename(session.directory);
  const time = formatRelative(session.lastActivity, locale);

  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress(session);
      }}
      onLongPress={() => {
        hapticSelection();
        onLongPress(session);
      }}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${folder}, ${time}${status ? `, ${status.label}` : ''}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.divider,
          backgroundColor: selected
            ? theme.colors.surface2
            : pressed
              ? theme.colors.surface
              : 'transparent',
          borderStartColor: selected ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.line}>
          <AppText variant="body15" weight="600" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          {status ? <StatusIndicator status={session.status} /> : null}
        </View>
        <View style={styles.metaLine}>
          <AppText variant="helper" color="secondary" numberOfLines={1} style={styles.folder}>
            {folder}
          </AppText>
          <AppText variant="helper" color="secondary" style={styles.time}>
            {time}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingHorizontal: layout.padX,
    paddingVertical: layout.rowPadY,
    borderBottomWidth: layout.border,
    borderStartWidth: 3,
    justifyContent: 'center',
  },
  content: { gap: 5 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { flex: 1 },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  folder: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
});
