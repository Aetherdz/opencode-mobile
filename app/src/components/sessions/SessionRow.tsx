import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SessionSummary } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { basename, formatRelative, formatSessionTitle } from '@/lib/format';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
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
  const title = formatSessionTitle(session.title, session.createdAt, locale);
  const folder = basename(session.directory);
  const time = formatRelative(session.lastActivity, locale);

  return (
    <PressableScale
      onPress={() => {
        hapticSelection();
        onPress(session);
      }}
      onLongPress={() => {
        hapticSelection();
        onLongPress(session);
      }}
      delayLongPress={350}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${folder}, ${time}${status ? `, ${status.label}` : ''}`}
      accessibilityState={{ selected }}
      style={[
        styles.row,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.surface2
            : theme.colors.surface,
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
            📁 {folder}
          </AppText>
          <AppText variant="helper" color="secondary" style={styles.time}>
            {time}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    justifyContent: 'center',
  },
  content: { gap: 6 },
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
