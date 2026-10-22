import { Text as RNText, useWindowDimensions, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';
import { hasArabic, isolateMixed, textDirection } from '@/lib/textDirection';
import { useRtl } from './Rtl';

type Variant =
  | 'greeting'
  | 'wordmark'
  | 'display'
  | 'title'
  | 'label'
  | 'body'
  | 'meta'
  | 'caption'
  | 'eyebrow'
  | 'code'
  | 'connectTitle'
  | 'sessionsTitle'
  | 'topBarTitle'
  | 'body15'
  | 'fieldLabel'
  | 'buttonLabel'
  | 'eyebrow12'
  | 'section'
  | 'helper'
  | 'subtitle13'
  | 'mono13'
  | 'pill';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof ThemeColors;
  mono?: boolean;
  align?: 'auto' | 'left' | 'right' | 'center';
  weight?: '400' | '500' | '600' | '700';
  /** Disable automatic LRI/PDI isolation for content with its own bidi handling. */
  bidiIsolation?: boolean;
}

export function AppText({
  variant = 'body',
  color = 'text',
  mono = false,
  align = 'auto',
  weight,
  bidiIsolation = true,
  style,
  ...props
}: AppTextProps) {
  const theme = useTheme();
  const forcedRtl = useRtl();
  const { fontScale } = useWindowDimensions();
  const scale = fontScale > 0 ? fontScale : 1;
  const typography = theme.typography[variant];
  const scaledTypography =
    scale === 1
      ? typography
      : { ...typography, lineHeight: Math.round(typography.lineHeight * scale) };
  const content = typeof props.children === 'string' ? props.children : '';
  const arabicContent = hasArabic(content);
  const isRtl = theme.isRTL || forcedRtl;
  const isBodyArabic = arabicContent && (variant === 'body' || variant === 'body15');
  const displayContent =
    typeof props.children === 'string'
      ? mono || !bidiIsolation
        ? props.children
        : isolateMixed(props.children)
      : props.children;
  const direction = content ? textDirection(content, isRtl) : isRtl ? 'rtl' : 'ltr';
  const resolvedAlign = align === 'auto' ? (isRtl ? 'right' : 'left') : align;
  const useArabicFace = content ? arabicContent : isRtl;
  const resolvedWeight =
    weight ??
    (variant === 'connectTitle' || variant === 'sessionsTitle'
      ? '700'
      : variant === 'display' ||
          variant === 'title' ||
          variant === 'eyebrow' ||
          variant === 'eyebrow12' ||
          variant === 'section' ||
          variant === 'topBarTitle'
        ? '600'
        : variant === 'label' ||
            variant === 'fieldLabel' ||
            variant === 'buttonLabel' ||
            variant === 'pill'
          ? '500'
          : '400');
  const sansFamily = useArabicFace
    ? resolvedWeight === '700'
      ? theme.fonts.sansArabicBold
      : resolvedWeight === '600'
        ? theme.fonts.sansArabicSemiBold
        : resolvedWeight === '500'
          ? theme.fonts.sansArabicMedium
          : theme.fonts.sansArabic
    : resolvedWeight === '700'
      ? theme.fonts.sansBold
      : resolvedWeight === '600'
        ? theme.fonts.sansSemiBold
        : resolvedWeight === '500'
          ? theme.fonts.sansMedium
          : theme.fonts.sans;
  const family =
    variant === 'greeting' && !useArabicFace ? theme.fonts.serif : sansFamily;
  const arabicTracking =
    arabicContent && 'letterSpacing' in typography ? { letterSpacing: 0 } : null;
  const arabicLineHeight = isBodyArabic
    ? { lineHeight: Math.round((variant === 'body15' ? 24 : 28) * scale) }
    : null;
  return (
    <RNText
      {...props}
      style={[
        scaledTypography,
        arabicTracking,
        {
          color: theme.colors[color],
          textAlign: resolvedAlign,
          writingDirection: direction,
          ...(!mono ? { fontFamily: family, fontWeight: '400' as const } : null),
          ...arabicLineHeight,
          ...(mono
            ? {
                fontFamily:
                  weight === '500' || weight === '600' || weight === '700'
                    ? theme.fonts.monoMedium
                    : theme.fonts.mono,
                fontWeight: '400' as const,
                writingDirection: 'ltr' as const,
                textAlign: 'left' as const,
              }
            : null),
        },
        style,
      ]}
    >
      {displayContent}
    </RNText>
  );
}
