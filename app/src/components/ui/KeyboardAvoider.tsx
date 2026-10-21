import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  KeyboardState,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface KeyboardAvoiderProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onOpen?: () => void;
  onClose?: () => void;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  /** Screens and sheets already include the bottom safe-area inset. */
  subtractBottomInset?: boolean;
}

/**
 * Single keyboard mechanism for every screen and sheet.
 *
 * Reanimated reads the keyboard height synchronously while the window shrinks.
 * The animated padding replaces KeyboardAvoidingView, which cannot follow the
 * edge-to-edge Android surface used by this app.
 */
export function KeyboardAvoider({
  children,
  style,
  onOpen,
  onClose,
  pointerEvents,
  subtractBottomInset = true,
}: KeyboardAvoiderProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, keyboard.height.value - (subtractBottomInset ? insets.bottom : 0)),
  }));

  useAnimatedReaction(
    () => keyboard.state.value,
    (state, previous) => {
      if (state === previous) return;
      if (state === KeyboardState.OPEN && onOpen) runOnJS(onOpen)();
      if (state === KeyboardState.CLOSED && onClose) runOnJS(onClose)();
    },
    [onOpen, onClose],
  );

  return (
    <Animated.View pointerEvents={pointerEvents} style={[styles.root, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
