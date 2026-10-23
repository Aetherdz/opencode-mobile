const LETTER_CHAR = /\p{L}/u;
const RTL_SCRIPT_CHAR =
  /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Hebrew}\p{Script_Extensions=Syriac}\p{Script_Extensions=Thaana}\p{Script_Extensions=Nko}\p{Script_Extensions=Adlam}\p{Script_Extensions=Samaritan}\p{Script_Extensions=Mandaic}]/u;
const LRI = '\u2066';
const PDI = '\u2069';
// Include directional marks (ALM/LRM/RLM), embeddings/overrides, isolates,
// and deprecated directional controls; all can make untrusted text render
// differently from its stored/logged representation.
const BIDI_FORMATTING_CONTROL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u206F]/g;
// Latin/technical runs inside an Arabic sentence need their own direction
// context so punctuation such as ".env" and "https://..." stays intact.
const LTR_RUN =
  /(?:\/|~\/)?\.?[A-Za-z0-9][A-Za-z0-9._~:/\\?#@!$&'()*+,;=%+-]*(?:[ \t]+\.?[A-Za-z0-9][A-Za-z0-9._~:/\\?#@!$&'()*+,;=%+-]*)*/g;

export function textDirection(text: string, fallbackRTL: boolean): 'rtl' | 'ltr' {
  for (const char of text) {
    // Only letters are strong directional characters. Arabic punctuation,
    // combining marks, and Arabic-Indic numerals are weak/neutral and must not
    // decide paragraph direction before the first actual letter.
    if (LETTER_CHAR.test(char)) return RTL_SCRIPT_CHAR.test(char) ? 'rtl' : 'ltr';
  }
  return fallbackRTL ? 'rtl' : 'ltr';
}

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

/** Make invisible embedding/override controls visible so they cannot spoof text. */
export function visibleBidiControls(text: string): string {
  return text.replace(BIDI_FORMATTING_CONTROL, (control) => {
    const codePoint = control.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0');
    return `⟦U+${codePoint ?? '????'}⟧`;
  });
}

/**
 * Wraps Latin/technical runs in a left-to-right isolate (LRI ... PDI) when the
 * surrounding string is Arabic. This keeps file names, URLs, and versions from
 * being reordered by the bidi algorithm without changing the paragraph
 * direction.
 */
export function isolateMixed(text: string): string {
  if (!text) return text;
  const safeText = visibleBidiControls(text);
  if (!hasArabic(safeText)) return safeText;
  return safeText.replace(LTR_RUN, (run) => `${LRI}${run}${PDI}`);
}
