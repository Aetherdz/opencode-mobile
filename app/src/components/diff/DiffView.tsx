import * as Clipboard from 'expo-clipboard';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View, Platform} from 'react-native';

import type { DiffFile } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing, type ThemeColors } from '@/theme/tokens';

const PATCH_LINE_LIMIT = 2000;
const PREVIEW_LINE_LIMIT = 800;

type DiffLineKind = 'meta' | 'hunk' | 'add' | 'delete' | 'context';

interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldNumber?: number;
  newNumber?: number;
}

interface ParsedPatch {
  lines: DiffLine[];
  numbered: boolean;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function splitPatchLines(patch: string): string[] {
  if (!patch) return [];
  const normalized = patch.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function parsePatch(rawLines: string[]): ParsedPatch {
  const lines: DiffLine[] = [];
  let oldNumber = 0;
  let newNumber = 0;
  let inHunk = false;
  let numbered = true;

  for (const raw of rawLines) {
    if (raw.startsWith('diff --git ')) {
      inHunk = false;
      lines.push({ kind: 'meta', text: raw });
      continue;
    }

    if (raw.startsWith('@@')) {
      const match = HUNK_HEADER.exec(raw);
      if (match) {
        oldNumber = Number(match[1]);
        newNumber = Number(match[3]);
        inHunk = true;
      } else {
        inHunk = false;
        numbered = false;
      }
      lines.push({ kind: 'hunk', text: raw });
      continue;
    }

    if (!inHunk) {
      lines.push({ kind: 'meta', text: raw });
      continue;
    }

    if (raw.startsWith('\\')) {
      lines.push({ kind: 'meta', text: raw });
      continue;
    }

    if (raw.startsWith('+')) {
      lines.push({ kind: 'add', text: raw, newNumber });
      newNumber += 1;
      continue;
    }

    if (raw.startsWith('-')) {
      lines.push({ kind: 'delete', text: raw, oldNumber });
      oldNumber += 1;
      continue;
    }

    if (raw.startsWith(' ') || raw.length === 0) {
      lines.push({ kind: 'context', text: raw, oldNumber, newNumber });
      oldNumber += 1;
      newNumber += 1;
      continue;
    }

    numbered = false;
    lines.push({ kind: 'context', text: raw });
  }

  return { lines, numbered };
}

function statusIcon(status: DiffFile['status']): IconName {
  switch (status) {
    case 'added':
      return 'add-circle-outline';
    case 'deleted':
      return 'remove-circle-outline';
    default:
      return 'pencil-outline';
  }
}

function statusLabelKey(status: DiffFile['status']): string {
  switch (status) {
    case 'added':
      return 'diff.added';
    case 'deleted':
      return 'diff.deleted';
    default:
      return 'diff.modified';
  }
}

function fileKey(file: DiffFile, index: number): string {
  return `${index}:${file.file}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { gap: spacing.sm },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface1,
      borderColor: colors.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 56,
    },
    toggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    pathWrap: { flex: 1, minWidth: 0 },
    path: { fontSize: 12, lineHeight: 18 },
    counts: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    count: { fontSize: 12, lineHeight: 18 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.xs,
    },
    button: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.full,
    },
    buttonPressed: { backgroundColor: colors.surface2 },
    body: {
      backgroundColor: colors.canvas,
      borderTopColor: colors.line,
      borderTopWidth: StyleSheet.hairlineWidth,
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    wrappedBody: { paddingVertical: spacing.xs },
    scrollContent: { flexGrow: 1, minWidth: '100%', paddingVertical: spacing.xs },
    lines: { minWidth: '100%' },
    row: {
      flexDirection: 'row',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
      alignItems: 'flex-start',
      minWidth: '100%',
      paddingRight: spacing.sm,
    },
    rowAdd: {
      backgroundColor: colors.successSurface,
      borderLeftColor: colors.accent,
      borderLeftWidth: 2,
    },
    rowDelete: {
      backgroundColor: colors.dangerSurface,
      borderLeftColor: colors.controlLine,
      borderLeftWidth: 2,
    },
    rowHunk: {
      backgroundColor: colors.surface2,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    rowMeta: { paddingLeft: spacing.sm },
    gutter: {
      flexDirection: 'row',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
      flexShrink: 0,
      paddingLeft: spacing.sm,
      paddingRight: spacing.sm,
      marginRight: spacing.xs,
      borderRightColor: colors.line,
      borderRightWidth: StyleSheet.hairlineWidth,
    },
    gutterCell: {
      width: 42,
      fontSize: 11,
      lineHeight: 20,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    code: {
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 20,
    },
    codeWrap: { flex: 1 },
    codeNoWrap: { flexShrink: 0 },
    codeContext: { color: colors.text2 },
    codeAdd: { color: colors.accent },
    codeDelete: { color: colors.text2 },
    codeMeta: { color: colors.text3 },
    codeHunk: { color: colors.accent },
    truncation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface2,
      borderTopColor: colors.line,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    truncationText: { flex: 1, fontSize: 12, lineHeight: 16 },
  });

type DiffStyles = ReturnType<typeof createStyles>;

function DiffLineRow({
  line,
  numbered,
  wrap,
  styles,
}: {
  line: DiffLine;
  numbered: boolean;
  wrap: boolean;
  styles: DiffStyles;
}) {
  const showGutter = numbered && line.kind !== 'meta' && line.kind !== 'hunk';

  const rowTone =
    line.kind === 'add'
      ? styles.rowAdd
      : line.kind === 'delete'
        ? styles.rowDelete
        : line.kind === 'hunk'
          ? styles.rowHunk
          : line.kind === 'meta'
            ? styles.rowMeta
            : null;

  const codeTone =
    line.kind === 'add'
      ? styles.codeAdd
      : line.kind === 'delete'
        ? styles.codeDelete
        : line.kind === 'meta'
          ? styles.codeMeta
          : line.kind === 'hunk'
            ? styles.codeHunk
            : styles.codeContext;

  return (
    <View style={[styles.row, rowTone]}>
      {showGutter ? (
        <View style={styles.gutter}>
          <AppText variant="caption" color="text3" mono style={styles.gutterCell}>
            {line.oldNumber === undefined ? '' : String(line.oldNumber)}
          </AppText>
          <AppText variant="caption" color="text3" mono style={styles.gutterCell}>
            {line.newNumber === undefined ? '' : String(line.newNumber)}
          </AppText>
        </View>
      ) : null}
      <AppText
        variant="caption"
        mono
        style={[styles.code, codeTone, wrap ? styles.codeWrap : styles.codeNoWrap]}
      >
        {line.text.length > 0 ? line.text : ' '}
      </AppText>
    </View>
  );
}

function DiffBody({
  patch,
  wrap,
  styles,
  colors,
}: {
  patch: string;
  wrap: boolean;
  styles: DiffStyles;
  colors: ThemeColors;
}) {
  const { t } = useI18n();
  const allLines = React.useMemo(() => splitPatchLines(patch), [patch]);
  const truncated = allLines.length > PATCH_LINE_LIMIT;

  const visibleLines = React.useMemo(
    () => (truncated ? allLines.slice(0, PREVIEW_LINE_LIMIT) : allLines),
    [allLines, truncated],
  );

  const parsed = React.useMemo(() => parsePatch(visibleLines), [visibleLines]);

  const rows = parsed.lines.map((line, index) => (
    <DiffLineRow
      key={index}
      line={line}
      numbered={parsed.numbered}
      wrap={wrap}
      styles={styles}
    />
  ));

  const content = <View style={styles.lines}>{rows}</View>;

  return (
    <View style={styles.body}>
      {wrap ? (
        <View style={styles.wrappedBody}>{content}</View>
      ) : (
        <ScrollView
          horizontal
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          showsHorizontalScrollIndicator
        >
          {content}
        </ScrollView>
      )}
      {truncated ? (
        <View style={styles.truncation}>
          <Icon name="information-circle-outline" size="xs" color="text3" />
          <AppText variant="caption" color="text3" style={styles.truncationText}>
            {t('diff.preview', {
              limit: PREVIEW_LINE_LIMIT,
              total: allLines.length,
            })}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function FileDiffCard({
  file,
  expanded,
  onToggle,
  styles,
}: {
  file: DiffFile;
  expanded: boolean;
  onToggle: () => void;
  styles: DiffStyles;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [wrap, setWrap] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyPath = React.useCallback(async () => {
    hapticSelection();
    try {
      await Clipboard.setStringAsync(file.file);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard failures are non-fatal.
    }
  }, [file.file]);

  const statusLabel = t(statusLabelKey(file.status));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            hapticSelection();
            onToggle();
          }}
          style={({ pressed }) => [
            styles.toggle,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${statusLabel}. ${file.file}. ${t('diff.added')} ${file.additions}. ${t('diff.deleted')} ${file.deletions}.`}
        >
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size="xs"
            color="text3"
          />
          <Icon name={statusIcon(file.status)} size="xs" color="text3" />
          <View style={styles.pathWrap}>
            <AppText
              variant="caption"
              mono
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.path}
            >
              {file.file}
            </AppText>
          </View>
          <View style={styles.counts}>
            <AppText variant="caption" mono color="accent" style={styles.count}>
              {`+${file.additions}`}
            </AppText>
            <AppText variant="caption" mono color="danger" style={styles.count}>
              {`-${file.deletions}`}
            </AppText>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              hapticSelection();
              setWrap((value) => !value);
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('diff.wrap')}
            accessibilityState={{ selected: wrap }}
          >
            <Icon
              name="return-down-back-outline"
              size="xs"
              color={wrap ? 'accent' : 'text3'}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              void copyPath();
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={copied ? t('common.copied') : t('diff.copyPath')}
          >
            <Icon
              name={copied ? 'checkmark' : 'copy-outline'}
              size="xs"
              color={copied ? 'accent' : 'text3'}
            />
          </Pressable>
        </View>
      </View>

      {expanded ? <DiffBody patch={file.patch} wrap={wrap} styles={styles} colors={colors} /> : null}
    </View>
  );
}

export function DiffView(props: {
  files: DiffFile[];
  emptyLabel?: string;
}): React.ReactElement {
  const { files, emptyLabel } = props;
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const signature = files.map((file) => file.file).join('\u0000');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const first = files[0];
    return first ? { [fileKey(first, 0)]: true } : {};
  });
  const signatureRef = React.useRef(signature);

  React.useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    const first = files[0];
    setExpanded(first ? { [fileKey(first, 0)]: true } : {});
  }, [files, signature]);

  const toggle = React.useCallback((key: string) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  if (files.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="git-compare-outline" size="sm" color="text3" />
        <AppText variant="meta" color="text2" align="center">
          {emptyLabel ?? t('diff.empty')}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {files.map((file, index) => {
        const key = fileKey(file, index);
        return (
          <FileDiffCard
            key={key}
            file={file}
            expanded={expanded[key] === true}
            onToggle={() => toggle(key)}
            styles={styles}
          />
        );
      })}
    </View>
  );
}
