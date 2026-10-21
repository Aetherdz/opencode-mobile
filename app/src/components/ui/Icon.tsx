import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';
import { useRtl } from './Rtl';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconColor = keyof ThemeColors;

/**
 * Directional glyphs that must follow the reading direction. Ionicons does not
 * mirror automatically, so the shared icon primitive flips them in RTL.
 */
const MIRRORED_ICONS: ReadonlySet<string> = new Set([
  'arrow-back',
  'arrow-back-outline',
  'arrow-forward',
  'arrow-forward-outline',
  'caret-back',
  'caret-forward',
  'chevron-back',
  'chevron-back-circle',
  'chevron-back-circle-outline',
  'chevron-back-outline',
  'chevron-forward',
  'chevron-forward-circle',
  'chevron-forward-circle-outline',
  'chevron-forward-outline',
  'return-down-back-outline',
  'return-down-forward-outline',
]);

export interface IconProps {
  name: IconName;
  /** 4pt rhythm: 16, 20, 24, 28, 32. A number is allowed for the 36px brand mark. */
  size?: IconSize | number;
  color?: IconColor;
  style?: StyleProp<TextStyle>;
  /** Provide only when the icon carries meaning by itself. */
  accessibilityLabel?: string;
}

/**
 * Single icon primitive for the app. Uses Ionicons line-style glyphs by
 * convention; filled glyphs are reserved for state and selection symbols
 * (`stop`, `ellipse`, `radio-button-on`, `checkmark`). Icon fonts stay out of
 * text scaling, and icons stay silent for screen readers unless the icon is
 * the only label.
 */
export function Icon({
  name,
  size = 'sm',
  color = 'text',
  style,
  accessibilityLabel,
}: IconProps) {
  const theme = useTheme();
  const forcedRtl = useRtl();
  const mirrored = (theme.isRTL || forcedRtl) && MIRRORED_ICONS.has(name);
  const flattened = StyleSheet.flatten(style);
  const resolvedSize = typeof size === 'number' ? size : theme.iconSizes[size];
  const transform = [
    ...(Array.isArray(flattened?.transform) ? flattened.transform : []),
    ...(mirrored ? [{ scaleX: -1 }] : []),
  ] as NonNullable<TextStyle['transform']>;

  return (
    <Ionicons
      name={name}
      size={resolvedSize}
      color={theme.colors[color]}
      allowFontScaling={false}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no'}
      aria-hidden={!accessibilityLabel}
      style={[
        styles.base,
        flattened,
        transform.length > 0 ? { transform } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    textAlign: 'center',
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as TextStyle)
      : null),
  },
});
