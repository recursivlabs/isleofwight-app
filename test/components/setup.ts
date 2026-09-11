// Shared setup for the component-test project (see vitest.config.ts).
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Import the stub by path (same module instance as the 'expo-router' alias)
// so tsc doesn't look for the helper on the real package's types.
import { __resetLocalSearchParams } from '../component-stubs/expo-router';

// react-native-web's Appearance/useColorScheme read window.matchMedia, which
// jsdom does not implement. A minimal always-dark stub keeps the theme layer
// deterministic.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
  __resetLocalSearchParams();
  // Component tests share jsdom's localStorage (lib/storage writes there on
  // web). Never let one test's session leak into the next.
  window.localStorage.clear();
});
