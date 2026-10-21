import { Image, type ImageLoadEventData } from 'expo-image';
import * as React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import {
  GestureDetector,
  GestureHandlerRootView,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const SWIPE_CLOSE_DISTANCE = 120;
const SWIPE_CLOSE_VELOCITY = 900;
const RESET_DURATION = 160;
const ZOOM_DURATION = 180;

function clampValue(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function axisLimit(size: number, scale: number): number {
  'worklet';
  return Math.max(0, (size * scale - size) / 2);
}

export function ImageViewer(props: {
  visible: boolean;
  uri: string;
  headers?: Record<string, string>;
  onClose: () => void;
}): React.ReactElement {
  const { visible, uri, headers, onClose } = props;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const theme = useTheme();
  const closeTop = Math.max(insets.top, spacing.xl) + spacing.md;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);

  const source = React.useMemo(() => ({ uri, headers }), [uri, headers]);

  React.useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [visible, uri, scale, savedScale, translateX, translateY, savedX, savedY]);

  React.useEffect(() => {
    imageWidth.value = 0;
    imageHeight.value = 0;
  }, [uri, imageWidth, imageHeight]);

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      containerWidth.value = event.nativeEvent.layout.width;
      containerHeight.value = event.nativeEvent.layout.height;
    },
    [containerWidth, containerHeight],
  );

  const handleLoad = React.useCallback(
    (event: ImageLoadEventData) => {
      imageWidth.value = event.source.width;
      imageHeight.value = event.source.height;
    },
    [imageWidth, imageHeight],
  );

  const pinch = usePinchGesture({
    onActivate: () => {
      savedScale.value = scale.value;
    },
    onUpdate: (event) => {
      const nextScale = clampValue(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      scale.value = nextScale;
      const limitX = axisLimit(containerWidth.value, nextScale);
      const limitY = axisLimit(containerHeight.value, nextScale);
      translateX.value = clampValue(translateX.value, -limitX, limitX);
      translateY.value = clampValue(translateY.value, -limitY, limitY);
    },
    onDeactivate: (event) => {
      if (event.canceled) {
        savedScale.value = scale.value;
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }
      if (scale.value <= MIN_SCALE + 0.01) {
        scale.value = withTiming(MIN_SCALE, { duration: RESET_DURATION });
        translateX.value = withTiming(0, { duration: RESET_DURATION });
        translateY.value = withTiming(0, { duration: RESET_DURATION });
        savedScale.value = MIN_SCALE;
        savedX.value = 0;
        savedY.value = 0;
        return;
      }
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onActivate: () => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      if (scale.value <= MIN_SCALE + 0.01) translateY.value = 0;
    },
    onUpdate: (event) => {
      if (scale.value > MIN_SCALE + 0.01) {
        const limitX = axisLimit(containerWidth.value, scale.value);
        const limitY = axisLimit(containerHeight.value, scale.value);
        translateX.value = clampValue(savedX.value + event.translationX, -limitX, limitX);
        translateY.value = clampValue(savedY.value + event.translationY, -limitY, limitY);
        return;
      }
      translateX.value = 0;
      translateY.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      if (scale.value > MIN_SCALE + 0.01) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }
      if (event.canceled) {
        translateY.value = withTiming(0, { duration: RESET_DURATION });
        return;
      }
      const shouldClose =
        translateY.value > SWIPE_CLOSE_DISTANCE ||
        (event.velocityY > SWIPE_CLOSE_VELOCITY && translateY.value > 40);
      if (shouldClose) {
        runOnJS(onClose)();
        return;
      }
      translateY.value = withTiming(0, { duration: RESET_DURATION });
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 260,
    onDeactivate: (event) => {
      if (event.canceled) return;
      const nextScale = scale.value > MIN_SCALE + 0.05 ? MIN_SCALE : DOUBLE_TAP_SCALE;
      savedScale.value = nextScale;
      savedX.value = 0;
      savedY.value = 0;
      translateX.value = withTiming(0, { duration: ZOOM_DURATION });
      translateY.value = withTiming(0, { duration: ZOOM_DURATION });
      scale.value = withTiming(nextScale, { duration: ZOOM_DURATION });
    },
  });

  const singleTap = useTapGesture({
    numberOfTaps: 1,
    maxDistance: 10,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (scale.value > MIN_SCALE + 0.01) return;

      const width = containerWidth.value;
      const height = containerHeight.value;
      const naturalWidth = imageWidth.value;
      const naturalHeight = imageHeight.value;

      let insideImage = false;
      if (width > 0 && height > 0 && naturalWidth > 0 && naturalHeight > 0) {
        const fit = Math.min(width / naturalWidth, height / naturalHeight);
        const displayedWidth = naturalWidth * fit;
        const displayedHeight = naturalHeight * fit;
        const left = (width - displayedWidth) / 2;
        const top = (height - displayedHeight) / 2;
        insideImage =
          event.x >= left &&
          event.x <= left + displayedWidth &&
          event.y >= top &&
          event.y <= top + displayedHeight;
      }

      if (!insideImage) runOnJS(onClose)();
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, taps);

  const animatedStyle = useAnimatedStyle(() => {
    const drag =
      scale.value <= MIN_SCALE + 0.01 ? Math.max(0, translateY.value) : 0;
    return {
      opacity: Math.max(0.35, 1 - drag / 360),
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Modal
      visible={visible}
      transparent={false}
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
      hardwareAccelerated
    >
      <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <View
          style={[styles.root, { backgroundColor: theme.colors.canvas }]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[styles.canvas, { backgroundColor: theme.colors.canvas }, animatedStyle]}
              onLayout={handleLayout}
            >
              <Image
                source={source}
                style={styles.image}
                contentFit="contain"
                transition={120}
                onLoad={handleLoad}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('chat.imagePreview')}
              />
            </Animated.View>
          </GestureDetector>

          <Pressable
            onPress={() => {
              hapticSelection();
              onClose();
            }}
            style={({ pressed }) => [
              styles.closeButton,
              {
                top: closeTop,
                end: spacing.lg,
                borderColor: theme.colors.line,
                backgroundColor: theme.colors.surface2,
              },
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.closeImage')}
          >
            <Icon name="close" size="md" color="text" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  closeButtonPressed: {
    opacity: 0.62,
  },
});
