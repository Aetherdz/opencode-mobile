import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ApprovalRequest } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { hapticMedium, hapticSelection, hapticWarning } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

type Risk = 'readOnly' | 'writes' | 'command' | 'network' | 'destructive';

function classify(request: ApprovalRequest): Risk {
  const text = `${request.action} ${request.resources.join(' ')}`.toLowerCase();
  if (/(^|\s)(rm|rmdir|unlink|drop|truncate|kill|chmod|chown)(\s|$)|reset --hard|delete|destroy/.test(text)) {
    return 'destructive';
  }
  if (/webfetch|fetch\(|curl|wget|https?:\/\/|network|download/.test(text)) return 'network';
  if (/bash|shell|exec|command|spawn|npm|pnpm|yarn|bun|git\s|run\b/.test(text)) return 'command';
  if (/edit|write|patch|create|apply|rename|move|mv\b/.test(text)) return 'writes';
  return 'readOnly';
}

const riskMeta: Record<Risk, { key: string; icon: IconName }> = {
  readOnly: { key: 'approval.readOnly', icon: 'eye-outline' },
  writes: { key: 'approval.writes', icon: 'pencil-outline' },
  command: { key: 'approval.command', icon: 'terminal-outline' },
  network: { key: 'approval.network', icon: 'globe-outline' },
  destructive: { key: 'approval.destructive', icon: 'warning-outline' },
};

export function ApprovalSheet({
  request,
  onClose,
  onDecision,
}: {
  request: ApprovalRequest | null;
  onClose: () => void;
  onDecision: (decision: 'once' | 'always' | 'reject') => Promise<void>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    setConfirming(false);
    setConfirmReject(false);
    setBusy(false);
  }, [request?.id]);

  if (!request) return null;
  const risk = classify(request);
  const meta = riskMeta[risk];
  const destructive = risk === 'destructive';

  const decide = async (decision: 'once' | 'always' | 'reject') => {
    if (busy) return;
    if (decision === 'reject' && !confirmReject) {
      setConfirmReject(true);
      hapticWarning();
      return;
    }
    if (destructive && decision !== 'reject' && !confirming) {
      setConfirming(true);
      hapticWarning();
      return;
    }
    setBusy(true);
    if (decision === 'reject') hapticSelection();
    else if (destructive) hapticMedium();
    else hapticSelection();
    try {
      await onDecision(decision);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      footer={
        <View style={{ gap: theme.spacing.md }}>
          {confirming ? (
            <AppText variant="meta" color="danger">
              {t('approval.confirmDestructive')}
            </AppText>
          ) : confirmReject ? (
            <AppText variant="meta" color="danger">
              {t('approval.confirmReject')}
            </AppText>
          ) : null}
          <Button
            label={confirming ? t('approval.approveAnyway') : t('approval.once')}
            onPress={() => void decide('once')}
            loading={busy}
            fullWidth
            variant={confirming ? 'secondary' : 'primary'}
          />
          <Button
            label={t('approval.always')}
            onPress={() => void decide('always')}
            variant="secondary"
            fullWidth
            disabled={busy}
          />
          <Button
            label={confirmReject ? t('approval.confirmDeny') : t('approval.deny')}
            onPress={() => void decide('reject')}
            variant={confirmReject ? 'danger' : 'ghost'}
            fullWidth
            disabled={busy}
          />
        </View>
      }
    >
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.lg }}>
        <AppText variant="title" accessibilityRole="header">
          {t('approval.title')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <View
            style={[
              styles.risk,
              {
                borderColor: destructive ? theme.colors.danger : theme.colors.line,
                borderRadius: 999,
                paddingHorizontal: theme.spacing.md,
                gap: theme.spacing.xs,
                backgroundColor: theme.colors.surface2,
              },
            ]}
          >
            <Icon
              name={meta.icon}
              size="xs"
              color={destructive ? 'danger' : 'text2'}
            />
            <AppText variant="caption" color={destructive ? 'danger' : 'text2'}>
              {t(meta.key)}
            </AppText>
          </View>
          <AppText variant="caption" color="text3">
            {t('approval.sessionOnly')}
          </AppText>
        </View>

        <AppText variant="meta" color="text2" style={{ marginTop: theme.spacing.lg }}>
          {request.message ?? request.action}
        </AppText>

        {request.resources.length > 0 ? (
          <View
            style={{
              marginTop: theme.spacing.md,
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.line,
              borderWidth: 1,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              maxHeight: 160,
            }}
          >
            <ScrollView nestedScrollEnabled>
              {request.resources.map((resource, index) => (
                <AppText
                  key={`${resource}-${index}`}
                  variant="code"
                  mono
                  numberOfLines={6}
                  style={{ marginBottom: index === request.resources.length - 1 ? 0 : 6 }}
                >
                  {resource}
                </AppText>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <AppText variant="caption" color="text3" style={{ marginTop: theme.spacing.md }}>
          {`${t('approval.resources')}: ${request.action}`}
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  risk: {
    minHeight: 32,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
