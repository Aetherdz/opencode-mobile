import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ApiError, testConnection, type ConnectionStage } from '@/api/client';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Rtl } from '@/components/ui/Rtl';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import {
  hapticError,
  hapticLight,
  hapticSuccess,
} from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { parsePairingLink } from '@/lib/pairingLink';
import { normalizeBaseUrl, useAuth } from '@/state/auth';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

const TOKEN_MIN_LENGTH = 32;

const HTTP_URL =
  /^https?:\/\/(?:\[[0-9a-f:.]+\]|[^\s/:?#]+)(?::\d+)?(?:[/?#]\S*)?$/i;

const STAGES: readonly ConnectionStage[] = ['reaching', 'checking', 'ready'];

function hostOf(url: string): string {
  const rest = url.replace(/^https?:\/\//i, '');
  if (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end > 0) return rest.slice(0, end + 1).toLowerCase();
  }
  return rest.split(/[/:?#]/)[0].toLowerCase();
}

function normalizedInputUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function isPrivateHost(host: string): boolean {
  const value = host.replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value === '::1') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10 || first === 127) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return first === 100 && second >= 64 && second <= 127;
}

export default function ConnectScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const pairingParams = useLocalSearchParams<{ url?: string; token?: string }>();
  const save = useAuth((state) => state.save);
  const storedUrl = useAuth((state) => state.baseUrl);
  const storedToken = useAuth((state) => state.token);
  const [url, setUrl] = useState(storedUrl);
  const [token, setToken] = useState(storedToken);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ConnectionStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [tokenTouched, setTokenTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const tokenRef = useRef<ComponentRef<typeof TextInput>>(null);

  const messageForError = useCallback(
    (connectionError: unknown): string => {
      if (connectionError instanceof ApiError) {
        switch (connectionError.code) {
          case 'unauthorized':
            return t('connect.errorToken');
          case 'timeout':
            return t('connect.errorTimeout');
          case 'tls':
            return t('connect.errorTls');
          case 'not_bridge':
            return t('connect.errorNotBridge');
          case 'unreachable':
          case 'network':
            return t('connect.errorUnreachable');
          case 'secure_unreachable':
            return t('connect.errorSecureUnreachable');
          case 'server':
            return t('connect.errorServer');
        }
      }
      return t('connect.fail');
    },
    [t],
  );

  const connectWith = useCallback(
    async (targetUrl: string, targetToken: string) => {
      if (loading) return;
      const trimmedUrl = normalizedInputUrl(targetUrl);
      const trimmedToken = targetToken.trim();

      if (!HTTP_URL.test(trimmedUrl)) {
        hapticError();
        setError(t('connect.urlInvalid'));
        return;
      }
      if (trimmedToken.length < TOKEN_MIN_LENGTH) {
        hapticError();
        setError(t('connect.tokenTooShort', { min: TOKEN_MIN_LENGTH }));
        return;
      }

      const host = hostOf(trimmedUrl);
      const bareHost = host.replace(/^\[|\]$/g, '');
      if (
        Platform.OS !== 'web' &&
        (bareHost === '127.0.0.1' || bareHost === 'localhost' || bareHost === '::1')
      ) {
        hapticError();
        setError(t('connect.loopback'));
        return;
      }

      const base = normalizeBaseUrl(trimmedUrl);
      hapticLight();
      setAttempted(true);
      setLoading(true);
      setError(null);
      setStage('reaching');

      let connected = false;
      try {
        await testConnection(base, trimmedToken, setStage);
        await save(base, trimmedToken);
        connected = true;
        hapticSuccess();
      } catch (connectionError) {
        hapticError();
        setError(messageForError(connectionError));
      } finally {
        setLoading(false);
      }

      if (connected) {
        setStage('ready');
        router.replace('/sessions' as never);
      }
    },
    [loading, messageForError, save, t],
  );

  useEffect(() => {
    const rawUrl = pairingParams.url;
    const rawToken = pairingParams.token;
    if (rawUrl === undefined && rawToken === undefined) return;

    const payload = new URL('opencode-mobile://connect');
    if (typeof rawUrl === 'string') payload.searchParams.set('url', rawUrl);
    if (typeof rawToken === 'string') payload.searchParams.set('token', rawToken);
    const pairing = parsePairingLink(payload.toString());
    if (pairing) {
      setUrl(pairing.url);
      setToken(pairing.token);
      setUrlTouched(true);
      setTokenTouched(true);
      setError(null);
      void connectWith(pairing.url, pairing.token);
    } else {
      setError(t('connect.invalidQr'));
      hapticError();
    }
    router.setParams({ url: undefined, token: undefined } as never);
  }, [connectWith, pairingParams.token, pairingParams.url, t]);

  const trimmedUrl = normalizedInputUrl(url);
  const trimmedToken = token.trim();
  const urlValid = HTTP_URL.test(trimmedUrl);
  const tokenValid = trimmedToken.length >= TOKEN_MIN_LENGTH;
  const host = urlValid ? hostOf(trimmedUrl) : '';
  const showHttpWarning =
    urlValid && /^http:\/\//i.test(trimmedUrl) && !!host && !isPrivateHost(host);
  const stageIndex = stage ? STAGES.indexOf(stage) : -1;
  const showSteps = loading || (attempted && Boolean(error));

  const clearError = () => {
    if (error) setError(null);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value.replace(/^\s+/, '').replace(/\s+/g, ''));
    clearError();
  };

  const handleTokenChange = (value: string) => {
    setToken(value.replace(/\s+/g, ''));
    clearError();
  };

  const openScanner = async () => {
    if (Platform.OS === 'web') {
      setError(t('connect.cameraPermission'));
      return;
    }
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission?.granted) {
      setError(t('connect.cameraPermission'));
      return;
    }
    setScannerOpen(true);
  };

  const handleQr = (raw: string) => {
    const pairing = parsePairingLink(raw);
    if (!pairing) {
      setError(t('connect.invalidQr'));
      setScannerOpen(false);
      return;
    }
    setUrl(pairing.url);
    setToken(pairing.token);
    setUrlTouched(true);
    setTokenTouched(true);
    setError(null);
    setScannerOpen(false);
    hapticSuccess();
    // Auto-connect instantly!
    void connectWith(pairing.url, pairing.token);
  };

  const handleSmartPaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const pairing = parsePairingLink(text);
      if (pairing) {
        setUrl(pairing.url);
        setToken(pairing.token);
        setUrlTouched(true);
        setTokenTouched(true);
        setError(null);
        void connectWith(pairing.url, pairing.token);
        return;
      }

      const trimmed = text.trim();
      if (trimmed.length >= TOKEN_MIN_LENGTH && !trimmed.includes('://')) {
        setToken(trimmed);
        setTokenTouched(true);
        setError(null);
        hapticSuccess();
        return;
      }

      if (HTTP_URL.test(normalizedInputUrl(trimmed))) {
        setUrl(trimmed);
        setUrlTouched(true);
        setError(null);
        hapticSuccess();
        return;
      }

      setError(t('connect.pasteEmpty'));
      hapticError();
    } catch {
      hapticError();
      setError(t('connect.fail'));
    }
  };

  return (
    <Screen>
      <Rtl style={styles.flex}>
        <KeyboardAvoider>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Brand */}
            <View style={styles.header}>
              <View
                style={[
                  styles.logoBadge,
                  { backgroundColor: '#0EA5E918', borderColor: '#0EA5E940' },
                ]}
              >
                <Icon name="code-slash-outline" size={28} style={{ color: '#0EA5E9' }} />
              </View>
              <AppText variant="connectTitle" weight="700" style={styles.title}>
                {t('appName')}
              </AppText>
              <AppText variant="body15" color="secondary" style={styles.subtitle}>
                {t('connect.title')}
              </AppText>
            </View>

            {/* Quick Connect Actions */}
            <View style={styles.actionSection}>
              {/* Instant Scan QR Card */}
              <PressableScale
                onPress={() => void openScanner()}
                disabled={loading}
                scaleTo={0.98}
                style={[
                  styles.primaryCard,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: '#0EA5E960',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('connect.scanQr')}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#0EA5E9' }]}>
                  <Icon name="qr-code-outline" size={26} color="onPrimary" />
                </View>
                <View style={styles.actionTextBox}>
                  <AppText variant="title" weight="700" color="textStrong">
                    {t('connect.scanQr')}
                  </AppText>
                  <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                    {t('connect.scanHint')}
                  </AppText>
                </View>
                <Icon name="chevron-forward" size={18} color="secondary" />
              </PressableScale>

              {/* Smart Paste Card */}
              <PressableScale
                onPress={() => void handleSmartPaste()}
                disabled={loading}
                scaleTo={0.98}
                style={[
                  styles.secondaryCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('connect.paste')}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#6366F120' }]}>
                  <Icon name="clipboard-outline" size={20} style={{ color: '#6366F1' }} />
                </View>
                <View style={styles.actionTextBox}>
                  <AppText variant="body15" weight="600" color="textStrong">
                    {t('connect.paste')}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {url && token ? `${url}` : t('connect.pasteEmpty')}
                  </AppText>
                </View>
              </PressableScale>
            </View>

            {/* Error & Progress */}
            {error ? <ErrorBanner message={error} design="new" /> : null}

            {showSteps ? (
              <View
                style={[
                  styles.statusBox,
                  { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border },
                ]}
              >
                {STAGES.map((step, index) => {
                  const done = stageIndex > index;
                  const active = stageIndex === index;
                  const failedStep = active && !loading && Boolean(error);
                  const label =
                    step === 'reaching'
                      ? t('connect.stageReaching')
                      : step === 'checking'
                        ? t('connect.stageChecking')
                        : t('connect.stageReady');
                  return (
                    <View key={step} style={styles.stepRow}>
                      <View style={styles.stepIcon}>
                        {failedStep ? (
                          <Icon name="alert-circle-outline" size={16} style={{ color: '#EF4444' }} />
                        ) : done ? (
                          <Icon name="checkmark" size={16} style={{ color: '#10B981' }} />
                        ) : active ? (
                          <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                          <Icon name="ellipse-outline" size={14} color="secondary" />
                        )}
                      </View>
                      <AppText
                        variant="helper"
                        color={done || active ? 'textStrong' : 'secondary'}
                        weight={active ? '600' : '400'}
                      >
                        {label}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Manual Toggle */}
            <View style={styles.manualSection}>
              <Pressable
                onPress={() => setManualOpen((v) => !v)}
                style={styles.toggleRow}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={manualOpen ? t('connect.hideManual') : t('connect.showManual')}
              >
                <AppText variant="caption" color="secondary" weight="600">
                  {manualOpen ? `▲ ${t('connect.hideManual')}` : `▼ ${t('connect.showManual')}`}
                </AppText>
              </Pressable>

              {manualOpen ? (
                <View
                  style={[
                    styles.manualForm,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <TextField
                    design="new"
                    label={t('connect.url')}
                    value={url}
                    onChangeText={handleUrlChange}
                    onBlur={() => {
                      setUrlTouched(true);
                      setUrl((value) => value.trim());
                    }}
                    placeholder="http://192.168.1.50:8787"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    inputMode="url"
                    returnKeyType="next"
                    onSubmitEditing={() => tokenRef.current?.focus()}
                    ltr
                    fieldMinHeight={layout.field}
                    accessibilityLabel={t('connect.url')}
                    error={urlTouched && !urlValid ? t('connect.urlInvalid') : undefined}
                  />

                  {showHttpWarning ? (
                    <View style={styles.warningRow}>
                      <Icon name="lock-open-outline" size={14} style={{ color: '#F59E0B' }} />
                      <AppText variant="caption" color="secondary" style={styles.flex}>
                        {t('connect.httpWarning')}
                      </AppText>
                    </View>
                  ) : null}

                  <TextField
                    ref={tokenRef}
                    design="new"
                    label={t('connect.token')}
                    value={token}
                    onChangeText={handleTokenChange}
                    onBlur={() => setTokenTouched(true)}
                    placeholder={t('connect.tokenPlaceholder')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    secureTextEntry={!showToken}
                    textContentType="none"
                    returnKeyType="done"
                    onSubmitEditing={() => void connectWith(url, token)}
                    ltr
                    fieldMinHeight={layout.field}
                    accessibilityLabel={t('connect.token')}
                    error={
                      tokenTouched && !tokenValid
                        ? t('connect.tokenTooShort', { min: TOKEN_MIN_LENGTH })
                        : undefined
                    }
                    rightAccessory={
                      <IconButton
                        label={showToken ? t('connect.hideToken') : t('connect.showToken')}
                        onPress={() => setShowToken((value) => !value)}
                        size="sm"
                        variant="borderless"
                        hitSlop={layout.hitSlop}
                        icon={
                          <Icon
                            name={showToken ? 'eye-off-outline' : 'eye-outline'}
                            size={layout.icon}
                            color="secondary"
                          />
                        }
                      />
                    }
                  />

                  <Button
                    design="new"
                    variant="primary"
                    label={loading ? t('connect.connecting') : t('connect.connect')}
                    onPress={() => void connectWith(url, token)}
                    loading={loading}
                    fullWidth
                    size="md"
                    shape="pill"
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoider>
      </Rtl>

      {/* QR Scanner Modal */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.scannerModal}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleQr(data)}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerTargetBox} />
            <AppText variant="title" weight="700" color="onPrimary" style={{ textAlign: 'center' }}>
              {t('connect.scanQr')}
            </AppText>
            <AppText variant="caption" color="onPrimary" style={{ textAlign: 'center', opacity: 0.8 }}>
              {t('connect.scannerHint')}
            </AppText>
            <Button
              design="new"
              variant="secondary"
              label={t('common.cancel')}
              onPress={() => setScannerOpen(false)}
              fullWidth
              size="md"
              shape="pill"
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  actionSection: {
    gap: 12,
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    gap: 14,
  },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 14,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBox: {
    flex: 1,
  },
  statusBox: {
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSection: {
    marginTop: 4,
    gap: 12,
  },
  toggleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 8,
  },
  manualForm: {
    padding: 18,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 16,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scannerModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  scannerOverlay: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
  },
  scannerTargetBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 24,
    marginBottom: 16,
  },
});
