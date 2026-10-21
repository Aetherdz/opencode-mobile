import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

const RtlContext = createContext(false);

export function useRtl(): boolean {
  return useContext(RtlContext);
}

/**
 * Forces RTL layout for the redesigned screens without changing the global
 * I18nManager or the rest of the app. Text alignment is still explicit in
 * AppText so English copy stays LTR while sitting on the right.
 */
export function Rtl({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RtlContext.Provider value={true}>
      <View style={[{ direction: 'rtl' }, style]}>{children}</View>
    </RtlContext.Provider>
  );
}
