import { memo, useEffect, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export const RenameSheet = memo(function RenameSheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [title, setTitle] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initial);
      setError(null);
    }
  }, [initial, visible]);

  useEffect(() => {
    if (!visible) return;
    // autoFocus inside a freshly mounted Modal races the window attach on
    // Android; focus after the sheet has settled instead.
    const timer = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <AppText variant="title">{t('sessions.renameTitle')}</AppText>
        <TextField
          design="new"
          ref={inputRef}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder={t('sessions.untitled')}
        />
        {error ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          </Animated.View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
          <Button design="new" shape="pill" size="sm" label={t('common.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
          <Button
            design="new"
            shape="pill"
            size="sm"
            label={t('common.save')}
            loading={busy}
            onPress={() => {
              const next = title.trim();
              if (!next) return;
              setBusy(true);
              setError(null);
              void onSave(next)
                .catch((saveError: unknown) => {
                  setError(saveError instanceof Error ? saveError.message : t('common.error'));
                })
                .finally(() => setBusy(false));
            }}
          />
        </View>
      </View>
    </Sheet>
  );
});
