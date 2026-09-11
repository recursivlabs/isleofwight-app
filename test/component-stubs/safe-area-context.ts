// react-native-safe-area-context stub: zero insets, provider renders children.
import * as React from 'react';
import { View } from 'react-native';

export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
export const SafeAreaView = View;
export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}
