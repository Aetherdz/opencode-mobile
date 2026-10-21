import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  Platform,
} from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import {
  HIT_SLOP,
  MIN_TARGET,
  fonts,
  radii,
  spacing,
  typography,
  type ThemeColors,
} from '@/theme/tokens';

const COLLAPSE_LINES = 18;
const MAX_HIGHLIGHT_CHARS = 40000;

type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'tag' | 'attr';

interface Token {
  text: string;
  kind: TokenKind;
}

type LanguageFamily = 'js' | 'json' | 'bash' | 'python' | 'yaml' | 'css' | 'html';

interface LanguageConfig {
  lineComments: readonly string[];
  blockComments: readonly (readonly [string, string])[];
  stringDelims: readonly string[];
  keywords: ReadonlySet<string>;
  atRules?: boolean;
}

const JS_KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if',
  'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'keyof',
  'let', 'module', 'namespace', 'new', 'null', 'of', 'private', 'protected',
  'public', 'readonly', 'return', 'satisfies', 'static', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void',
  'while', 'with', 'yield',
]);

const JSON_KEYWORDS = new Set(['true', 'false', 'null']);

const BASH_KEYWORDS = new Set([
  'case', 'do', 'done', 'elif', 'else', 'esac', 'export', 'fi', 'for',
  'function', 'if', 'in', 'local', 'readonly', 'return', 'select', 'then',
  'until', 'while',
]);

const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

const YAML_KEYWORDS = new Set([
  'False', 'None', 'True', 'false', 'no', 'null', 'off', 'on', 'true', 'yes',
]);

const CSS_KEYWORDS = new Set([
  'inherit', 'initial', 'none', 'revert', 'unset',
]);

const LANGUAGE_CONFIGS: Record<Exclude<LanguageFamily, 'html'>, LanguageConfig> = {
  js: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    stringDelims: ["'", '"', '`'],
    keywords: JS_KEYWORDS,
  },
  json: {
    lineComments: [],
    blockComments: [],
    stringDelims: ['"'],
    keywords: JSON_KEYWORDS,
  },
  bash: {
    lineComments: ['#'],
    blockComments: [],
    stringDelims: ["'", '"'],
    keywords: BASH_KEYWORDS,
  },
  python: {
    lineComments: ['#'],
    blockComments: [],
    stringDelims: ["'", '"'],
    keywords: PYTHON_KEYWORDS,
  },
  yaml: {
    lineComments: ['#'],
    blockComments: [],
    stringDelims: ["'", '"'],
    keywords: YAML_KEYWORDS,
  },
  css: {
    lineComments: [],
    blockComments: [['/*', '*/']],
    stringDelims: ["'", '"'],
    keywords: CSS_KEYWORDS,
    atRules: true,
  },
};

const JS_ALIASES = new Set([
  'js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'mjs', 'cjs', 'mts', 'cts',
]);
const JSON_ALIASES = new Set(['json', 'jsonc', 'json5']);
const BASH_ALIASES = new Set(['bash', 'sh', 'shell', 'zsh', 'fish']);
const PYTHON_ALIASES = new Set(['py', 'python', 'python3']);
const YAML_ALIASES = new Set(['yaml', 'yml']);
const CSS_ALIASES = new Set(['css', 'scss', 'less']);
const HTML_ALIASES = new Set(['html', 'htm', 'xml', 'svg', 'xhtml']);

