import { useRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

export interface PressableScaleProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  duration?: number;
  pressedOpacity?: number;
}

export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.965,
  duration,
  pressedOpacity,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const ref = useRef(null);

  return (
    <Animated.View style={[animatedStyle, containerStyle]} ref={ref}>
      <Pressable
        {...props}
        disabled={disabled}
        style={style}
        onPressIn={(event) => {
          if (!reduced) {
            scale.value = duration
              ? withTiming(scaleTo, { duration })
              : withSpring(scaleTo, motion.spring.press);
          }
          if (pressedOpacity != null) {
            opacity.value = withTiming(pressedOpacity, { duration: motion.duration.instant });
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduced) {
            scale.value = duration
              ? withTiming(1, { duration })
              : withSpring(1, motion.spring.press);
          }
          if (pressedOpacity != null) {
            opacity.value = withTiming(1, { duration: motion.duration.fast });
          }
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
