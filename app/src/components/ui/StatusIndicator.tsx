import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import type { SessionStatus } from '@/api/types';

export type StatusKind = SessionStatus | 'ready' | 'pending' | 'done';

/**
 * Monochrome status mark. Shape carries the state; the adjacent label carries
 * the meaning, so the indicator is never the only signal.
 */
export function StatusIndicator({
  status,
  style,
}: {
  status: StatusKind;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (status !== 'running' || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, reduced, status]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));

  if (status === 'idle') {
    return (
      <View
        accessible={false}
        style={[
          styles.idle,
          { borderColor: theme.colors.textDisabled },
          style,
        ]}
      />
    );
  }

  if (status === 'running') {
    return (
      <View accessible={false} style={[styles.box, style]}>
        <Animated.View
          style={[
            styles.halo,
            { borderColor: theme.colors.primary },
            haloStyle,
          ]}
        />
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
      </View>
    );
  }

  if (status === 'waiting_input') {
    return (
      <View
        accessible={false}
        style={[styles.ring, { borderColor: theme.colors.textStrong }, style]}
      />
    );
  }

  if (status === 'needs_approval') {
    return (
      <View
        accessible={false}
        style={[styles.ring, { borderColor: theme.colors.textStrong }, style]}
      >
        <View style={[styles.centerDot, { backgroundColor: theme.colors.textStrong }]} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View
        accessible={false}
        style={[styles.ring, { borderColor: theme.colors.textStrong }, style]}
      >
        <View style={[styles.errorBar, { backgroundColor: theme.colors.textStrong }]} />
        <View
          style={[
            styles.errorDot,
            { backgroundColor: theme.colors.textStrong },
          ]}
        />
      </View>
    );
  }

  if (status === 'done') {
    return (
      <View
        accessible={false}
        style={[
          styles.ring,
          styles.done,
          { borderColor: theme.colors.textStrong },
          style,
        ]}
      />
    );
  }

  return (
    <View
      accessible={false}
      style={[styles.ring, { borderColor: theme.colors.strong }, style]}
    />
  );
}

const SIZE = 12;

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  idle: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: { width: 4, height: 4, borderRadius: 2 },
  done: { borderWidth: 1.5 },
  errorBar: { width: 1.5, height: 3.5, borderRadius: 1, marginTop: 1.5 },
  errorDot: { width: 1.5, height: 1.5, borderRadius: 1, marginTop: 1 },
});
