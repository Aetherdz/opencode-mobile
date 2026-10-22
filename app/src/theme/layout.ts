/**
 * Layout constants for the Connect, Sessions, and Home Chat redesign.
 * Screens must use these values instead of ad-hoc numbers.
 */
export const layout = {
  padX: 20,
  icon: 20,
  iconBtn: 36,
  iconBtnLg: 40,
  hitSlop: 4,
  btn: 44,
  btnSm: 40,
  field: 46,
  search: 48,
  pill: 34,
  chip: 40,
  rowPadY: 12,
  radiusS: 12,
  radiusM: 18,
  radiusL: 26,
  border: 1,
  focus: 2,
  topBar: 48,
  logo: 36,
  composerGap: 10,
  timelineGap: 14,
  sectionGap: 12,
} as const;

export const hitSlop4 = {
  top: layout.hitSlop,
  right: layout.hitSlop,
  bottom: layout.hitSlop,
  left: layout.hitSlop,
} as const;
