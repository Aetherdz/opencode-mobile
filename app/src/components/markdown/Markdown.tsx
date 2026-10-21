import { useMemo, type ReactElement, type ReactNode } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  Platform,
} from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useRtl } from '@/components/ui/Rtl';
import { useTheme } from '@/theme/ThemeProvider';
import {
  fonts,
  radii,
  spacing,
  typography,
  type ThemeColors,
} from '@/theme/tokens';
import { CodeBlock } from './CodeBlock';

const MAX_BLOCK_DEPTH = 4;
const MAX_INLINE_DEPTH = 6;
const MAX_BLOCKS = 4000;
const MAX_INLINE_CHARS = 100000;
const TABLE_DIVIDER = /^:?-{3,}:?$/;
const URL_TRIM_PAIRS: readonly (readonly [string, string])[] = [
  [')', '('],
  [']', '['],
  ['}', '{'],
];

type TableAlignment = 'left' | 'center' | 'right';

interface ParagraphBlock {
  kind: 'paragraph';
  text: string;
}

interface HeadingBlock {
  kind: 'heading';
  level: number;
  text: string;
}

interface CodeNode {
  kind: 'code';
  code: string;
  language?: string;
}

interface ListBlock {
  kind: 'list';
  ordered: boolean;
  start: number;
  items: Block[][];
}

interface QuoteBlock {
  kind: 'blockquote';
  blocks: Block[];
}

interface RuleBlock {
  kind: 'rule';
}

interface TableBlock {
  kind: 'table';
  header: string[];
  align: TableAlignment[];
  rows: string[][];
}

type Block =
  | ParagraphBlock
  | HeadingBlock
  | CodeNode
  | ListBlock
  | QuoteBlock
  | RuleBlock
  | TableBlock;

type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'em'; children: InlineNode[] }
  | { kind: 'link'; href: string; children: InlineNode[]; autolink: boolean };

interface FenceMarker {
  char: string;
  length: number;
  info: string;
}

interface HeadingMarker {
  level: number;
  text: string;
}

interface ListMarker {
  ordered: boolean;
  start: number;
  indent: number;
  contentIndent: number;
  content: string;
}

type MarkdownStyles = ReturnType<typeof createStyles>;

interface RenderContext {
  styles: MarkdownStyles;
  selectable: boolean;
}

function isWordChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '_'
  );
}

function readFence(line: string): FenceMarker | null {
  let index = 0;
  while (index < 3 && line[index] === ' ') {
    index += 1;
  }
  const char = line[index];
  if (char !== '`' && char !== '~') return null;
  let end = index;
  while (line[end] === char) {
    end += 1;
  }
  const length = end - index;
  if (length < 3) return null;
  return { char, length, info: line.slice(end).trim() };
}

function readHeading(line: string): HeadingMarker | null {
  let index = 0;
  while (index < 3 && line[index] === ' ') {
    index += 1;
  }
  let hashEnd = index;
  while (line[hashEnd] === '#') {
    hashEnd += 1;
  }
  const level = hashEnd - index;
  if (level < 1 || level > 6) return null;
  if (line[hashEnd] !== ' ' && line[hashEnd] !== '\t') return null;
  const text = line.slice(hashEnd).trim().replace(/[ \t]+#+[ \t]*$/, '');
  if (!text) return null;
  return { level, text };
}

function isHorizontalRule(line: string): boolean {
  const text = line.trim();
  if (text.length < 3) return false;
  const marker = text[0];
  if (marker !== '-' && marker !== '*' && marker !== '_') return false;
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === marker) {
      count += 1;
      continue;
    }
    if (char !== ' ' && char !== '\t') return false;
  }
  return count >= 3;
}

