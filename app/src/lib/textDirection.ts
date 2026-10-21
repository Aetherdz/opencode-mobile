const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z]/;
const LRI = '\u2066';
const PDI = '\u2069';
// Latin/technical runs inside an Arabic sentence need their own direction
// context so punctuation such as ".env" and "https://..." stays intact.
const LTR_RUN =
  /\.?[A-Za-z0-9][A-Za-z0-9._~:/?#@!$&'()*+,;=%+-]*(?:[ \t]+\.?[A-Za-z0-9][A-Za-z0-9._~:/?#@!$&'()*+,;=%+-]*)*/g;

export function textDirection(text: string, fallbackRTL: boolean): 'rtl' | 'ltr' {
  for (const char of text) {
    if (RTL_CHAR.test(char)) return 'rtl';
    if (LTR_CHAR.test(char)) return 'ltr';
  }
  if (/\d/.test(text)) return 'ltr';
  return fallbackRTL ? 'rtl' : 'ltr';
}

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

/**
 * Wraps Latin/technical runs in a left-to-right isolate (LRI ... PDI) when the
 * surrounding string is Arabic. This keeps file names, URLs, and versions from
 * being reordered by the bidi algorithm without changing the paragraph
 * direction.
 */
export function isolateMixed(text: string): string {
  if (!text || !hasArabic(text)) return text;
  return text.replace(LTR_RUN, (run) => `${LRI}${run}${PDI}`);
}
