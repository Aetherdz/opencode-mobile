import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { fileIcon } from '@/lib/fileIcon';
import { Icon } from '@/components/ui/Icon';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing, type ThemeColors } from '@/theme/tokens';

function formatSize(size?: number): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) {
    const kilobytes = size / 1024;
    return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
  }
  const megabytes = size / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
      minHeight: 44,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    chipPending: {
      backgroundColor: colors.surface1,
      borderColor: colors.line,
    },
    chipSent: {
      backgroundColor: colors.surface2,
      borderColor: colors.line,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      minHeight: 44,
      minWidth: 44,
      gap: spacing.sm,
    },
    contentPressed: { opacity: 0.68 },
    icon: { flexShrink: 0 },
    name: {
      flexShrink: 1,
      fontSize: 13,
      lineHeight: 18,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    size: {
      flexShrink: 0,
      fontSize: 12,
      lineHeight: 16,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
    removeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.sm,
    },
    removePressed: { backgroundColor: colors.surface3 },
  });

export function FileChip(props: {
  name: string;
  mime?: string;
  size?: number;
  onPress?: () => void;
  onRemove?: () => void;
  variant?: 'pending' | 'sent';
}): React.ReactElement {
  const { name, mime, size, onPress, onRemove, variant = 'pending' } = props;
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const sizeLabel = formatSize(size);
  const accessibilityLabel = sizeLabel ? `${name}, ${sizeLabel}` : name;
  const iconName = fileIcon(name, mime);

  const body = (
    <>
      <Icon name={iconName} size="xs" color="text2" style={styles.icon} />
      <AppText
        variant="label"
        numberOfLines={1}
        ellipsizeMode="middle"
        style={styles.name}
      >
        {name}
      </AppText>
      {sizeLabel ? (
        <AppText variant="caption" color="text3" numberOfLines={1} style={styles.size}>
          {sizeLabel}
        </AppText>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.chip,
        variant === 'sent' ? styles.chipSent : styles.chipPending,
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={() => {
            hapticSelection();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => [
            styles.content,
            pressed && styles.contentPressed,
          ]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.content}>{body}</View>
      )}

      {onRemove ? (
        <Pressable
          onPress={() => {
            hapticSelection();
            onRemove();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('chat.removeAttachment')}: ${name}`}
          style={({ pressed }) => [styles.removeButton, pressed && styles.removePressed]}
        >
          <Icon name="close" size="xs" color="text2" />
        </Pressable>
      ) : null}
    </View>
  );
}
