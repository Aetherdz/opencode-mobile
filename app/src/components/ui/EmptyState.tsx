import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'chatbubble-ellipses-outline', title, body, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { padding: theme.spacing.xl }]}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: theme.colors.surface1,
            borderColor: theme.colors.line,
            borderRadius: theme.radii.md,
            borderCurve: 'continuous',
          },
        ]}
      >
        <Icon name={icon} size="sm" color="text2" />
      </View>
      <AppText variant="title" align="center" style={{ marginTop: theme.spacing.xl }}>
        {title}
      </AppText>
      {body ? (
        <AppText
          variant="body"
          color="text2"
          align="center"
          style={{ marginTop: theme.spacing.sm, maxWidth: 300 }}
        >
          {body}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.xl }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
