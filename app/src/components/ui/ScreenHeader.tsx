import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  showBorder?: boolean;
}

export function ScreenHeader({ title, subtitle, onBack, right, showBorder = true }: ScreenHeaderProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.root,
        {
          borderBottomColor: theme.colors.line,
          borderBottomWidth: showBorder ? StyleSheet.hairlineWidth : 0,
          paddingStart: theme.spacing.sm,
          paddingEnd: theme.spacing.sm,
        },
      ]}
    >
      {onBack ? (
        <IconButton
          label={t('common.back')}
          onPress={onBack}
          hitSlop={2}
          icon={<Icon name="chevron-back" size="md" />}
        />
      ) : null}
      <View
        style={[
          styles.titleBlock,
          { paddingStart: onBack ? theme.spacing.xs : theme.spacing.sm },
        ]}
      >
        <AppText variant="title" numberOfLines={1} align="auto" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="text3" numberOfLines={1} align="auto">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginStart: 4,
  },
});
