import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';

export function ChatTopBar({
  title,
  subtitle,
  onBack,
  onActions,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onActions: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.root,
        {
          borderBottomColor: theme.colors.divider,
          backgroundColor: theme.colors.bg,
        },
      ]}
    >
      <IconButton
        label={t('common.back')}
        onPress={onBack}
        size="sm"
        variant="borderless"
        hitSlop={layout.hitSlop}
        icon={<Icon name="chevron-back" size={layout.icon} color="textStrong" />}
      />
      <View style={styles.titleBlock}>
        <AppText
          variant="topBarTitle"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        <AppText
          variant="subtitle13"
          color="secondary"
          numberOfLines={1}
        >
          {subtitle}
        </AppText>
      </View>
      <IconButton
        label={t('sessions.actions')}
        onPress={onActions}
        size="sm"
        variant="borderless"
        hitSlop={layout.hitSlop}
        icon={<Icon name="ellipsis-horizontal" size={layout.icon} color="textStrong" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: layout.topBar + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.padX,
    gap: 8,
    borderBottomWidth: layout.border,
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
});
