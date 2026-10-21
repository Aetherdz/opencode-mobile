import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { KeyboardAvoider } from './KeyboardAvoider';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  title?: string;
}

export function Sheet({ visible, onClose, children, footer, title }: SheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={StyleSheet.absoluteFill}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(120)}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]}
            onPress={onClose}
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
          />
        </Animated.View>
        <KeyboardAvoider style={styles.keyboard} pointerEvents="box-none">
          <Animated.View
            entering={
              reduced ? FadeIn.duration(120) : SlideInDown.springify().damping(26).stiffness(240)
            }
            exiting={reduced ? FadeOut.duration(100) : SlideOutDown.duration(160)}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface1,
                borderColor: theme.colors.line,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopLeftRadius: theme.radii.composer + 4,
                borderTopRightRadius: theme.radii.composer + 4,
                paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
                maxHeight: '90%',
              },
            ]}
          >
            <View style={styles.grabberRow}>
              <View style={[styles.grabber, { backgroundColor: theme.colors.controlLine }]} />
            </View>
            {title ? (
              <View
                style={{
                  paddingHorizontal: theme.spacing.xl,
                  paddingBottom: theme.spacing.sm,
                }}
              >
                <AppText variant="title" accessibilityRole="header">
                  {title}
                </AppText>
              </View>
            ) : null}
            <View style={styles.body}>{children}</View>
            {footer ? (
              <View
                style={{
                  borderTopColor: theme.colors.line,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  padding: theme.spacing.lg,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoider>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: { overflow: 'hidden', width: '100%' },
  grabberRow: { height: 22, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  body: { flexShrink: 1 },
});
