// expo-router stub for component tests.
//
// The real expo-router needs the Expo runtime + a mounted navigation tree.
// Component tests render one screen or component at a time, so navigation is
// replaced with vi.fn()s that tests can assert against. `clearMocks: true` in
// the vitest config resets call history before every test.
import * as React from 'react';
import { vi } from 'vitest';

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  setParams: vi.fn(),
};

export function useRouter() {
  return router;
}

// Params returned by useLocalSearchParams. Tests set them via
// __setLocalSearchParams; the setup file resets them after each test.
let searchParams: Record<string, string> = {};
let pathname = '/';
let segments: string[] = [];
export function __setLocalSearchParams(params: Record<string, string>) {
  searchParams = params;
}
export function __setPathname(value: string, nextSegments: string[] = []) {
  pathname = value;
  segments = nextSegments;
}
export function __resetLocalSearchParams() {
  searchParams = {};
  pathname = '/';
  segments = [];
}
export function useLocalSearchParams<T = Record<string, string>>(): T {
  return searchParams as T;
}
export function useGlobalSearchParams<T = Record<string, string>>(): T {
  return searchParams as T;
}

export function useFocusEffect(effect: React.EffectCallback) {
  // Screens are always "focused" in a component test. Real useFocusEffect
  // re-runs while focused whenever the memoized callback changes (every
  // caller wraps in React.useCallback); running only once on mount hid
  // focus-effect behaviour that depends on loaded state — a screen that
  // reacts to its own data (e.g. clearing unread rows) never did so in tests.
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect IS the dependency
  React.useEffect(effect, [effect]);
}

export function useNavigation() {
  return { addListener: (_event: string, _cb: () => void) => () => {} };
}

export function usePathname() {
  return pathname;
}

export function useSegments() {
  return segments;
}

export function Link({ children, href, asChild }: {
  children: React.ReactNode;
  href: string | Record<string, unknown>;
  asChild?: boolean;
}) {
  const inspectableHref = typeof href === 'string' ? href : JSON.stringify(href);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, { href: inspectableHref });
  }
  return React.createElement('a', { href: inspectableHref }, children);
}

export function Redirect({ href }: { href: string | Record<string, unknown> }) {
  // Keep redirects inspectable in component tests without mounting a router.
  const inspectableHref = typeof href === 'string' ? href : JSON.stringify(href);
  return React.createElement('div', { 'data-testid': 'router-redirect', 'data-href': inspectableHref });
}

export function Slot() {
  return React.createElement('div', { 'data-testid': 'router-slot' });
}
