import { Icon } from './Icon';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/layout';
import { AppText } from './AppText';
import { Button } from './Button';

export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
  design = 'classic',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  design?: 'classic' | 'new';
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const isNew = design === 'new';
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: isNew ? theme.colors.surface : theme.colors.surface1,
          borderColor: isNew ? theme.colors.border : theme.colors.line,
          borderRadius: isNew ? layout.radiusS : theme.radii.md,
          borderCurve: 'continuous',
          padding: isNew ? 14 : theme.spacing.md,
          gap: isNew ? 10 : theme.spacing.sm,
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <Icon
          name="alert-circle-outline"
          size={isNew ? 16 : 20}
          color={isNew ? 'secondary' : 'text'}
        />
        <AppText
          variant={isNew ? 'helper' : 'meta'}
          color={isNew ? 'textStrong' : 'text'}
          style={{ flex: 1 }}
        >
          {message}
        </AppText>
      </View>
      {onRetry ? (
        <Button
          label={retryLabel ?? t('common.retry')}
          variant="secondary"
          design={isNew ? 'new' : 'classic'}
          size={isNew ? 'sm' : undefined}
          compact
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
