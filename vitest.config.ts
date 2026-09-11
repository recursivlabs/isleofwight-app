import { defineConfig } from 'vitest/config';
import path from 'node:path';

const stub = (name: string) => path.resolve(__dirname, 'test/component-stubs', name);

// Two projects, both run by a single `vitest run` (so `pnpm test` and CI pick
// them up with no extra wiring):
//
//  · unit — the pre-existing suites, untouched: jsdom with react-native and
//    AsyncStorage stubbed out entirely, exercising pure app logic.
//
//  · components — render tests. `react-native` resolves to react-native-web,
//    so components render to real DOM through the SAME layer the production
//    web build uses. Native-only modules (gestures, reanimated, expo-*) are
//    stubbed; `.web.tsx` platform files are preferred exactly like Metro's
//    web resolution.
export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['lib/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'test/components/**'],
          clearMocks: true,
          restoreMocks: true,
        },
        resolve: {
          alias: {
            'react-native': path.resolve(__dirname, 'test/stubs/react-native.ts'),
            '@react-native-async-storage/async-storage': path.resolve(__dirname, 'test/stubs/async-storage.ts'),
          },
        },
      },
      {
        // Metro treats a require()d .svg as an asset reference; resolve it to
        // a plain string source so <Image source={...}> renders under jsdom.
        plugins: [
          {
            name: 'svg-asset-stub',
            enforce: 'pre' as const,
            load(id: string) {
              if (id.endsWith('.svg')) return 'export default "svg-asset-stub";';
              return null;
            },
          },
        ],
        // App components use the automatic JSX runtime (no `import React`),
        // matching Expo's babel preset.
        esbuild: { jsx: 'automatic' },
        // Expo packages ship TypeScript source and rely on Metro-injected
        // globals; define them the way the web build would.
        define: { __DEV__: 'false', 'process.env.EXPO_OS': '"web"' },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['test/components/**/*.test.{ts,tsx}'],
          setupFiles: ['test/components/setup.ts'],
          clearMocks: true,
          restoreMocks: true,
          // These render whole screens through react-native-web and drive them
          // with user-event, which awaits a macrotask per keystroke. Several sit
          // just under vitest's 5s default, so on a loaded machine one or two
          // tip over and the suite reports a failure that says nothing about the
          // code. The tests are not wrong; the budget was too tight for what
          // they do.
          //
          // The real speed-up is `userEvent.setup({ delay: null })` — it took
          // landing-auth-redirect from ~16s to 676ms. Only two files do that
          // today; converting the rest is the way to bring this back down.
          testTimeout: 20000,
          hookTimeout: 20000,
        },
        resolve: {
          // Prefer .web.* platform files, matching Metro's web resolution —
          // this keeps native-only implementations (Sentry, track-player,
          // expo-video) out of the module graph the same way the web build does.
          extensions: ['.web.tsx', '.web.ts', '.web.js', '.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
          alias: {
            'react-native': 'react-native-web',
            '@expo/vector-icons/Ionicons': stub('ionicons.tsx'),
            '@expo/vector-icons/MaterialCommunityIcons': stub('ionicons.tsx'),
            'expo-router': stub('expo-router.ts'),
            'expo-haptics': stub('expo-haptics.ts'),
            'expo-image': stub('expo-image.tsx'),
            'expo-audio': stub('expo-audio.ts'),
            'react-native-reanimated': stub('reanimated.ts'),
            'react-native-gesture-handler/ReanimatedSwipeable': stub('reanimated-swipeable.tsx'),
            'react-native-gesture-handler': stub('gesture-handler.ts'),
            'react-native-safe-area-context': stub('safe-area-context.ts'),
            'react-native-keyboard-controller': stub('keyboard-controller.ts'),
            'expo-clipboard': stub('expo-clipboard.ts'),
          },
        },
      },
    ],
  },
});
