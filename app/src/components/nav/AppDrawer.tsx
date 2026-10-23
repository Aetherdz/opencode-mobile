import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionSummary } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Rtl } from '@/components/ui/Rtl';
import { useI18n } from '@/lib/i18n';
import { formatSessionTitle } from '@/lib/format';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

export function AppDrawer({
  visible,
  onClose,
  sessions,
}: {
  visible: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
}) {
  const theme = useTheme();
  const { t, locale, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [contentVisible, setContentVisible] = useState(visible);
  const dragX = useSharedValue(0);
  const drawerWidth = Math.min(screenWidth * 0.84, 340);
  const closeDirection = isRTL ? 1 : -1;

  const pan = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-12, 12],
    maxPointers: 1,
    onActivate: () => {
      dragX.value = 0;
    },
    onUpdate: (event) => {
      const signed = Math.max(-drawerWidth, Math.min(drawerWidth, event.translationX));
      dragX.value = isRTL ? Math.max(0, signed) : Math.min(0, signed);
    },
    onDeactivate: (event) => {
      if (event.canceled) {
        dragX.value = withTiming(0, { duration: reduced ? 0 : 100 });
        return;
      }
      const distance = dragX.value * closeDirection;
      const velocity = event.velocityX * closeDirection;
      const shouldClose =
        distance > drawerWidth * 0.28 ||
        (velocity > 700 && distance > 36);
      if (shouldClose) {
        dragX.value = withTiming(closeDirection * drawerWidth, { duration: reduced ? 0 : 120 }, () => {
          runOnJS(onClose)();
        });
      } else {
        dragX.value = withTiming(0, { duration: reduced ? 80 : 160 });
      }
    },
  });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  useEffect(() => {
    if (visible) {
      dragX.value = 0;
      setMounted(true);
      const frame = requestAnimationFrame(() => setContentVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setContentVisible(false);
    const timeout = setTimeout(() => setMounted(false), reduced ? 120 : 200);
    return () => clearTimeout(timeout);
  }, [visible, reduced, dragX]);

  const open = (route: '/sessions' | '/settings' | '/new-session') => {
    onClose();
    router.push(route as never);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Rtl style={styles.root}>
        {contentVisible ? (
          <>
            <Animated.View
              pointerEvents="box-none"
              entering={FadeIn.duration(reduced ? 80 : 140)}
              exiting={FadeOut.duration(reduced ? 80 : 120)}
              style={StyleSheet.absoluteFill}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]}
              />
            </Animated.View>
            <GestureDetector gesture={pan}>
              <Animated.View
                accessibilityViewIsModal
              entering={
                reduced
                  ? FadeIn.duration(100)
                  : isRTL
                    ? SlideInRight.duration(220)
                    : SlideInLeft.duration(220)
              }
              exiting={
                reduced
                  ? FadeOut.duration(100)
                  : isRTL
                    ? SlideOutRight.duration(180)
                    : SlideOutLeft.duration(180)
              }
                style={[
                  styles.panel,
                  dragStyle,
                {
                  left: isRTL ? undefined : 0,
                  right: isRTL ? 0 : undefined,
                  backgroundColor: theme.colors.canvas,
                  borderEndColor: theme.colors.line,
                  paddingTop: Math.max(insets.top, 16) + 12,
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]}
            >
          <View style={styles.brandRow}>
            <View style={styles.brandIdentity}>
              <Image source={require('../../../assets/images/brand-mark.png')} style={styles.brandMark} accessibilityLabel="OpenCode Mobile" />
              <AppText variant="wordmark" style={{ fontFamily: theme.fonts.serif }}>
                OpenCode
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeButton}
            >
              <Icon name="close" size={layout.icon} color="textStrong" />
            </Pressable>
          </View>

          <View style={styles.navigation}>
            <Pressable style={styles.navRow} onPress={() => open('/sessions')}>
              <AppText variant="title">{t('sessions.title')}</AppText>
              <Icon name="chatbubbles-outline" size={layout.icon} color="secondary" />
            </Pressable>
            <Pressable style={styles.navRow} onPress={() => open('/settings')}>
              <AppText variant="title">{t('sessions.settings')}</AppText>
              <Icon name="settings-outline" size={layout.icon} color="secondary" />
            </Pressable>
          </View>

          <View style={[styles.separator, { backgroundColor: theme.colors.divider }]} />
          <View style={styles.recentsHeading}>
            <AppText variant="section" color="secondary">
              {t('sessions.recent')}
            </AppText>
            <Pressable
              onPress={() => open('/sessions')}
              accessibilityRole="button"
              accessibilityLabel={t('home.search')}
              hitSlop={8}
            >
              <Icon name="search-outline" size={layout.icon} color="secondary" />
            </Pressable>
          </View>

          <ScrollView style={styles.recents} showsVerticalScrollIndicator={false}>
            {sessions.slice(0, 12).map((session) => (
              <Pressable
                key={session.id}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/chat/[id]', params: { id: session.id } } as never);
                }}
                style={({ pressed }) => [
                  styles.recentRow,
                  { backgroundColor: pressed ? theme.colors.surface1 : 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={formatSessionTitle(session.title, session.createdAt, locale)}
              >
                <Icon name="chatbubble-outline" size={16} color="text3" />
                <AppText variant="body15" numberOfLines={1} style={styles.recentTitle}>
                  {formatSessionTitle(session.title, session.createdAt, locale)}
                </AppText>
              </Pressable>
            ))}
            {sessions.length === 0 ? (
              <AppText variant="helper" color="secondary" style={styles.empty}>
                {t('sessions.emptyHint')}
              </AppText>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => open('/new-session')}
              style={[styles.newButton, { backgroundColor: theme.colors.primary }]}
              accessibilityRole="button"
            >
              <AppText variant="buttonLabel" color="onPrimary">
                {t('home.newChat')}  +
              </AppText>
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: theme.colors.surface3 }]}>
              <AppText variant="label">OC</AppText>
            </View>
          </View>
              </Animated.View>
            </GestureDetector>
          </>
        ) : null}
        </Rtl>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '84%',
    maxWidth: 340,
    paddingHorizontal: layout.padX,
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 32, height: 32, borderRadius: 8 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navigation: { gap: 2, marginTop: 28, marginBottom: 22 },
  navRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { height: StyleSheet.hairlineWidth, marginBottom: 20 },
  recentsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  recents: { flex: 1 },
  recentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 8 },
  recentTitle: { flex: 1 },
  empty: { paddingVertical: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  newButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderRadius: 999 },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
});
