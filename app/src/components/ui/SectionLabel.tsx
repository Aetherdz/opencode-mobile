import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';

export function SectionLabel({
  label,
  count,
  style,
}: {
  label: string;
  count?: number;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  return (
    <View style={[styles.row, style]}>
      <AppText variant="section" color="secondary">
        {count == null ? label : `${label} · ${count}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
