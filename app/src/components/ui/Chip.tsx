import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  expanded?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** 40pt chip used for tool calls and expandable activity rows. */
export function Chip({
  label,
  icon,
  trailing,
  onPress,
  expanded = false,
  accessibilityLabel,
  style,
}: ChipProps) {
  const theme = useTheme();
  const content = (
    <>
      {icon}
      <AppText
        variant="helper"
        weight="500"
        color="textStrong"
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </AppText>
      {trailing}
    </>
  );
  const base = [
    styles.chip,
    {
      backgroundColor: theme.colors.surface,
      borderColor: expanded ? theme.colors.strong : theme.colors.border,
    },
    style,
  ];

  if (!onPress) {
    return <Pressable style={base}>{content}</Pressable>;
  }

  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.chip,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});
