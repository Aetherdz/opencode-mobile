import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { hasArabic } from '@/lib/textDirection';
import { AppText } from './AppText';
import { useRtl } from './Rtl';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  leadingAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
  /** Technical fields keep an LTR value and a left-aligned placeholder. */
  ltr?: boolean;
  /** Defaults to the same value as `ltr`; set false for prose search fields. */
  mono?: boolean;
  fieldMinHeight?: number;
  design?: 'classic' | 'new';
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    leadingAccessory,
    rightAccessory,
    containerStyle,
    inputStyle,
    ltr = false,
    mono,
    fieldMinHeight = 48,
    design = 'classic',
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const theme = useTheme();
  const forcedRtl = useRtl();
  const isRtl = theme.isRTL || forcedRtl;
  const isNew = design === 'new';
  const [focused, setFocused] = useState(false);
  const borderWidth = focused ? (isNew ? 2 : 1.5) : 1;
  const basePadding = isNew ? 14 : theme.spacing.md;
  const borderColor = error
    ? isNew
      ? theme.colors.strong
      : theme.colors.danger
    : focused
      ? isNew
        ? theme.colors.primary
        : theme.colors.accent
      : isNew
        ? theme.colors.border
        : theme.colors.controlLine;
  const useMono = mono ?? ltr;
  const inputFont = useMono
    ? theme.fonts.mono
    : hasArabic(`${props.value ?? ''}${props.placeholder ?? ''}`)
      ? theme.fonts.sansArabic
      : theme.fonts.sans;

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText
          variant={isNew ? 'fieldLabel' : 'eyebrow'}
          color={isNew ? 'textStrong' : 'text3'}
          style={{ marginBottom: theme.spacing.sm }}
        >
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth,
            backgroundColor: isNew ? theme.colors.surface : theme.colors.surface1,
            borderRadius: theme.radii.md,
            borderCurve: 'continuous',
            minHeight: fieldMinHeight,
            paddingHorizontal: basePadding - (borderWidth - 1),
          },
        ]}
      >
        {leadingAccessory ? <View style={styles.leading}>{leadingAccessory}</View> : null}
        <TextInput
          ref={ref}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={isNew ? theme.colors.placeholder : theme.colors.text3}
          selectionColor={isNew ? theme.colors.primary : theme.colors.accent}
          cursorColor={isNew ? theme.colors.primary : theme.colors.accent}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={props.accessibilityHint ?? error ?? hint}
          style={[
            {
              flex: 1,
              color: isNew ? theme.colors.textStrong : theme.colors.text,
              fontFamily: inputFont,
              fontSize: isNew ? (useMono ? 13 : 15) : 16,
              lineHeight: useMono ? 20 : 22,
              minHeight: Math.max(44, fieldMinHeight - 4),
              paddingVertical: isNew ? 10 : theme.spacing.md,
              paddingHorizontal: 0,
              textAlign: ltr ? 'left' : isRtl ? 'right' : 'left',
              writingDirection: ltr ? 'ltr' : isRtl ? 'rtl' : 'ltr',
            },
            inputStyle,
          ]}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <AppText
          variant={isNew ? 'helper' : 'caption'}
          color="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: theme.spacing.sm }}
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText
          variant={isNew ? 'helper' : 'caption'}
          color={isNew ? 'secondary' : 'text3'}
          style={{ marginTop: theme.spacing.sm }}
        >
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    marginEnd: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessory: {
    marginStart: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