function resolveLanguage(language?: string): LanguageFamily | null {
  const raw = (language ?? '').trim().toLowerCase();
  if (!raw) return null;
  const first = raw.split(/[\s,{]/)[0];
  if (!first) return null;
  const name = first.replace(/^\./, '');
  if (!name) return null;
  if (JS_ALIASES.has(name)) return 'js';
  if (JSON_ALIASES.has(name)) return 'json';
  if (BASH_ALIASES.has(name)) return 'bash';
  if (PYTHON_ALIASES.has(name)) return 'python';
  if (YAML_ALIASES.has(name)) return 'yaml';
  if (CSS_ALIASES.has(name)) return 'css';
  if (HTML_ALIASES.has(name)) return 'html';
  return null;
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isIdentStart(char: string): boolean {
  return isLetter(char) || char === '_' || char === '$';
}

function isIdentPart(char: string): boolean {
  return isIdentStart(char) || isDigit(char);
}

function isTagNameChar(char: string): boolean {
  return isLetter(char) || isDigit(char) || char === '_' || char === '-' || char === ':' || char === '@';
}

function readStringEnd(code: string, start: number, quote: string): number {
  const length = code.length;
  const triple =
    (quote === '"' || quote === "'") && code.startsWith(quote + quote + quote, start);
  const delimiter = triple ? quote.repeat(3) : quote;
  const allowsNewline = triple || quote === '`';
  let index = start + delimiter.length;
  while (index < length) {
    const char = code[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (!allowsNewline && (char === '\n' || char === '\r')) {
      return index;
    }
    if (code.startsWith(delimiter, index)) {
      return index + delimiter.length;
    }
    index += 1;
  }
  return length;
}

function readNumberEnd(code: string, start: number): number {
  const length = code.length;
  const second = code[start + 1];
  if (
    code[start] === '0' &&
    (second === 'x' || second === 'X' || second === 'b' || second === 'B' || second === 'o' || second === 'O')
  ) {
    let index = start + 2;
    while (index < length) {
      const char = code[index];
      if (isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F') || char === '_') {
        index += 1;
        continue;
      }
      break;
    }
    return index;
  }

  let index = start;
  while (index < length && (isDigit(code[index]) || code[index] === '_')) {
    index += 1;
  }
  if (code[index] === '.') {
    index += 1;
    while (index < length && (isDigit(code[index]) || code[index] === '_')) {
      index += 1;
    }
  }
  if (code[index] === 'e' || code[index] === 'E') {
    let exponent = index + 1;
    if (code[exponent] === '+' || code[exponent] === '-') {
      exponent += 1;
    }
    let hasDigit = false;
    while (exponent < length && isDigit(code[exponent])) {
      hasDigit = true;
      exponent += 1;
    }
    if (hasDigit) {
      index = exponent;
    }
  }
  return index;
}

function tokenizeGeneric(code: string, config: LanguageConfig): Token[] {
  const tokens: Token[] = [];
  let plain = '';
  let index = 0;
  const length = code.length;

  const flush = (): void => {
    if (plain) {
      tokens.push({ text: plain, kind: 'plain' });
      plain = '';
    }
  };

  const add = (text: string, kind: TokenKind): void => {
    if (!text) return;
    if (kind === 'plain') {
      plain += text;
      return;
    }
    flush();
    tokens.push({ text, kind });
  };

  while (index < length) {
    let advanced = false;

    for (const marker of config.lineComments) {
      if (code.startsWith(marker, index)) {
        const newline = code.indexOf('\n', index);
        const end = newline === -1 ? length : newline;
        add(code.slice(index, end), 'comment');
        index = end;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;

    for (const [open, close] of config.blockComments) {
      if (code.startsWith(open, index)) {
        const found = code.indexOf(close, index + open.length);
        const end = found === -1 ? length : found + close.length;
        add(code.slice(index, end), 'comment');
        index = end;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;

    const char = code[index];

    if (config.atRules && char === '@') {
      let end = index + 1;
      while (end < length && isIdentPart(code[end])) {
        end += 1;
      }
      add(code.slice(index, end), 'keyword');
      index = end;
      continue;
    }

    if (config.atRules && code.startsWith('!important', index)) {
      add('!important', 'keyword');
      index += 10;
      continue;
    }

    if (config.stringDelims.includes(char)) {
      const end = readStringEnd(code, index, char);
      add(code.slice(index, end), 'string');
      index = end;
      continue;
    }

    if (isDigit(char) || (char === '.' && isDigit(code[index + 1] ?? ''))) {
      const end = readNumberEnd(code, index);
      add(code.slice(index, end), 'number');
      index = end;
      continue;
    }

    if (isIdentStart(char)) {
      let end = index + 1;
      while (end < length && isIdentPart(code[end])) {
        end += 1;
      }
      const word = code.slice(index, end);
      add(word, config.keywords.has(word) ? 'keyword' : 'plain');
      index = end;
      continue;
    }

    add(char, 'plain');
    index += 1;
  }

  flush();
  return tokens;
}

function readHtmlStringEnd(tag: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < tag.length) {
    if (tag[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return tag.length;
}

function tokenizeTag(tag: string): Token[] {
  const tokens: Token[] = [];
  const length = tag.length;
  let index = 0;

  if (tag.startsWith('</')) {
    tokens.push({ text: '</', kind: 'tag' });
    index = 2;
  } else if (tag.startsWith('<!')) {
    tokens.push({ text: '<!', kind: 'tag' });
    index = 2;
  } else {
    tokens.push({ text: '<', kind: 'tag' });
    index = 1;
  }

  const nameStart = index;
  while (index < length && isTagNameChar(tag[index])) {
    index += 1;
  }
  if (index > nameStart) {
    tokens.push({ text: tag.slice(nameStart, index), kind: 'keyword' });
  }

  while (index < length) {
    const char = tag[index];

    if (char === '"' || char === "'") {
      const end = readHtmlStringEnd(tag, index, char);
      tokens.push({ text: tag.slice(index, end), kind: 'string' });
      index = end;
      continue;
    }

    if (char === '>' || char === '/') {
      tokens.push({ text: char, kind: 'tag' });
      index += 1;
      continue;
    }

    if (char === '=') {
      tokens.push({ text: char, kind: 'plain' });
      index += 1;
      continue;
    }

    if (isTagNameChar(char)) {
      let end = index + 1;
      while (end < length && (isTagNameChar(tag[end]) || tag[end] === '.')) {
        end += 1;
      }
      tokens.push({ text: tag.slice(index, end), kind: 'attr' });
      index = end;
      continue;
    }

    let end = index + 1;
    while (
      end < length &&
      !isTagNameChar(tag[end]) &&
      tag[end] !== '"' &&
      tag[end] !== "'" &&
      tag[end] !== '=' &&
      tag[end] !== '>' &&
      tag[end] !== '/'
    ) {
      end += 1;
    }
    tokens.push({ text: tag.slice(index, end), kind: 'plain' });
    index = end;
  }

  return tokens;
}

function tokenizeHtml(code: string): Token[] {
  const tokens: Token[] = [];
  let plain = '';
  let index = 0;
  const length = code.length;

  const flush = (): void => {
    if (plain) {
      tokens.push({ text: plain, kind: 'plain' });
      plain = '';
    }
  };

  while (index < length) {
    if (code.startsWith('<!--', index)) {
      flush();
      const found = code.indexOf('-->', index + 4);
      const end = found === -1 ? length : found + 3;
      tokens.push({ text: code.slice(index, end), kind: 'comment' });
      index = end;
      continue;
    }

    const char = code[index];
    const next = code[index + 1] ?? '';
    if (char === '<' && (isLetter(next) || next === '/' || next === '!')) {
      flush();
      let end = index + 1;
      let quote: string | null = null;
      while (end < length) {
        const tagChar = code[end];
        if (quote !== null) {
          if (tagChar === quote) quote = null;
        } else if (tagChar === '"' || tagChar === "'") {
          quote = tagChar;
        } else if (tagChar === '>') {
          end += 1;
          break;
        }
        end += 1;
      }
      const tagTokens = tokenizeTag(code.slice(index, end));
      for (const token of tagTokens) {
        if (token.text) tokens.push(token);
      }
      index = end;
      continue;
    }

    plain += char;
    index += 1;
  }

  flush();
  return tokens;
}

function tokenize(code: string, language?: string): Token[] {
  const family = resolveLanguage(language);
  if (!family) {
    return code ? [{ text: code, kind: 'plain' }] : [];
  }
  if (family === 'html') {
    return tokenizeHtml(code);
  }
  return tokenizeGeneric(code, LANGUAGE_CONFIGS[family]);
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps): ReactElement {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wrap, setWrap] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const lines = useMemo(() => {
    const normalized = code.replace(/\r\n?/g, '\n');
    const parts = normalized.split('\n');
    if (parts.length > 1 && parts[parts.length - 1] === '') {
      parts.pop();
    }
    return parts;
  }, [code]);

  const lineCount = lines.length;
  const needsCollapse = lineCount > COLLAPSE_LINES;
  const visibleText = useMemo(() => {
    if (needsCollapse && !expanded) {
      return lines.slice(0, COLLAPSE_LINES).join('\n');
    }
    return lines.join('\n');
  }, [expanded, lines, needsCollapse]);

  const displayText = visibleText.length > 0 ? visibleText : ' ';

  const tokens = useMemo(() => {
    if (displayText.length > MAX_HIGHLIGHT_CHARS) {
      return null;
    }
    return tokenize(displayText, language);
  }, [displayText, language]);

  const tokenStyles = useMemo<Record<TokenKind, TextStyle>>(
    () => ({
      plain: {},
      keyword: { color: colors.accent },
      string: { color: colors.text2 },
      number: { color: colors.text2 },
      comment: { color: colors.text3 },
      tag: { color: colors.accent },
      attr: { color: colors.text2 },
    }),
    [colors],
  );

  const codeChildren = useMemo<ReactNode[]>(() => {
    if (tokens === null) {
      return [displayText];
    }
    return tokens.map((token, index) => {
      if (token.kind === 'plain') {
        return token.text;
      }
      return (
        <Text key={`${token.kind}-${index}`} style={tokenStyles[token.kind]}>
          {token.text}
        </Text>
      );
    });
  }, [displayText, tokenStyles, tokens]);

  const styles = useMemo(
    () => createStyles(colors, isRTL),
    [colors, isRTL],
  );

  const languageLabel = useMemo(() => {
    const raw = (language ?? '').trim().replace(/\s+/g, ' ');
    const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '');
    if (!cleaned) return 'code';
    if (cleaned.length > 24) return `${cleaned.slice(0, 24)}...`;
    return cleaned;
  }, [language]);

  const showAllLabel = t('code.showAll', { count: lineCount });
  const collapseLabel = t('code.collapse');
  const copyLabel = copied ? t('common.copied') : t('common.copy');

  const handleCopy = async (): Promise<void> => {
    hapticSelection();
    try {
      const saved = await Clipboard.setStringAsync(code);
      if (!saved) return;
      setCopied(true);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  };

  const codeText = (
    <Text selectable style={[styles.code, wrap && styles.codeWrapped]}>
      {codeChildren}
    </Text>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.language}>
          {languageLabel}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={t('diff.wrap')}
            accessibilityRole="button"
            accessibilityState={{ selected: wrap }}
            hitSlop={HIT_SLOP}
            onPress={() => {
              hapticSelection();
              setWrap((value) => !value);
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text numberOfLines={1} style={[styles.buttonText, wrap && styles.buttonTextActive]}>
              {t('diff.wrap')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={copyLabel}
            accessibilityRole="button"
            hitSlop={HIT_SLOP}
            onPress={() => {
              void handleCopy();
            }}
            style={({ pressed }) => [
              styles.button,
              styles.copyButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.buttonText, copied && styles.buttonTextActive]}
            >
              {copyLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {wrap ? (
        <View style={styles.codeWrapView}>{codeText}</View>
      ) : (
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.codeContent}
          style={styles.codeScroll}
        >
          {codeText}
        </ScrollView>
      )}

      {needsCollapse ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityLabel={expanded ? collapseLabel : showAllLabel}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => {
              hapticSelection();
              setExpanded((value) => !value);
            }}
            style={({ pressed }) => [styles.footerButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.footerText}>
              {expanded ? collapseLabel : showAllLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      ...(Platform.OS === 'web' ? null : { direction: isRTL ? ('rtl' as const) : ('ltr' as const) }),
      overflow: 'hidden',
    },
    header: {
      minHeight: MIN_TARGET,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    language: {
      flexShrink: 1,
      color: colors.text2,
      fontFamily: fonts.monoMedium,
      fontSize: typography.caption.fontSize,
      lineHeight: typography.caption.lineHeight,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    button: {
      minHeight: MIN_TARGET,
      minWidth: MIN_TARGET,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.xs,
    },
    copyButton: {
      minWidth: 56,
    },
    buttonPressed: {
      backgroundColor: colors.surface3,
    },
    buttonText: {
      color: colors.text2,
      fontSize: typography.caption.fontSize,
      lineHeight: typography.caption.lineHeight,
      textAlign: 'center',
    },
    buttonTextActive: {
      color: colors.accent,
    },
    codeScroll: {
      maxWidth: '100%',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    codeContent: {
      minHeight: MIN_TARGET,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    codeWrapView: {
      minHeight: MIN_TARGET,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    code: {
      color: colors.text,
      fontFamily: fonts.mono,
      fontSize: typography.code.fontSize,
      lineHeight: typography.code.lineHeight,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    codeWrapped: {
      flexShrink: 1,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
      alignItems: 'stretch',
    },
    footerButton: {
      minHeight: MIN_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    footerText: {
      color: colors.text2,
      fontSize: typography.caption.fontSize,
      lineHeight: typography.caption.lineHeight,
    },
  });
}
