import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { QuestionItem, QuestionRequest } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { layout } from '@/theme/layout';
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
    return [...answer.selected, ...(answer.customSelected && custom ? [custom] : [])];
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

export function InlineQuestionCard({
  request,
  collapsed,
  onToggle,
  onSubmit,
  onSkip,
}: {
  request: QuestionRequest;
  collapsed: boolean;
  onToggle: () => void;
  onSubmit: (answers: string[][]) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    if (activeId.current === request.id) return;
    activeId.current = request.id;
    setIndex(0);
    setAnswers(request.questions.map(emptyAnswer));
    setSubmitting(false);
    setConfirmSkip(false);
    setError(null);
  }, [request]);

  const total = request.questions.length;
  const current = request.questions[index];
  const currentAnswer = answers[index];
  const complete = useMemo(
    () => (current ? isComplete(current, currentAnswer) : false),
    [current, currentAnswer],
  );
  const allComplete = useMemo(
    () =>
      request.questions.every((question, questionIndex) =>
        isComplete(question, answers[questionIndex]),
      ),
    [answers, request.questions],
  );

  if (!current) return null;

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
      await onSubmit(
        request.questions.map((question, questionIndex) =>
          answerValues(question, answers[questionIndex]),
        ),
      );
      hapticSuccess();
      setSubmitting(false);
    } catch (submitError) {
      hapticError();
      setSubmitting(false);
      setError(
        submitError instanceof Error ? submitError.message : t('questions.sendError'),
      );
    }
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
    if (index < total - 1) setIndex(index + 1);
    else void submit();
  };

  const skip = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSkip();
      hapticWarning();
      setSubmitting(false);
    } catch (skipError) {
      hapticError();
      setSubmitting(false);
      setConfirmSkip(false);
      setError(
        skipError instanceof Error ? skipError.message : t('questions.sendError'),
      );
    }
  };

  const customVisible = current.allowCustom;
  const customActive = Boolean(currentAnswer?.customSelected);

  if (collapsed) {
    return (
      <Pressable
        onPress={() => {
          hapticSelection();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('questions.title')}
        accessibilityState={{ expanded: false }}
        style={({ pressed }) => [
          styles.card,
          styles.collapsed,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.strong,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name="help-circle-outline" size={layout.icon} color="textStrong" />
        <View style={styles.flex}>
          <AppText variant="fieldLabel" numberOfLines={1}>
            {current.question}
          </AppText>
          <AppText variant="helper" color="secondary" numberOfLines={1}>
            {total > 1
              ? t('questions.progress', { current: index + 1, total })
              : t('questions.title')}
          </AppText>
        </View>
        <Icon name="chevron-down" size={layout.icon} color="secondary" />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.strong,
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText variant="eyebrow12" color="secondary">
            {t('questions.title')}
          </AppText>
          {total > 1 ? (
            <AppText variant="helper" color="secondary" style={{ marginTop: 2 }}>
              {t('questions.progress', { current: index + 1, total })}
            </AppText>
          ) : null}
        </View>
        <IconButton
          label={t('common.close')}
          onPress={onToggle}
          disabled={submitting}
          size="sm"
          variant="borderless"
          hitSlop={layout.hitSlop}
          icon={<Icon name="chevron-up" size={layout.icon} color="secondary" />}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ gap: 10 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {current.header ? (
          <AppText variant="helper" color="secondary">
            {current.header}
          </AppText>
        ) : null}
        <AppText variant="body15" weight="500">
          {current.question}
        </AppText>
        {current.multiple ? (
          <AppText variant="helper" color="secondary">
            {t('questions.multipleHint')}
          </AppText>
        ) : null}

        <View
          accessibilityRole={current.multiple ? undefined : 'radiogroup'}
          accessibilityLabel={current.question}
          style={{ gap: 10 }}
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
                    borderColor: selected ? theme.colors.strong : theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.raised
                      : pressed
                        ? theme.colors.raised
                        : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.strong,
                      borderRadius: current.multiple ? 5 : 9,
                    },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[
                        styles.radioDot,
                        {
                          backgroundColor: theme.colors.primary,
                          borderRadius: current.multiple ? 2 : 4,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="body15">{option.label}</AppText>
                  {option.description ? (
                    <AppText variant="helper" color="secondary" style={{ marginTop: 2 }}>
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
                  borderColor: customActive ? theme.colors.strong : theme.colors.border,
                  backgroundColor: customActive
                    ? theme.colors.raised
                    : pressed
                      ? theme.colors.raised
                      : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: customActive ? theme.colors.primary : theme.colors.strong,
                    borderRadius: current.multiple ? 5 : 9,
                  },
                ]}
              >
                {customActive ? (
                  <View
                    style={[
                      styles.radioDot,
                      {
                        backgroundColor: theme.colors.primary,
                        borderRadius: current.multiple ? 2 : 4,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <AppText variant="body15" style={styles.flex}>
                {t('questions.custom')}
              </AppText>
            </Pressable>
          ) : null}

          {customVisible && customActive ? (
            <TextField
              design="new"
              value={currentAnswer?.custom ?? ''}
              onChangeText={(custom) => updateCurrent({ custom, customSelected: true })}
              placeholder={t('questions.customPlaceholder')}
              multiline
              maxLength={4000}
              fieldMinHeight={42}
              inputStyle={{ minHeight: 42, maxHeight: 120, textAlignVertical: 'top' }}
            />
          ) : null}
        </View>
      </ScrollView>

      {error ? (
        <AppText variant="helper" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      {confirmSkip ? (
        <View style={{ gap: 10 }}>
          <AppText variant="helper" color="secondary">
            {t('questions.skipBody')}
          </AppText>
          <View style={styles.footerRow}>
            <View style={styles.flex}>
              <Button
                design="new"
                size="sm"
                variant="danger"
                label={t('questions.skip')}
                loading={submitting}
                fullWidth
                onPress={() => void skip()}
              />
            </View>
            <View style={styles.flex}>
              <Button
                design="new"
                size="sm"
                variant="secondary"
                label={t('common.cancel')}
                disabled={submitting}
                fullWidth
                onPress={() => setConfirmSkip(false)}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Button
            design="new"
            size="sm"
            label={index < total - 1 ? t('questions.next') : t('questions.submit')}
            disabled={!complete}
            loading={submitting}
            fullWidth
            onPress={goNext}
          />
          <View style={styles.footerRow}>
            {index > 0 ? (
              <Button
                design="new"
                size="sm"
                variant="ghost"
                label={t('questions.back')}
                disabled={submitting}
                onPress={() => {
                  setError(null);
                  setIndex(index - 1);
                }}
              />
            ) : (
              <View />
            )}
            <Button
              design="new"
              size="sm"
              variant="ghost"
              label={t('questions.skip')}
              disabled={submitting}
              onPress={() => {
                hapticWarning();
                setConfirmSkip(true);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: layout.border,
    borderRadius: layout.radiusM,
    borderCurve: 'continuous',
    padding: 16,
    gap: 10,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  scroll: {
    maxHeight: 240,
  },
  option: {
    minHeight: 42,
    borderWidth: layout.border,
    borderRadius: layout.radiusS,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 8,
    height: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
