import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { QuestionItem, QuestionRequest } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

interface AnswerState {
  selected: string[];
  custom: string;
  customSelected: boolean;
}

function emptyAnswer(question: QuestionItem): AnswerState {
  return {
    selected: [],
    custom: '',
    customSelected: question.options.length === 0,
  };
}

function answerValues(question: QuestionItem, answer: AnswerState | undefined): string[] {
  if (!answer) return [];
  const custom = answer.custom.trim();
  if (question.multiple) {
    return [
      ...answer.selected,
      ...(answer.customSelected && custom ? [custom] : []),
    ];
  }
  if (answer.customSelected) return custom ? [custom] : [];
  return answer.selected.slice(0, 1);
}

function isComplete(question: QuestionItem, answer: AnswerState | undefined): boolean {
  const values = answerValues(question, answer);
  if (question.required && values.length === 0) return false;
  if (!question.multiple && values.length > 1) return false;
  if (typeof question.minItems === 'number' && values.length < question.minItems) return false;
  if (typeof question.maxItems === 'number' && values.length > question.maxItems) return false;
  return true;
}

export function QuestionSheet({
  request,
  onClose,
  onSubmit,
  onSkip,
}: {
  request: QuestionRequest | null;
  onClose: () => void;
  onSubmit: (answers: string[][]) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    if (!request) {
      activeId.current = null;
      setIndex(0);
      setAnswers([]);
      setSubmitting(false);
      setConfirmSkip(false);
      setError(null);
      return;
    }
    // A reconnect refresh returns a new object with the same id. Keep the
    // answers the user already typed instead of resetting the sheet.
    if (activeId.current === request.id) return;
    activeId.current = request.id;
    setIndex(0);
    setAnswers(request.questions.map(emptyAnswer));
    setSubmitting(false);
    setConfirmSkip(false);
    setError(null);
  }, [request]);

  const total = request?.questions.length ?? 0;
  const current = request?.questions[index];
  const currentAnswer = answers[index];
  const complete = useMemo(
    () => (current ? isComplete(current, currentAnswer) : false),
    [current, currentAnswer],
  );
  const allComplete = useMemo(
    () =>
      Boolean(
        request &&
          request.questions.every((question, questionIndex) =>
            isComplete(question, answers[questionIndex]),
          ),
      ),
    [answers, request],
  );

  if (!request || !current) return null;

  const updateCurrent = (patch: Partial<AnswerState>) => {
    setAnswers((state) => {
      const next = state.slice();
      next[index] = { ...(next[index] ?? emptyAnswer(current)), ...patch };
      return next;
    });
  };

  const selectOption = (value: string) => {
    if (submitting) return;
    hapticSelection();
    setError(null);
    if (current.multiple) {
      const selected = currentAnswer?.selected ?? [];
      if (selected.includes(value)) {
        updateCurrent({ selected: selected.filter((item) => item !== value) });
        return;
      }
      const customCount = currentAnswer?.customSelected && currentAnswer.custom.trim() ? 1 : 0;
      if (
        typeof current.maxItems === 'number' &&
        selected.length + customCount >= current.maxItems
      ) {
        hapticWarning();
        return;
      }
      updateCurrent({ selected: [...selected, value] });
      return;
    }
    updateCurrent({ selected: [value], custom: '', customSelected: false });
  };

  const toggleCustom = () => {
    if (submitting) return;
    hapticSelection();
    setError(null);
    if (current.multiple) {
      updateCurrent({ customSelected: !currentAnswer?.customSelected });
      return;
    }
    updateCurrent({ selected: [], customSelected: true });
  };

  const goNext = () => {
    if (submitting) return;
    if (!complete) {
      setError(
        currentAnswer?.customSelected && !current.options.length
          ? t('questions.customRequired')
          : t('questions.required'),
      );
      return;
    }
    setError(null);
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      void submit();
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!allComplete) {
      const missing = request.questions.findIndex(
        (question, questionIndex) => !isComplete(question, answers[questionIndex]),
      );
      if (missing >= 0) setIndex(missing);
      setError(t('questions.required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(request.questions.map((question, i) => answerValues(question, answers[i])));
      hapticSuccess();
      setSubmitting(false);
      onClose();
    } catch (submitError) {
      hapticError();
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : t('questions.sendError'));
    }
  };

  const skip = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSkip();
      setSubmitting(false);
      onClose();
    } catch (skipError) {
      hapticError();
      setSubmitting(false);
      setConfirmSkip(false);
      setError(skipError instanceof Error ? skipError.message : t('questions.sendError'));
    }
  };

  const customVisible = current.allowCustom;
  const customActive = Boolean(currentAnswer?.customSelected);

  return (
    <Sheet
      visible
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {error ? (
            <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          {confirmSkip ? (
            <>
              <AppText variant="meta" color="danger">
                {t('questions.skipBody')}
              </AppText>
              <Button
                label={t('questions.skip')}
                variant="danger"
                fullWidth
                loading={submitting}
                onPress={() => void skip()}
              />
              <Button
                label={t('common.cancel')}
                variant="secondary"
                fullWidth
                disabled={submitting}
                onPress={() => setConfirmSkip(false)}
              />
            </>
          ) : (
            <>
              <Button
                label={index < total - 1 ? t('questions.next') : t('questions.submit')}
                fullWidth
                loading={submitting}
                disabled={!complete}
                onPress={goNext}
              />
              {index > 0 ? (
                <Button
                  label={t('questions.back')}
                  variant="secondary"
                  fullWidth
                  disabled={submitting}
                  onPress={() => {
                    setError(null);
                    setIndex(index - 1);
                  }}
                />
              ) : null}
              <Button
                label={t('questions.skip')}
                variant="ghost"
                fullWidth
                disabled={submitting}
                onPress={() => {
                  if (submitting) return;
                  hapticWarning();
                  setConfirmSkip(true);
                }}
              />
            </>
          )}
        </View>
      }
    >
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="title" accessibilityRole="header">
              {t('questions.title')}
            </AppText>
            {total > 1 ? (
              <AppText variant="caption" color="text3" style={{ marginTop: theme.spacing.xs }}>
                {t('questions.progress', { current: index + 1, total })}
              </AppText>
            ) : null}
          </View>
          {total > 1 ? (
            <View style={[styles.progress, { gap: 4 }]}>
              {request.questions.map((question, questionIndex) => (
                <View
                  key={question.id}
                  style={{
                    width: 16,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor:
                      questionIndex <= index ? theme.colors.accentFill : theme.colors.line,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <ScrollView
          style={{ maxHeight: Math.max(220, height * 0.42) }}
          contentContainerStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="caption" color="text2">
            {current.header}
          </AppText>
          <AppText variant="body" weight="500" style={{ marginTop: theme.spacing.xs }}>
            {current.question}
          </AppText>
          {current.multiple ? (
            <AppText variant="caption" color="text3" style={{ marginTop: theme.spacing.xs }}>
              {t('questions.multipleHint')}
            </AppText>
          ) : null}

          <View
            accessibilityRole={current.multiple ? undefined : 'radiogroup'}
            accessibilityLabel={current.question}
            style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}
          >
            {current.options.map((option) => {
              const selected = currentAnswer?.selected.includes(option.value) ?? false;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectOption(option.value)}
                  disabled={submitting}
                  accessibilityRole={current.multiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: selected, disabled: submitting }}
                  accessibilityLabel={`${option.label}${
                    option.description ? `. ${option.description}` : ''
                  }`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: selected ? theme.colors.accent : theme.colors.line,
                      backgroundColor: selected
                        ? theme.colors.surface2
                        : pressed
                          ? theme.colors.surface1
                          : 'transparent',
                      borderRadius: theme.radii.md,
                      padding: theme.spacing.md,
                      gap: theme.spacing.md,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.indicator,
                      {
                        borderColor: selected ? theme.colors.accent : theme.colors.controlLine,
                        backgroundColor: selected ? theme.colors.accentFill : 'transparent',
                        borderRadius: current.multiple ? 6 : 11,
                        marginTop: 2,
                      },
                    ]}
                  >
                    {selected ? (
                      <Icon name="checkmark" size="xs" color="onAccent" />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{option.label}</AppText>
                    {option.description ? (
                      <AppText
                        variant="caption"
                        color="text2"
                        style={{ marginTop: theme.spacing.xs }}
                      >
                        {option.description}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {customVisible && current.options.length > 0 ? (
              <Pressable
                onPress={toggleCustom}
                disabled={submitting}
                accessibilityRole={current.multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: customActive, disabled: submitting }}
                accessibilityLabel={t('questions.custom')}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: customActive ? theme.colors.accent : theme.colors.line,
                    backgroundColor: customActive
                      ? theme.colors.surface2
                      : pressed
                        ? theme.colors.surface1
                        : 'transparent',
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.md,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.indicator,
                    {
                      borderColor: customActive
                        ? theme.colors.accent
                        : theme.colors.controlLine,
                      backgroundColor: customActive ? theme.colors.accentFill : 'transparent',
                      borderRadius: current.multiple ? 6 : 11,
                      marginTop: 2,
                    },
                  ]}
                >
                  {customActive ? (
                    <Icon name="checkmark" size="xs" color="onAccent" />
                  ) : null}
                </View>
                <AppText variant="body" style={{ flex: 1 }}>
                  {t('questions.custom')}
                </AppText>
              </Pressable>
            ) : null}

            {customVisible && customActive ? (
              <TextField
                value={currentAnswer?.custom ?? ''}
                onChangeText={(custom) => updateCurrent({ custom, customSelected: true })}
                placeholder={t('questions.customPlaceholder')}
                multiline
                maxLength={4000}
                inputStyle={{ minHeight: 76, textAlignVertical: 'top' }}
                containerStyle={{ marginTop: theme.spacing.xs }}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  option: {
    minHeight: 52,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  indicator: {
    width: 22,
    height: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