function readListMarker(line: string): ListMarker | null {
  let index = 0;
  while (index < 3 && line[index] === ' ') {
    index += 1;
  }
  const indent = index;
  const marker = line[index];

  if (marker === '-' || marker === '*' || marker === '+') {
    if (line[index + 1] !== ' ' && line[index + 1] !== '\t') return null;
    let contentStart = index + 1;
    while (line[contentStart] === ' ' || line[contentStart] === '\t') {
      contentStart += 1;
    }
    return {
      ordered: false,
      start: 1,
      indent,
      contentIndent: contentStart,
      content: line.slice(contentStart),
    };
  }

  if (marker !== undefined && marker >= '0' && marker <= '9') {
    let end = index;
    let digits = 0;
    while (end < line.length && line[end] >= '0' && line[end] <= '9' && digits < 9) {
      end += 1;
      digits += 1;
    }
    if (end === index) return null;
    const delimiter = line[end];
    if (delimiter !== '.' && delimiter !== ')') return null;
    if (line[end + 1] !== ' ' && line[end + 1] !== '\t') return null;
    let contentStart = end + 1;
    while (line[contentStart] === ' ' || line[contentStart] === '\t') {
      contentStart += 1;
    }
    const start = Number.parseInt(line.slice(index, end), 10);
    return {
      ordered: true,
      start: Number.isFinite(start) ? start : 1,
      indent,
      contentIndent: contentStart,
      content: line.slice(contentStart),
    };
  }

  return null;
}

function readQuoteLine(line: string): string | null {
  let index = 0;
  while (index < 3 && line[index] === ' ') {
    index += 1;
  }
  if (line[index] !== '>') return null;
  index += 1;
  if (line[index] === ' ') index += 1;
  return line.slice(index);
}

function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) {
    text = text.slice(1);
  }
  if (text.endsWith('|') && !text.endsWith('\\|')) {
    text = text.slice(0, -1);
  }

  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index];
  const divider = lines[index + 1];
  if (header === undefined || divider === undefined) return false;
  if (!header.includes('|') || !divider.includes('|')) return false;
  const headerCells = splitTableRow(header);
  if (!headerCells.some((cell) => cell.length > 0)) return false;
  const dividerCells = splitTableRow(divider);
  if (dividerCells.length === 0) return false;
  return dividerCells.every((cell) => TABLE_DIVIDER.test(cell.trim()));
}

function parseAlignment(cell: string | undefined): TableAlignment {
  const value = (cell ?? '').trim();
  if (value.startsWith(':') && value.endsWith(':')) return 'center';
  if (value.endsWith(':')) return 'right';
  return 'left';
}

function readTable(
  lines: string[],
  start: number,
): { block: TableBlock; next: number } | null {
  if (!isTableStart(lines, start)) return null;

  const header = splitTableRow(lines[start] ?? '');
  const divider = splitTableRow(lines[start + 1] ?? '');
  const align = header.map((_, index) => parseAlignment(divider[index]));
  const rows: string[][] = [];
  let index = start + 2;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) break;
    if (!line.includes('|')) break;
    if (readFence(line) !== null || readHeading(line) !== null || isHorizontalRule(line)) {
      break;
    }
    const cells = splitTableRow(line);
    while (cells.length < header.length) {
      cells.push('');
    }
    rows.push(cells.slice(0, header.length));
    index += 1;
  }

  return {
    block: { kind: 'table', header, align, rows },
    next: index,
  };
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index];
  if (line === undefined) return false;
  if (readFence(line) !== null) return true;
  if (readHeading(line) !== null) return true;
  if (isHorizontalRule(line)) return true;
  if (readQuoteLine(line) !== null) return true;
  if (readListMarker(line) !== null) return true;
  if (isTableStart(lines, index)) return true;
  return false;
}

