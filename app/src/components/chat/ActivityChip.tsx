import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Activity } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useI18n } from '@/lib/i18n';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

export function ActivityChip({ activities }: { activities: Activity[] }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const running = activities.filter((activity) => activity.status === 'running');
  const failed = activities.find((activity) => activity.status === 'error');
  const latest = activities[activities.length - 1];

  if (activities.length === 0 || !latest) return null;

  const label = failed
    ? failed.title
    : running.length > 1
      ? t('chat.stepsRunning', { count: running.length })
      : running.length === 1
        ? latest.title
        : t('chat.stepsDone');
  const statusWord = failed
    ? t('chat.stepFailed')
    : running.length > 0
      ? t('chat.stepRunning')
      : t('chat.stepDone');
  const accessibleLabel =
    failed || running.length > 0
      ? `${t('chat.tools')}: ${statusWord}, ${label}`
      : `${t('chat.tools')}: ${statusWord}`;

  return (
    <View style={{ marginBottom: 10 }}>
      <Chip
        label={label}
        onPress={() => setExpanded((value) => !value)}
        expanded={expanded}
        accessibilityLabel={accessibleLabel}
        icon={
          failed ? (
            <Icon name="alert-circle-outline" size={16} color="textStrong" />
          ) : running.length > 0 ? (
            <StatusIndicator status="running" />
          ) : (
            <Icon name="checkmark" size={16} color="secondary" />
          )
        }
        trailing={
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="secondary"
          />
        }
      />

      {expanded ? (
        <View
          style={[
            styles.steps,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {activities.map((activity) => (
            <View key={activity.id} style={styles.step}>
              <View style={styles.stepHeader}>
                <Icon
                  name={
                    activity.status === 'running'
                      ? 'ellipse'
                      : activity.status === 'error'
                        ? 'alert-circle-outline'
                        : 'checkmark'
                  }
                  size={16}
                  color={activity.status === 'done' ? 'secondary' : 'textStrong'}
                  accessibilityLabel={
                    activity.status === 'error'
                      ? t('chat.stepFailed')
                      : activity.status === 'running'
                        ? t('chat.stepRunning')
                        : t('chat.stepDone')
                  }
                />
                <AppText
                  variant="mono13"
                  color="secondary"
                  mono
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {activity.name}
                </AppText>
              </View>
              <AppText variant="helper" color="secondary" numberOfLines={3}>
                {activity.title}
              </AppText>
              {activity.detail ? (
                <View
                  style={[
                    styles.detail,
                    { backgroundColor: theme.colors.raised },
                  ]}
                >
                  <AppText variant="mono13" color="secondary" mono numberOfLines={8}>
                    {activity.detail}
                  </AppText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: {
    borderWidth: layout.border,
    borderRadius: layout.radiusS,
    borderCurve: 'continuous',
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  step: { gap: 4 },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detail: {
    borderRadius: 8,
    padding: 8,
  },
});
