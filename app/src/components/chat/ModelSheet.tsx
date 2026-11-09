import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { AvailableModel, ModelSelection } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useI18n } from '@/lib/i18n';
import { dismissKeyboard } from '@/lib/keyboard';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

export function ModelSheet({
  visible,
  models,
  selected,
  loading,
  failed,
  errorDetail,
  onClose,
  onSelect,
  onRetry,
}: {
  visible: boolean;
  models: AvailableModel[];
  selected: ModelSelection | null;
  loading: boolean;
  failed: boolean;
  /** Actionable non-transport diagnostic, when one is available. */
  errorDetail?: string;
  onClose: () => void;
  onSelect: (model: ModelSelection | null) => void;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      `${model.name} ${model.providerName} ${model.modelId}`.toLocaleLowerCase().includes(query),
    );
  }, [models, search]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('model.title')}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder={t('model.search')}
          accessibilityLabel={t('model.search')}
          returnKeyType="search"
          design="new"
        />
        <View style={styles.results}>
          {loading ? (
            <AppText color="secondary">{t('model.loading')}</AppText>
          ) : failed ? (
            <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
              <AppText color="danger" align="center">
                {t(errorDetail ? 'model.loadError' : 'model.connectionError')}
              </AppText>
              {errorDetail ? (
                <AppText variant="helper" color="secondary" align="center">
                  {errorDetail}
                </AppText>
              ) : null}
              <Pressable onPress={onRetry} accessibilityRole="button">
                <AppText color="accent">{t('common.retry')}</AppText>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <AppText color="secondary">{t('model.empty')}</AppText>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => `${item.providerId}:${item.modelId}`}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selected?.providerID === item.providerId && selected.modelID === item.modelId;
                return (
                  <PressableScale
                    onPress={() => {
                      dismissKeyboard();
                      onSelect({ providerID: item.providerId, modelID: item.modelId });
                    }}
                    scaleTo={0.985}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${item.name}, ${item.providerName}`}
                    style={[
                      styles.row,
                      {
                        borderBottomColor: theme.colors.divider,
                        backgroundColor: isSelected ? theme.colors.surface2 : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.labels}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AppText variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>{item.name}</AppText>
                        {item.modelId.toLowerCase().includes('argon') || item.name.toLowerCase().includes('argon') ? (
                          <View
                            style={{
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderColor: '#F59E0B',
                              borderWidth: 1,
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                            }}
                          >
                            <AppText variant="caption" weight="600" style={{ color: '#D97706', fontSize: 10 }}>
                              ARGON 4
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText variant="caption" color="secondary" numberOfLines={1}>
                        {item.providerName} · {item.modelId}
                      </AppText>
                    </View>
                    {isSelected ? <Icon name="checkmark" size={layout.icon} color="accent" /> : null}
                  </PressableScale>
                );
              }}
            />
          )}
        </View>
        <PressableScale
          onPress={() => {
            dismissKeyboard();
            onSelect(null);
          }}
          scaleTo={0.985}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === null }}
          style={[
            styles.row,
            { borderTopColor: theme.colors.divider, backgroundColor: selected === null ? theme.colors.surface2 : 'transparent' },
          ]}
        >
          <AppText variant="body">{t('model.default')}</AppText>
          {selected === null ? <Icon name="checkmark" size={layout.icon} color="accent" /> : null}
        </PressableScale>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Reserve the same space for loading, error, empty, and loaded states so the
  // bottom sheet doesn't resize/jump when the model request settles.
  results: { height: 280, alignItems: 'center', justifyContent: 'center' },
  list: { width: '100%', flex: 1 },
  row: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  labels: { flex: 1, gap: 2 },
});
