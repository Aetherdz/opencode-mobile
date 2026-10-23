import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
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

/** Mirror of the Bridge AUTH_TOKEN minimum. Keep helper, placeholder and check in sync. */
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
  // Tailscale uses 100.64.0.0/10.
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const tokenRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const rawUrl = pairingParams.url;
    const rawToken = pairingParams.token;
    if (rawUrl === undefined && rawToken === undefined) return;

    // Reconstruct only the narrowly-supported payload, validate it, then clear
    // credentials from navigation state. Connecting still requires a tap.
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
      hapticSuccess();
    } else {
      setError(t('connect.invalidQr'));
      hapticError();
    }
    router.setParams({ url: undefined, token: undefined } as never);
  }, [pairingParams.token, pairingParams.url, t]);

  const trimmedUrl = normalizedInputUrl(url);
  const trimmedToken = token.trim();
  const urlValid = HTTP_URL.test(trimmedUrl);
  const tokenValid = trimmedToken.length >= TOKEN_MIN_LENGTH;
  const host = urlValid ? hostOf(trimmedUrl) : '';
  const bareHost = host.replace(/^\[|\]$/g, '');
  const showHttpWarning =
    urlValid && /^http:\/\//i.test(trimmedUrl) && !!host && !isPrivateHost(host);
  const stageIndex = stage ? STAGES.indexOf(stage) : -1;
  const showSteps = loading || (attempted && Boolean(error));
  const showUrlError = urlTouched && !urlValid;
  const showTokenError = tokenTouched && !tokenValid;

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

  const pasteToken = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const next = text.replace(/\s+/g, '');
      if (!next) {
        hapticError();
        setError(t('connect.pasteEmpty'));
        return;
      }
      setToken(next);
      setTokenTouched(true);
      setError(null);
    } catch {
      hapticError();
      setError(t('connect.fail'));
    }
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
  };

  const messageForError = (connectionError: unknown): string => {
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
  };

  const connect = async () => {
    if (loading) return;
    setUrlTouched(true);
    setTokenTouched(true);
    if (!urlValid) {
      hapticError();
      setError(t('connect.urlInvalid'));
      return;
    }
    if (!tokenValid) {
      hapticError();
      setError(t('connect.tokenTooShort', { min: TOKEN_MIN_LENGTH }));
      return;
    }
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
  };

  return (
    <Screen>
      <Rtl style={styles.flex}>
        <KeyboardAvoider>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              {
                paddingHorizontal: layout.padX,
                paddingTop: 24,
                paddingBottom: 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerGroup}>
              <View style={styles.brandRow}>
                <View
                  style={[
                    styles.brandMark,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <Icon name="code-slash-outline" size={22} color="textStrong" />
                </View>
                <AppText variant="eyebrow12" color="secondary">
                  {t('appName')}
                </AppText>
              </View>
              <AppText variant="connectTitle" style={{ marginTop: 22 }}>
                {t('connect.title')}
              </AppText>
              <AppText
                variant="body15"
                color="secondary"
                style={{ marginTop: 8 }}
              >
                {t('connect.subtitle')}
              </AppText>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.scanGroup}>
                <Button
                  design="new"
                  variant="secondary"
                  label={t('connect.scanQr')}
                  onPress={() => void openScanner()}
                  fullWidth
                  size="md"
                  shape="pill"
                />
                <AppText variant="helper" color="secondary">
                  {t('connect.scanHint')}
                </AppText>
              </View>
              <View>
                <TextField
                  design="new"
                  label={t('connect.url')}
                  value={url}
                  onChangeText={handleUrlChange}
                  onBlur={() => {
                    setUrlTouched(true);
                    setUrl((value) => value.trim());
                  }}
                  placeholder={t('connect.urlPlaceholder')}
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
                  hint={t('connect.urlHint')}
                  error={showUrlError ? t('connect.urlInvalid') : undefined}
                />
                {showHttpWarning ? (
                  <View style={styles.warningRow}>
                    <Icon name="lock-open-outline" size={16} color="secondary" />
                    <AppText
                      variant="helper"
                      color="secondary"
                      style={styles.flexText}
                    >
                      {t('connect.httpWarning')}
                    </AppText>
                  </View>
                ) : null}
              </View>

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
                onSubmitEditing={() => void connect()}
                ltr
                fieldMinHeight={layout.field}
                accessibilityLabel={t('connect.token')}
                error={
                  showTokenError
                    ? t('connect.tokenTooShort', { min: TOKEN_MIN_LENGTH })
                    : undefined
                }
                rightAccessory={
                  <View style={styles.accessories}>
                    <IconButton
                      label={t('connect.paste')}
                      onPress={() => void pasteToken()}
                      size="sm"
                      variant="borderless"
                      hitSlop={layout.hitSlop}
                      icon={<Icon name="clipboard-outline" size={layout.icon} color="secondary" />}
                    />
                    <IconButton
                      label={showToken ? t('connect.hideToken') : t('connect.showToken')}
                      onPress={() => setShowToken((value) => !value)}
                      size="sm"
                      variant="borderless"
                      hitSlop={layout.hitSlop}
                      accessibilityState={{ selected: showToken }}
                      icon={
                        <Icon
                          name={showToken ? 'eye-off-outline' : 'eye-outline'}
                          size={layout.icon}
                          color="secondary"
                        />
                      }
                    />
                  </View>
                }
              />
            </View>

            <View style={styles.footerGroup}>
              {showSteps ? (
                <View style={styles.steps} accessibilityLiveRegion="polite">
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
                            <Icon name="alert-circle-outline" size={16} color="textStrong" />
                          ) : done ? (
                            <Icon name="checkmark" size={16} color="textStrong" />
                          ) : active ? (
                            <ActivityIndicator
                              size="small"
                              color={theme.colors.textStrong}
                            />
                          ) : (
                            <Icon name="ellipse-outline" size={16} color="secondary" />
                          )}
                        </View>
                        <AppText
                          variant="helper"
                          color={done || active ? 'textStrong' : 'secondary'}
                          style={styles.flexText}
                        >
                          {label}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {error ? <ErrorBanner message={error} design="new" /> : null}

              <Button
                design="new"
                variant="secondary"
                label={loading ? t('connect.connecting') : t('connect.connect')}
                onPress={() => void connect()}
                loading={loading}
                fullWidth
                size="md"
                shape="pill"
              />

              <View
                style={[
                  styles.note,
                  {
                    backgroundColor: theme.colors.surface1,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.noteRow}>
                  <Icon name="lock-closed-outline" size={16} color="secondary" />
                  <AppText
                    variant="helper"
                    color="secondary"
                    style={styles.flexText}
                  >
                    {t('connect.security')}
                  </AppText>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoider>
      </Rtl>
      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={[styles.scanner, { backgroundColor: theme.colors.bg }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleQr(data)}
          />
          <View style={styles.scannerOverlay}>
            <AppText variant="connectTitle" color="textStrong">{t('connect.scanQr')}</AppText>
            <AppText variant="body15" color="textStrong">{t('connect.scanHint')}</AppText>
            <Button
              design="new"
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
  flexText: { flex: 1 },
  scanner: { flex: 1, justifyContent: 'flex-end' },
  scannerOverlay: {
    gap: 16,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
    gap: 26,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerGroup: {
    width: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  formGroup: {
    width: '100%',
    gap: 16,
  },
  scanGroup: {
    gap: 8,
  },
  footerGroup: {
    width: '100%',
    gap: 12,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  accessories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  steps: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
  stepIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    borderWidth: 1,
    borderRadius: layout.radiusS,
    borderCurve: 'continuous',
    padding: 16,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
});
