import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Divider({
  style,
  inset = false,
  design = 'classic',
}: {
  style?: StyleProp<ViewStyle>;
  inset?: boolean;
  design?: 'classic' | 'new';
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: design === 'new' ? theme.colors.divider : theme.colors.line,
          marginHorizontal: inset ? 20 : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, width: '100%' },
});
