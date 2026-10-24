import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Easing,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissKeyboard } from '@/lib/keyboard';
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
  titleAlign?: 'left' | 'center';
}

export function Sheet({ visible, onClose, children, footer, title, titleAlign = 'left' }: SheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [contentVisible, setContentVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      // An overlay must not inherit an IME focused on the screen beneath it.
      dismissKeyboard();
      setMounted(true);
      // Let the Modal mount before the entering animation is evaluated.
      const frame = requestAnimationFrame(() => setContentVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    // Drop the IME while the inputs are still mounted. Unmounting a focused
    // TextInput inside a lingering Android Modal leaves the keyboard and its
    // insets stuck, freezing taps until the app restarts.
    dismissKeyboard();
    // Keep the content mounted a beat longer so the blur settles before the
    // inputs unmount; the Modal itself lingers for the exit animation.
    const hide = setTimeout(() => setContentVisible(false), reduced ? 0 : 80);
    const timeout = setTimeout(() => setMounted(false), reduced ? 120 : 210);
    return () => {
      clearTimeout(hide);
      clearTimeout(timeout);
    };
  }, [visible, reduced]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {contentVisible ? (
          <>
            <Animated.View
              style={StyleSheet.absoluteFill}
              entering={FadeIn.duration(reduced ? 100 : 150)}
              exiting={FadeOut.duration(reduced ? 80 : 120)}
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
                  reduced
                    ? FadeIn.duration(120)
                    : SlideInDown.duration(240).easing(Easing.out(Easing.cubic))
                }
                exiting={
                  reduced
                    ? FadeOut.duration(100)
                    : SlideOutDown.duration(190).easing(Easing.in(Easing.cubic))
                }
                style={[
                  styles.sheet,
                  {
                    backgroundColor: theme.colors.surface1,
                    borderColor: theme.colors.line,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopLeftRadius: theme.radii.sheet,
                    borderTopRightRadius: theme.radii.sheet,
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
                    <AppText variant="title" align={titleAlign} accessibilityRole="header">
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
          </>
        ) : null}
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
