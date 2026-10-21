import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { absoluteUrl, authHeader } from '@/api/client';
import type { ChatMessage, MessageFile } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { FileChip } from '@/components/attachments/FileChip';
import { Markdown } from '@/components/markdown/Markdown';
import { ActivityChip } from '@/components/chat/ActivityChip';
import { AgentErrorCard } from '@/components/chat/AgentErrorCard';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { formatClock } from '@/lib/format';
import { hapticSelection } from '@/lib/haptics';
import { textDirection } from '@/lib/textDirection';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export interface MessageRowProps {
  message: ChatMessage;
  isFirstInGroup: boolean;
  showTime: boolean;
  reasoning?: string;
  onOpenImage: (uri: string, headers?: Record<string, string>) => void;
  onOpenFile: (file: MessageFile) => void;
  onRetry?: () => Promise<boolean>;
}

function isImage(file: MessageFile): boolean {
  return file.mime.startsWith('image/');
}

function WorkingChip() {
  const { t } = useI18n();
  return (
    <View style={[styles.working, { gap: 8 }]} accessibilityLabel={t('chat.agentWorking')}>
      <StatusIndicator status="running" />
      <AppText variant="helper" color="secondary">
        {t('chat.agentWorking')}
      </AppText>
    </View>
  );
}

function StreamingCaret() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(0.2, { duration: 900 }), -1, true);
    else opacity.value = 1;
  }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: 2,
          height: 18,
          borderRadius: 1,
          backgroundColor: theme.colors.primary,
          marginTop: 4,
        },
        style,
      ]}
    />
  );
}

function ReasoningBlock({ text }: { text: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Pressable
        onPress={() => {
          hapticSelection();
          setOpen((value) => !value);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('chat.reasoning')}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={({ pressed }) => [styles.reasoningButton, pressed && { opacity: 0.6 }]}
      >
        <Icon name="bulb-outline" size={16} color="secondary" />
        <AppText variant="helper" color="secondary">
          {t('chat.reasoning')}
        </AppText>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="secondary"
        />
      </Pressable>
      {open ? (
        <AppText
          variant="helper"
          color="secondary"
          style={{
            marginTop: 6,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        >
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

export const MessageRow = memo(function MessageRow({
  message,
  isFirstInGroup,
  showTime,
  reasoning,
  onOpenImage,
  onOpenFile,
  onRetry,
}: MessageRowProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const files = message.files ?? [];
  const images = files.filter(isImage);
  const documents = files.filter((file) => !isImage(file));

  if (message.role === 'system') {
    return (
      <View style={{ paddingVertical: theme.spacing.sm }}>
        <AppText variant="caption" color="text3" align="center">
          {message.text}
        </AppText>
      </View>
    );
  }

  const copy = async () => {
    hapticSelection();
    await Clipboard.setStringAsync(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'stretch',
        maxWidth: isUser ? '82%' : '100%',
      }}
      accessible={false}
    >
      {isAssistant && isFirstInGroup ? (
        <AppText
          variant="eyebrow12"
          color="secondary"
          style={{ marginBottom: 6 }}
        >
          {t('chat.assistant')}
        </AppText>
      ) : null}

      {isUser ? (
        <View
          style={[
            styles.userBubble,
            {
              backgroundColor: message.pending ? theme.colors.surface : theme.colors.raised,
              borderColor: theme.colors.border,
              borderWidth: message.pending ? 1 : 0,
              paddingHorizontal: 16,
              paddingVertical: 10,
              opacity: message.pending ? 0.72 : 1,
            },
          ]}
        >
          {images.length > 0 ? (
            <View style={[styles.imageRow, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
              {images.map((file) => (
                <Pressable
                  key={file.id}
                  onPress={() => {
                    hapticSelection();
                    onOpenImage(absoluteUrl(file.url), authHeader());
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('chat.viewImage')}: ${file.name}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Image
                    source={{ uri: absoluteUrl(file.url), headers: authHeader() }}
                    style={[
                      styles.thumb,
                      { borderRadius: theme.radii.md, borderColor: theme.colors.line },
                    ]}
                    contentFit="cover"
                    transition={120}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
          {documents.length > 0 ? (
            <View style={{ gap: theme.spacing.xs, marginBottom: message.text ? theme.spacing.sm : 0 }}>
              {documents.map((file) => (
                <FileChip
                  key={file.id}
                  name={file.name}
                  mime={file.mime}
                  size={file.size}
                  onPress={() => onOpenFile(file)}
                  variant="sent"
                />
              ))}
            </View>
          ) : null}
          {message.text || message.pending ? (
            <Pressable
              onLongPress={() => void copy()}
              delayLongPress={350}
              accessibilityRole="text"
              accessibilityLabel={
                message.text ? `${t('chat.you')}: ${message.text}` : t('chat.sending')
              }
              accessibilityHint={t('chat.copyMessage')}
              accessibilityActions={[{ name: 'copy', label: t('chat.copyMessage') }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'copy') void copy();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              {message.text ? (
                <AppText variant="body15" selectable bidiIsolation={false}>
                  {message.text}
                </AppText>
              ) : null}
              {message.pending ? (
                <AppText variant="helper" color="secondary" style={{ marginTop: 4 }}>
                  {t('chat.sending')}
                </AppText>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={{ maxWidth: 640 }}>
          {message.activities && message.activities.length > 0 ? (
            <ActivityChip activities={message.activities} />
          ) : null}
          {reasoning ? <ReasoningBlock text={reasoning} /> : null}
          {message.text ? (
            <Pressable
              onLongPress={() => void copy()}
              delayLongPress={400}
              accessibilityRole="text"
              accessibilityHint={t('chat.copyMessage')}
              accessibilityActions={[{ name: 'copy', label: t('chat.copyMessage') }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'copy') void copy();
              }}
            >
              <Markdown
                text={message.text}
                selectable
                design="chat"
                contentRTL={textDirection(message.text, theme.isRTL) === 'rtl'}
              />
            </Pressable>
          ) : message.status === 'streaming' ? (
            <WorkingChip />
          ) : null}
          {message.status === 'streaming' && message.text ? (
            <View style={{ flexDirection: 'row' }}>
              <StreamingCaret />
            </View>
          ) : null}
          {message.error ? <AgentErrorCard error={message.error} onRetry={onRetry} /> : null}
        </View>
      )}

      <View
        style={[
          styles.metaRow,
          {
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            gap: 8,
            marginTop: 4,
          },
        ]}
      >
        {copied ? (
          <AppText variant="helper" color="textStrong">
            {t('common.copied')}
          </AppText>
        ) : null}
        {showTime ? (
          <AppText variant="helper" color="secondary">
            {formatClock(message.createdAt, locale)}
          </AppText>
        ) : null}
        {isUser && message.source === 'telegram' ? (
          <AppText variant="helper" color="secondary">
            {t('sessions.sourceTelegram')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  userBubble: { borderRadius: 18 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: 72, height: 72, borderWidth: StyleSheet.hairlineWidth },
  agentLabel: { flexDirection: 'row', alignItems: 'center' },
  agentMark: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  working: {
    minHeight: 28,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  reasoningButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