function parseBlocks(source: string, depth = 0): Block[] {
  const normalized = source.replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return [];
  if (depth > MAX_BLOCK_DEPTH) {
    return [{ kind: 'paragraph', text: normalized }];
  }

  const lines = normalized.split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    if (blocks.length >= MAX_BLOCKS) {
      const rest = lines.slice(index).join('\n');
      if (rest.trim()) blocks.push({ kind: 'paragraph', text: rest });
      break;
    }

    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = readFence(line);
    if (fence !== null) {
      let end = index + 1;
      while (end < lines.length) {
        const candidate = readFence(lines[end] ?? '');
        if (
          candidate !== null &&
          candidate.char === fence.char &&
          candidate.length >= fence.length &&
          candidate.info === ''
        ) {
          break;
        }
        end += 1;
      }
      const code = lines.slice(index + 1, end).join('\n');
      const rawLanguage = fence.info.split(/[ \t]+/)[0];
      const language = rawLanguage || undefined;
      blocks.push({ kind: 'code', code, language: language || undefined });
      index = end < lines.length ? end + 1 : lines.length;
      continue;
    }

    const heading = readHeading(line);
    if (heading !== null) {
      blocks.push({ kind: 'heading', level: heading.level, text: heading.text });
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    const quote = readQuoteLine(line);
    if (quote !== null) {
      const quoted: string[] = [quote];
      let end = index + 1;
      while (end < lines.length) {
        const candidate = readQuoteLine(lines[end] ?? '');
        if (candidate === null) break;
        quoted.push(candidate);
        end += 1;
      }
      blocks.push({
        kind: 'blockquote',
        blocks: parseBlocks(quoted.join('\n'), depth + 1),
      });
      index = end;
      continue;
    }

    const list = readListMarker(line);
    if (list !== null) {
      const items: string[] = [list.content];
      let end = index + 1;
      while (end < lines.length) {
        const candidateLine = lines[end] ?? '';
        if (!candidateLine.trim()) {
          let nextIndex = end + 1;
          while (nextIndex < lines.length && !(lines[nextIndex] ?? '').trim()) {
            nextIndex += 1;
          }
          const nextMarker = readListMarker(lines[nextIndex] ?? '');
          if (
            nextMarker !== null &&
            nextMarker.ordered === list.ordered &&
            nextMarker.indent === list.indent
          ) {
            end = nextIndex;
            continue;
          }
          if (
            nextMarker !== null &&
            nextMarker.ordered === list.ordered &&
            nextMarker.indent > list.indent
          ) {
            end = nextIndex;
            continue;
          }
          break;
        }

        const nextMarker = readListMarker(candidateLine);
        if (
          nextMarker !== null &&
          nextMarker.ordered === list.ordered &&
          nextMarker.indent <= list.indent
        ) {
          items.push(nextMarker.content);
          end += 1;
          continue;
        }

        if (candidateLine[0] === ' ' || candidateLine[0] === '\t') {
          let cut = 0;
          while (
            cut < list.contentIndent &&
            (candidateLine[cut] === ' ' || candidateLine[cut] === '\t')
          ) {
            cut += 1;
          }
          const dedented = candidateLine.slice(cut);
          const last = items.length - 1;
          items[last] = `${items[last]}\n${dedented}`;
          end += 1;
          continue;
        }

        break;
      }
      blocks.push({
        kind: 'list',
        ordered: list.ordered,
        start: list.start,
        items: items.map((item) => parseBlocks(item, depth + 1)),
      });
      index = end;
      continue;
    }

    const table = readTable(lines, index);
    if (table !== null) {
      blocks.push(table.block);
      index = table.next;
      continue;
    }

    const paragraphLines: string[] = [line];
    let end = index + 1;
    while (end < lines.length) {
      const candidate = lines[end] ?? '';
      if (!candidate.trim()) break;
      if (isBlockStart(lines, end)) break;
      paragraphLines.push(candidate);
      end += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraphLines.join('\n') });
    index = end;
  }

  return blocks;
}

function pushText(nodes: InlineNode[], text: string): void {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last !== undefined && last.kind === 'text') {
    last.text += text;
    return;
  }
  nodes.push({ kind: 'text', text });
}

function findMarker(text: string, marker: string, from: number): number {
  let index = text.indexOf(marker, from);
  while (index !== -1) {
    const before = text[index - 1] ?? '';
    const after = text[index + 1] ?? '';

    if (before === '\\') {
      index = text.indexOf(marker, index + marker.length);
      continue;
    }

    if (marker.length === 1) {
      if (after === marker) {
        index = text.indexOf(marker, index + 2);
        continue;
      }
      if (marker === '_' && isWordChar(before) && isWordChar(after)) {
        index = text.indexOf(marker, index + 1);
        continue;
      }
    }

    if (index === from || before === '' || /\s/.test(before)) {
      index = text.indexOf(marker, index + marker.length);
      continue;
    }

    return index;
  }
  return -1;
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === char) count += 1;
  }
  return count;
}

