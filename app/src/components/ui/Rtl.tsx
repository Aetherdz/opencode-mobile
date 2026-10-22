import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '@/state/settings';

const RtlContext = createContext(false);

export function useRtl(): boolean {
  return useContext(RtlContext);
}

/**
 * Applies the layout direction for the active locale. English is LTR; Arabic
 * is RTL. Text primitives still resolve their own direction per string, so
 * mixed Arabic/English content keeps the correct reading order.
 */
export function Rtl({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rtl = useSettings((state) => state.locale === 'ar');
  return (
    <RtlContext.Provider value={rtl}>
      <View style={[{ direction: rtl ? 'rtl' : 'ltr' }, style]}>{children}</View>
    </RtlContext.Provider>
  );
}
