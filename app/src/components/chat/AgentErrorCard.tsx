import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ChatError } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export interface AgentErrorCardProps {
  error: ChatError;
  onRetry?: () => Promise<boolean>;
}

export function AgentErrorCard({ error, onRetry }: AgentErrorCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const detail = error.detail?.trim();
  const copyText = [error.code, error.message, detail].filter(Boolean).join('\n\n');
  const title = error.code === 'MessageAbortedError' ? t('chat.interrupted') : t('chat.agentError');

  const copy = async () => {
    hapticSelection();
    try {
      const saved = await Clipboard.setStringAsync(copyText, {
        android: { isSensitive: true },
      });
      if (!saved) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard failures are non-fatal; leave the label unchanged.
    }
  };

  const retry = async () => {
    if (!onRetry || retrying) return;
    hapticSelection();
    setRetrying(true);
    try {
      const ok = await onRetry();
      if (!ok) setRetrying(false);
    } catch {
      setRetrying(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          borderColor: theme.colors.line,
          backgroundColor: theme.colors.surface1,
          borderRadius: theme.radii.md,
          marginTop: theme.spacing.md,
        },
      ]}
    >
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm, flexDirection: 'row' }}>
        <Icon name="alert-circle-outline" size="sm" color="text" />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <AppText variant="meta" weight="600" style={{ flex: 1 }}>
              {title}
            </AppText>
            {error.code ? (
              <AppText variant="caption" color="text2" numberOfLines={1} style={{ flexShrink: 1 }}>
                {error.code}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color="text2" selectable>
            {error.message}
          </AppText>
        </View>
      </View>

      {detail ? (
        <Pressable
          onPress={() => {
            hapticSelection();
            setExpanded((value) => !value);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t('chat.hideErrorDetails') : t('chat.errorDetails')}
          style={({ pressed }) => [
            styles.detailsButton,
            {
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <AppText variant="caption" color="text2">
            {expanded ? t('chat.hideErrorDetails') : t('chat.errorDetails')}
          </AppText>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size="xs" color="text2" />
        </Pressable>
      ) : null}

      {expanded && detail ? (
        <View
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.surface2,
          }}
        >
          <AppText variant="caption" color="text2" mono selectable>
            {detail}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: theme.colors.line }]}>
        <Pressable
          onPress={() => void copy()}
          accessibilityRole="button"
          accessibilityLabel={copied ? t('common.copied') : t('chat.copyErrorDetails')}
          style={({ pressed }) => [
            styles.action,
            {
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Icon name={copied ? 'checkmark' : 'copy-outline'} size="xs" color="text2" />
          <AppText variant="caption" color="text2">
            {copied ? t('common.copied') : t('chat.copyErrorDetails')}
          </AppText>
        </Pressable>
        {onRetry ? (
          <Pressable
            onPress={() => void retry()}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel={retrying ? t('chat.retrying') : t('chat.retryLast')}
            accessibilityState={{ disabled: retrying, busy: retrying }}
            style={({ pressed }) => [
              styles.action,
              {
                paddingHorizontal: theme.spacing.md,
                gap: theme.spacing.xs,
                opacity: retrying ? 0.5 : pressed ? 0.65 : 1,
              },
            ]}
          >
            <Icon name="refresh-outline" size="xs" color="text2" />
            <AppText variant="caption" color="text2">
              {retrying ? t('chat.retrying') : t('chat.retryLast')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  detailsButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  actions: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