function readBareUrl(text: string, start: number): string | null {
  const head = text.slice(start, start + 8).toLowerCase();
  if (!head.startsWith('http://') && !head.startsWith('https://')) return null;
  const previous = text[start - 1] ?? '';
  if (isWordChar(previous)) return null;

  let end = start;
  while (end < text.length) {
    const char = text[end];
    if (
      char === ' ' ||
      char === '\n' ||
      char === '\r' ||
      char === '\t' ||
      char === '<' ||
      char === '>' ||
      char === '"' ||
      char === "'" ||
      char === '`'
    ) {
      break;
    }
    end += 1;
  }

  let url = text.slice(start, end);
  while (url.length > 0 && '.,;:!?'.includes(url[url.length - 1] ?? '')) {
    url = url.slice(0, -1);
  }
  let trimmed = true;
  while (trimmed && url.length > 0) {
    trimmed = false;
    for (const [close, open] of URL_TRIM_PAIRS) {
      if (url.endsWith(close) && countChar(url, close) > countChar(url, open)) {
        url = url.slice(0, -1);
        trimmed = true;
        break;
      }
    }
  }

  const schemeLength = url.toLowerCase().startsWith('https://') ? 8 : 7;
  if (url.length <= schemeLength) return null;
  return url;
}

function isSafeUrl(value: string): boolean {
  const url = value.trim();
  const match = /^(https?):\/\//i.exec(url);
  if (!match) return false;
  const rest = url.slice(match[0].length);
  if (rest.length === 0 || rest.startsWith('/')) return false;
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    if (code <= 0x20 || code === 0x7f) return false;
  }
  return true;
}

function readLinkEnd(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '\n') return -1;
    if (char === ')') {
      if (depth === 0) return index;
      depth -= 1;
      continue;
    }
    if (char === '(') {
      depth += 1;
      if (depth > 4) return -1;
    }
  }
  return -1;
}

