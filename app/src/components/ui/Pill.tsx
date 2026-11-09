import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface PillProps {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: React.ComponentProps<typeof View>['style'];
}

/** 34pt control pill used for the model selector and compact filters. */
export function Pill({
  label,
  icon,
  onPress,
  selected = false,
  accessibilityLabel,
  style,
}: PillProps) {
  const theme = useTheme();
  const content = (
    <>
      {icon}
      <AppText
        variant="pill"
        color={selected ? 'onPrimary' : 'textStrong'}
        align="center"
        numberOfLines={1}
      >
        {label}
      </AppText>
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.pill,
          {
            backgroundColor: selected ? theme.colors.primary : 'transparent',
            borderColor: selected ? theme.colors.primary : theme.colors.border,
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      scaleTo={0.95}
      pressedOpacity={0.75}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? theme.colors.primary : 'transparent',
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        style,
      ]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: layout.pill,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
