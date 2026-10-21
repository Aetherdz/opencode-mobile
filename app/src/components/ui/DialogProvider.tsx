import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Sheet } from './Sheet';

export type DialogActionVariant = 'default' | 'cancel' | 'destructive';

export interface DialogAction {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: DialogActionVariant;
}

export interface DialogOptions {
  title?: string;
  message?: string;
  actions?: DialogAction[];
}

interface DialogContextValue {
  showDialog: (options: DialogOptions) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider.');
  return value;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const showDialog = useCallback(
    (next: DialogOptions) => {
      setOptions({
        ...next,
        actions: next.actions?.length ? next.actions : [{ label: t('common.ok') }],
      });
    },
    [t],
  );

  const close = useCallback(() => setOptions(null), []);

  const value = useMemo(() => ({ showDialog }), [showDialog]);
  const actions = options?.actions ?? [];

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Sheet visible={Boolean(options)} onClose={close} title={options?.title}>
        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          {options?.message ? (
            <AppText variant="body" color="text2">
              {options.message}
            </AppText>
          ) : null}
          <View
            style={[
              styles.group,
              {
                borderColor: theme.colors.line,
                borderRadius: theme.radii.md,
                borderCurve: 'continuous',
              },
            ]}
          >
            {actions.map((action, index) => {
              const color =
                action.variant === 'destructive'
                  ? 'danger'
                  : action.variant === 'cancel'
                    ? 'text2'
                    : 'text';
              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    hapticSelection();
                    close();
                    void action.onPress?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      minHeight: 52,
                      paddingHorizontal: theme.spacing.lg,
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: theme.colors.line,
                      backgroundColor: pressed ? theme.colors.surface2 : 'transparent',
                    },
                  ]}
                >
                  <AppText variant="label" color={color} align="center">
                    {action.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Sheet>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
