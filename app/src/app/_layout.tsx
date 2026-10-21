import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
} from '@expo-google-fonts/noto-sans-arabic';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { I18nManager, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { EventBridge } from '@/state/EventBridge';
import { useAuth } from '@/state/auth';
import { useSettings } from '@/state/settings';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function DirectionSync() {
  const locale = useSettings((state) => state.locale);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const doc = (globalThis as { document?: { documentElement: { dir: string } } }).document;
      if (doc) doc.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      return;
    }
    I18nManager.allowRTL(true);
    const wantRTL = locale === 'ar';
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.forceRTL(wantRTL);
    }
  }, [locale]);
  return null;
}

function Navigator() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="connect" options={{ animation: 'fade' }} />
        <Stack.Screen name="sessions" />
        <Stack.Screen name="new-session" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="diff/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const settingsHydrated = useSettings((state) => state.hydrated);
  const authHydrated = useAuth((state) => state.hydrated);
  const hydrateSettings = useSettings((state) => state.hydrate);
  const hydrateAuth = useAuth((state) => state.hydrate);
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'NotoSansArabic-Regular': NotoSansArabic_400Regular,
    'NotoSansArabic-Medium': NotoSansArabic_500Medium,
    'NotoSansArabic-SemiBold': NotoSansArabic_600SemiBold,
    'NotoSansArabic-Bold': NotoSansArabic_700Bold,
    JetBrainsMono: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium': require('../../assets/fonts/JetBrainsMono-Medium.ttf'),
  });

  useEffect(() => {
    void hydrateSettings();
    void hydrateAuth();
  }, [hydrateAuth, hydrateSettings]);

  const ready = settingsHydrated && authHydrated && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DialogProvider>
              <DirectionSync />
              <EventBridge />
              <Navigator />
            </DialogProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
