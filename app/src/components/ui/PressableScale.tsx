import { useRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export interface PressableScaleProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  duration?: number;
  pressedOpacity?: number;
}

export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.97,
  duration = 160,
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
          if (!reduced) scale.value = withTiming(scaleTo, { duration });
          if (pressedOpacity != null) opacity.value = withTiming(pressedOpacity, { duration });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduced) scale.value = withTiming(1, { duration });
          if (pressedOpacity != null) opacity.value = withTiming(1, { duration });
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
