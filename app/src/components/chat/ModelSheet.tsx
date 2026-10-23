import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { AvailableModel, ModelSelection } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useI18n } from '@/lib/i18n';
import { layout } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

export function ModelSheet({
  visible,
  models,
  selected,
  loading,
  failed,
  onClose,
  onSelect,
  onRetry,
}: {
  visible: boolean;
  models: AvailableModel[];
  selected: ModelSelection | null;
  loading: boolean;
  failed: boolean;
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
        {loading ? <AppText color="secondary">{t('model.loading')}</AppText> : null}
        {failed ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText color="danger">{t('model.loadError')}</AppText>
            <Pressable onPress={onRetry} accessibilityRole="button">
              <AppText color="accent">{t('common.retry')}</AppText>
            </Pressable>
          </View>
        ) : null}
        {!loading && !failed && filtered.length === 0 ? (
          <AppText color="secondary">{t('model.empty')}</AppText>
        ) : null}
        {!failed && !loading ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.providerId}:${item.modelId}`}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => {
              const isSelected = selected?.providerID === item.providerId && selected.modelID === item.modelId;
              return (
                <Pressable
                  onPress={() => onSelect({ providerID: item.providerId, modelID: item.modelId })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${item.name}, ${item.providerName}`}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: theme.colors.divider,
                      backgroundColor: pressed ? theme.colors.surface2 : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.labels}>
                    <AppText variant="body" numberOfLines={1}>{item.name}</AppText>
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {item.providerName} · {item.modelId}
                    </AppText>
                  </View>
                  {isSelected ? <Icon name="checkmark" size={layout.icon} color="accent" /> : null}
                </Pressable>
              );
            }}
          />
        ) : null}
        <Pressable
          onPress={() => onSelect(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === null }}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: theme.colors.divider, backgroundColor: pressed ? theme.colors.surface2 : 'transparent' },
          ]}
        >
          <AppText variant="body">{t('model.default')}</AppText>
          {selected === null ? <Icon name="checkmark" size={layout.icon} color="accent" /> : null}
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 420 },
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
