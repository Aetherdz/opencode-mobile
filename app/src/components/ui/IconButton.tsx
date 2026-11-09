import type { ReactNode } from 'react';
import {
  StyleSheet,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from './PressableScale';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'plain' | 'surface' | 'borderless';

export interface IconButtonProps {
  icon: ReactNode;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
  hitSlop?: number | Insets;
  accessibilityState?: AccessibilityState;
  testID?: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 48 };

export function IconButton({
  icon,
  onPress,
  label,
  disabled = false,
  hitSlop = 4,
  accessibilityState,
  testID,
  size = 'md',
  variant = 'plain',
  haptic = true,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const diameter = SIZES[size];
  return (
    <PressableScale
      scaleTo={0.92}
      pressedOpacity={variant === 'borderless' ? 0.65 : undefined}
      onPress={() => {
        if (!onPress) return;
        if (haptic) hapticSelection();
        onPress();
      }}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled || Boolean(accessibilityState?.disabled),
      }}
      hitSlop={hitSlop}
      containerStyle={style}
      style={({ pressed }) => [
        styles.base,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: variant === 'surface' ? theme.colors.surface : 'transparent',
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: variant === 'surface' ? theme.colors.border : 'transparent',
          opacity: disabled
            ? 0.4
            : pressed
              ? variant === 'plain'
                ? 1
                : 0.6
              : 1,
          ...(variant === 'plain' && pressed ? { backgroundColor: theme.colors.surface2 } : null),
        },
      ]}
    >
      {icon}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