function parseInline(source: string, depth = 0): InlineNode[] {
  if (depth > MAX_INLINE_DEPTH || source.length > MAX_INLINE_CHARS) {
    return source ? [{ kind: 'text', text: source }] : [];
  }

  const nodes: InlineNode[] = [];
  let buffer = '';
  let index = 0;
  const length = source.length;

  const flush = (): void => {
    if (buffer) {
      pushText(nodes, buffer);
      buffer = '';
    }
  };

  while (index < length) {
    const char = source[index];

    if (char === '\\' && index + 1 < length) {
      const next = source[index + 1] ?? '';
      if ('\\`*_[]()#->|'.includes(next)) {
        buffer += next;
        index += 2;
        continue;
      }
    }

    if (char === '`') {
      let ticks = 1;
      while (source[index + ticks] === '`') {
        ticks += 1;
      }
      const fence = '`'.repeat(ticks);
      const close = source.indexOf(fence, index + ticks);
      if (close !== -1) {
        let content = source.slice(index + ticks, close);
        if (
          content.length >= 2 &&
          content.startsWith(' ') &&
          content.endsWith(' ') &&
          content.trim() !== ''
        ) {
          content = content.slice(1, -1);
        }
        if (content) {
          flush();
          nodes.push({ kind: 'code', text: content });
        }
        index = close + ticks;
        continue;
      }
      buffer += fence;
      index += ticks;
      continue;
    }

    if (char === '*' || char === '_') {
      const double = source[index + 1] === char;
      const marker = double ? char + char : char;
      if (char === '_' && !double) {
        const before = source[index - 1] ?? '';
        const after = source[index + 1] ?? '';
        if (isWordChar(before) && isWordChar(after)) {
          buffer += char;
          index += 1;
          continue;
        }
      }
      const close = findMarker(source, marker, index + marker.length);
      if (close !== -1) {
        const inner = source.slice(index + marker.length, close);
        if (inner.trim()) {
          flush();
          nodes.push({
            kind: double ? 'strong' : 'em',
            children: parseInline(inner, depth + 1),
          });
          index = close + marker.length;
          continue;
        }
      }
      buffer += marker;
      index += marker.length;
      continue;
    }

    if (char === '[') {
      const labelEnd = source.indexOf('](', index + 1);
      if (labelEnd !== -1 && labelEnd - index <= 500) {
        const rawLabel = source.slice(index + 1, labelEnd);
        if (!rawLabel.includes('[')) {
          const close = readLinkEnd(source, labelEnd + 2);
          if (close !== -1) {
            const href = source.slice(labelEnd + 2, close).trim();
            if (isSafeUrl(href)) {
              flush();
              const children = rawLabel
                ? parseInline(rawLabel, depth + 1)
                : [{ kind: 'text' as const, text: href }];
              nodes.push({ kind: 'link', href, children, autolink: false });
              index = close + 1;
              continue;
            }
          }
        }
      }
      buffer += char;
      index += 1;
      continue;
    }

    if (char === 'h' || char === 'H') {
      const url = readBareUrl(source, index);
      if (url !== null) {
        flush();
        nodes.push({
          kind: 'link',
          href: url,
          children: [{ kind: 'text', text: url }],
          autolink: true,
        });
        index += url.length;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return nodes;
}

function inlinePlainText(nodes: InlineNode[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.kind === 'text' || node.kind === 'code') {
      text += node.text;
    } else {
      text += inlinePlainText(node.children);
    }
  }
  return text;
}

function openLink(href: string): void {
  if (!isSafeUrl(href)) return;
  hapticSelection();
  try {
    void Linking.openURL(href).catch(() => undefined);
  } catch {
    // Ignore platform failures for unavailable or invalid external links.
  }
}

function renderInline(
  nodes: InlineNode[],
  context: RenderContext,
  keyPrefix: string,
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.kind === 'text') {
      return node.text;
    }
    if (node.kind === 'code') {
      return (
        <Text key={key} style={context.styles.inlineCode}>
          {node.text}
        </Text>
      );
    }
    if (node.kind === 'strong') {
      return (
        <Text key={key} style={context.styles.strong}>
          {renderInline(node.children, context, key)}
        </Text>
      );
    }
    if (node.kind === 'em') {
      return (
        <Text key={key} style={context.styles.em}>
          {renderInline(node.children, context, key)}
        </Text>
      );
    }

    const label = inlinePlainText(node.children).trim() || node.href;
    return (
      <Text
        key={key}
        accessibilityLabel={label}
        accessibilityRole="link"
        onPress={() => openLink(node.href)}
        style={[context.styles.link, node.autolink && context.styles.ltrText]}
      >
        {renderInline(node.children, context, key)}
      </Text>
    );
  });
}

function tableAlignmentStyle(
  alignment: TableAlignment,
  styles: MarkdownStyles,
): TextStyle {
  if (alignment === 'center') return styles.tableAlignCenter;
  if (alignment === 'right') return styles.tableAlignRight;
  return styles.tableAlignLeft;
}

