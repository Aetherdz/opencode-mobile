import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Design = 'classic' | 'new';
type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  design?: Design;
  size?: ButtonSize;
  shape?: 'rounded' | 'pill';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  minHeight?: number;
  testID?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  design = 'classic',
  size,
  shape = 'rounded',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  compact = false,
  minHeight,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const visualDisabled = disabled;
  const isNew = design === 'new';
  const height = size ? (size === 'sm' ? layout.btnSm : layout.btn) : compact ? 44 : (minHeight ?? 48);
  const radius = shape === 'pill' ? 999 : isNew ? layout.radiusS : theme.radii.md;

  const background = isNew
    ? variant === 'primary' && !visualDisabled
      ? theme.colors.primary
      : 'transparent'
    : variant === 'primary'
      ? theme.colors.accentFill
      : 'transparent';
  const borderColor = isNew
    ? variant === 'primary'
      ? visualDisabled
        ? theme.colors.border
        : 'transparent'
      : variant === 'secondary'
        ? theme.colors.strong
        : variant === 'danger'
          ? theme.colors.danger
          : 'transparent'
    : variant === 'secondary'
      ? theme.colors.controlLine
      : variant === 'danger'
        ? theme.colors.danger
        : 'transparent';
  const textColor = isNew
    ? variant === 'primary'
      ? visualDisabled
        ? theme.colors.textDisabled
        : theme.colors.onPrimary
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'ghost'
          ? theme.colors.secondary
          : theme.colors.textStrong
    : variant === 'primary'
      ? inactive
        ? theme.colors.text3
        : theme.colors.onAccent
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'ghost'
          ? theme.colors.text2
          : theme.colors.text;
  const borderWidth = isNew
    ? variant === 'primary'
      ? visualDisabled
        ? 1
        : 0
      : variant === 'secondary' || variant === 'danger'
        ? 1
        : 0
    : variant === 'primary' || variant === 'ghost'
      ? 0
      : 1;

  return (
    <PressableScale
      onPress={() => {
        if (variant === 'primary') hapticLight();
        else hapticSelection();
        onPress?.();
      }}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      pressedOpacity={isNew ? 0.82 : undefined}
      containerStyle={fullWidth ? styles.stretch : undefined}
      style={[
        styles.base,
        {
          minHeight: height,
          height,
          backgroundColor: background,
          borderColor,
          borderWidth,
          borderRadius: radius,
          borderCurve: 'continuous',
          opacity: inactive ? (isNew ? 1 : variant === 'primary' ? 1 : 0.55) : 1,
          paddingHorizontal: size === 'sm' ? 16 : isNew ? 20 : compact ? theme.spacing.lg : theme.spacing.xl,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.content, { opacity: loading ? 0 : 1 }]}>
          {icon}
          <AppText
            variant={isNew ? 'buttonLabel' : 'label'}
            weight={isNew ? '500' : '600'}
            color="text"
            align="center"
            style={{ color: textColor, marginStart: icon ? theme.spacing.sm : 0 }}
          >
            {label}
          </AppText>
        </View>
        {loading ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.spinner}>
              <ActivityIndicator size="small" color={textColor} />
            </View>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stretch: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
