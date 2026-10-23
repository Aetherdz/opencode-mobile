import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionSummary } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
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

  const open = (route: '/sessions' | '/settings' | '/new-session') => {
    onClose();
    router.push(route as never);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              marginLeft: isRTL ? 0 : 'auto',
              marginRight: isRTL ? 'auto' : 0,
              backgroundColor: theme.colors.canvas,
              borderEndColor: theme.colors.line,
              paddingTop: Math.max(insets.top, 16) + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          <View style={styles.brandRow}>
            <AppText variant="wordmark" style={{ fontFamily: theme.fonts.serif }}>
              OpenCode
            </AppText>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  panel: {
    width: '84%',
    maxWidth: 340,
    height: '100%',
    paddingHorizontal: layout.padX,
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
