// react-native-gesture-handler stub. Gestures are native-driven and out of
// scope under jsdom; GestureDetector renders its children untouched.
import * as React from 'react';
import { View } from 'react-native';

function chainable() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const self = new Proxy(chain, {
    get: () => () => self,
  });
  return self;
}

export const Gesture = {
  Pan: chainable,
  Tap: chainable,
  Pinch: chainable,
};

export function GestureDetector({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export const GestureHandlerRootView = View;
