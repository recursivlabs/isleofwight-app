// react-native-reanimated stub. Animation is out of scope for component
// behavior tests; Animated.View renders as a plain View and the worklet
// helpers become synchronous no-ops.
import * as React from 'react';
import { View } from 'react-native';

const AnimatedView = React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
  React.createElement(View as never, { ...props, ref }),
);
AnimatedView.displayName = 'Animated.View';

const Animated = { View: AnimatedView };
export default Animated;

export function useSharedValue<T>(initial: T) {
  return { value: initial };
}
export function useAnimatedStyle(factory: () => Record<string, unknown>) {
  try {
    return factory();
  } catch {
    return {};
  }
}
export function withTiming<T>(value: T, _config?: unknown, callback?: (finished: boolean) => void): T {
  callback?.(true);
  return value;
}
export function withSpring<T>(value: T): T {
  return value;
}
export function interpolate(_value: number, _input: number[], output: number[]): number {
  return output[0];
}
export function runOnJS<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
export function withSequence<T>(...values: T[]): T {
  return values[values.length - 1];
}

// Entering/exiting layout animations (FadeInDown.duration(200) etc.) — a
// self-returning proxy absorbs any chained configuration.
function layoutAnimation(): unknown {
  const self: Record<string, unknown> = new Proxy(
    {},
    { get: () => () => self },
  );
  return self;
}
export const FadeIn = layoutAnimation();
export const FadeOut = layoutAnimation();
export const FadeInDown = layoutAnimation();
export const FadeInUp = layoutAnimation();
export const FadeOutDown = layoutAnimation();
export const FadeOutUp = layoutAnimation();
