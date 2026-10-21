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
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.divider,
          backgroundColor: pressed ? theme.colors.surface : 'transparent',
        },
      ]}
    >
      <View style={styles.line}>
        <AppText variant="body15" weight="500" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        <AppText variant="helper" color="secondary" style={styles.time}>
          {time}
        </AppText>
      </View>
      <View style={[styles.line, styles.secondLine]}>
        <View style={styles.folderWrap}>
          <AppText
            variant="mono13"
            color="secondary"
            mono
            numberOfLines={1}
            style={styles.folder}
          >
            {folder}
          </AppText>
        </View>
        {status ? (
          <View style={styles.status}>
            <StatusIndicator status={session.status} />
            <AppText variant="helper" color="textStrong" numberOfLines={1}>
              {status.label}
            </AppText>
          </View>
        ) : null}
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
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondLine: {
    marginTop: 4,
  },
  title: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
  folderWrap: { flex: 1, alignItems: 'flex-start' },
  folder: { flexShrink: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
});