function renderTable(
  block: TableBlock,
  context: RenderContext,
  key: string,
): ReactElement {
  const columns = Math.max(1, block.header.length);
  const width = Math.max(160, columns * 128);
  const lastColumn = columns - 1;

  return (
    <ScrollView
      key={key}
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={context.styles.tableScrollContent}
      style={context.styles.tableScroll}
    >
      <View style={[context.styles.table, { width }]}>
        <View
          style={[
            context.styles.tableRow,
            context.styles.tableHeaderRow,
            block.rows.length === 0 && context.styles.tableRowLast,
          ]}
        >
          {block.header.map((cell, cellIndex) => (
            <View
              key={`${key}-head-${cellIndex}`}
              style={[
                context.styles.tableCell,
                cellIndex === lastColumn && context.styles.tableCellLast,
              ]}
            >
              <Text
                selectable={context.selectable}
                style={[
                  context.styles.tableText,
                  context.styles.tableHeaderText,
                  tableAlignmentStyle(block.align[cellIndex] ?? 'left', context.styles),
                ]}
              >
                {renderInline(
                  parseInline(cell),
                  context,
                  `${key}-head-${cellIndex}`,
                )}
              </Text>
            </View>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View
            key={`${key}-row-${rowIndex}`}
            style={[
              context.styles.tableRow,
              rowIndex === block.rows.length - 1 && context.styles.tableRowLast,
            ]}
          >
            {row.map((cell, cellIndex) => (
              <View
                key={`${key}-row-${rowIndex}-${cellIndex}`}
                style={[
                  context.styles.tableCell,
                  cellIndex === lastColumn && context.styles.tableCellLast,
                ]}
              >
                <Text
                  selectable={context.selectable}
                  style={[
                    context.styles.tableText,
                    tableAlignmentStyle(block.align[cellIndex] ?? 'left', context.styles),
                  ]}
                >
                  {renderInline(
                    parseInline(cell),
                    context,
                    `${key}-row-${rowIndex}-${cellIndex}`,
                  )}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function renderBlock(
  block: Block,
  context: RenderContext,
  key: string,
  muted: boolean,
): ReactElement {
  if (block.kind === 'paragraph') {
    return (
      <Text
        key={key}
        selectable={context.selectable}
        style={[context.styles.paragraph, muted && context.styles.mutedText]}
      >
        {renderInline(parseInline(block.text), context, key)}
      </Text>
    );
  }

  if (block.kind === 'heading') {
    const level = Math.min(6, Math.max(1, block.level));
    const headingStyle =
      level === 1
        ? context.styles.h1
        : level === 2
          ? context.styles.h2
          : level === 3
            ? context.styles.h3
            : level === 4
              ? context.styles.h4
              : level === 5
                ? context.styles.h5
                : context.styles.h6;
    return (
      <Text
        key={key}
        accessibilityRole="header"
        selectable={context.selectable}
        style={[headingStyle, muted && context.styles.mutedText]}
      >
        {renderInline(parseInline(block.text), context, key)}
      </Text>
    );
  }

  if (block.kind === 'code') {
    return <CodeBlock key={key} code={block.code} language={block.language} />;
  }

  if (block.kind === 'list') {
    return (
      <View key={key} style={context.styles.list}>
        {block.items.map((item, itemIndex) => (
          <View key={`${key}-item-${itemIndex}`} style={context.styles.listRow}>
            <Text style={context.styles.listMarker}>
              {block.ordered ? `${block.start + itemIndex}.` : '\u2022'}
            </Text>
            <View style={context.styles.listContent}>
              {item.length > 0 ? (
                renderBlocks(
                  item,
                  context,
                  `${key}-item-${itemIndex}`,
                  muted,
                )
              ) : (
                <Text
                  selectable={context.selectable}
                  style={[context.styles.paragraph, muted && context.styles.mutedText]}
                >
                  {' '}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (block.kind === 'blockquote') {
    return (
      <View key={key} style={context.styles.quote}>
        {renderBlocks(block.blocks, context, `${key}-quote`, true)}
      </View>
    );
  }

  if (block.kind === 'table') {
    return renderTable(block, context, key);
  }

  return <View key={key} style={context.styles.rule} />;
}

function renderBlocks(
  blocks: Block[],
  context: RenderContext,
  keyPrefix: string,
  muted = false,
): ReactNode[] {
  return blocks.map((block, index) =>
    renderBlock(block, context, `${keyPrefix}-${index}`, muted),
  );
}

export function Markdown({
  text,
  selectable = false,
  compact = false,
  design = 'default',
  contentRTL,
}: {
  text: string;
  selectable?: boolean;
  compact?: boolean;
  design?: 'default' | 'chat';
  contentRTL?: boolean;
}): ReactElement {
  const { colors } = useTheme();
  const { isRTL: i18nRtl } = useI18n();
  const forcedRtl = useRtl();
  const isRTL = i18nRtl || forcedRtl;
  const styles = useMemo(
    () => createStyles(colors, isRTL, compact, contentRTL ?? isRTL, design),
    [colors, isRTL, compact, contentRTL, design],
  );
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const context: RenderContext = { styles, selectable };

  return <View style={styles.container}>{renderBlocks(blocks, context, 'md')}</View>;
}

function createStyles(
  colors: ThemeColors,
  isRTL: boolean,
  compact: boolean,
  contentRTL: boolean,
  design: 'default' | 'chat',
) {
  const alignment: TextStyle = {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: contentRTL ? 'rtl' : 'ltr',
  };
  const chat = design === 'chat';
  const bodySize = chat ? 15 : compact ? 14 : typography.body.fontSize;
  const bodyLineHeight = chat ? 22 : compact ? 20 : typography.body.lineHeight;
  const bodyFont = contentRTL ? fonts.sansArabic : fonts.sans;
  const bodySemiBold = contentRTL ? fonts.sansArabicSemiBold : fonts.sansSemiBold;

  return StyleSheet.create({
    container: {
      width: '100%',
      ...(Platform.OS === 'web' ? null : { direction: isRTL ? ('rtl' as const) : ('ltr' as const) }),
      gap: compact ? spacing.xs : spacing.sm,
    },
    paragraph: {
      ...alignment,
      color: colors.text,
      fontFamily: bodyFont,
      fontSize: bodySize,
      lineHeight: bodyLineHeight,
    },
    mutedText: {
      color: colors.text2,
    },
    h1: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 20 : 24,
      lineHeight: compact ? 26 : 30,
      fontWeight: '400',
    },
    h2: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 18 : 21,
      lineHeight: compact ? 24 : 27,
      fontWeight: '400',
    },
    h3: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 16 : 18,
      lineHeight: compact ? 22 : 24,
      fontWeight: '400',
    },
    h4: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 15 : 17,
      lineHeight: compact ? 20 : 23,
      fontWeight: '400',
    },
    h5: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 14 : 16,
      lineHeight: compact ? 19 : 22,
      fontWeight: '400',
    },
    h6: {
      ...alignment,
      color: colors.text,
      fontFamily: bodySemiBold,
      fontSize: compact ? 13 : 15,
      lineHeight: compact ? 18 : 21,
      fontWeight: '400',
    },
    strong: {
      fontFamily: bodySemiBold,
      fontWeight: '400',
    },
    em: {
      fontStyle: 'italic',
    },
    inlineCode: {
      color: colors.text,
      backgroundColor: colors.surface2,
      fontFamily: fonts.mono,
      fontSize: compact ? 12 : typography.code.fontSize,
      lineHeight: compact ? 18 : 20,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.xs,
      writingDirection: 'ltr',
    },
    link: {
      color: colors.accent,
      textDecorationLine: 'underline',
      textDecorationColor: colors.accent,
    },
    ltrText: {
      writingDirection: 'ltr',
    },
    list: {
      width: '100%',
      gap: spacing.xs,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    listMarker: {
      minWidth: 20,
      color: colors.text2,
      fontFamily: bodyFont,
      fontSize: bodySize,
      lineHeight: bodyLineHeight,
      writingDirection: 'ltr',
      textAlign: isRTL ? 'right' : 'left',
    },
    listContent: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    quote: {
      width: '100%',
      borderLeftWidth: isRTL ? 0 : 3,
      borderRightWidth: isRTL ? 3 : 0,
      borderLeftColor: colors.accent,
      borderRightColor: colors.accent,
      paddingLeft: isRTL ? 0 : spacing.md,
      paddingRight: isRTL ? spacing.md : 0,
      gap: spacing.xs,
    },
    rule: {
      width: '100%',
      height: 1,
      backgroundColor: colors.line,
      marginVertical: spacing.xs,
    },
    tableScroll: {
      maxWidth: '100%',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    tableScrollContent: {
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    table: {
      backgroundColor: colors.surface1,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.xs,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
    },
    tableRow: {
      flexDirection: 'row',
      ...(Platform.OS === 'web' ? null : { direction: 'ltr' as const }),
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    tableRowLast: {
      borderBottomWidth: 0,
    },
    tableHeaderRow: {
      backgroundColor: colors.surface2,
    },
    tableCell: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRightWidth: 1,
      borderRightColor: colors.line,
    },
    tableCellLast: {
      borderRightWidth: 0,
    },
    tableText: {
      color: colors.text,
      fontFamily: fonts.sans,
      fontSize: typography.meta.fontSize,
      lineHeight: typography.meta.lineHeight,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    tableHeaderText: {
      fontFamily: fonts.sansSemiBold,
      fontWeight: '400',
    },
    tableAlignLeft: {
      textAlign: 'left',
    },
    tableAlignCenter: {
      textAlign: 'center',
    },
    tableAlignRight: {
      textAlign: 'right',
    },
  });
}
