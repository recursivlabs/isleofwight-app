import * as React from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors as legacyColors,
  darkColors,
  lightColors,
  type ColorTokens,
  type ResolvedTheme,
  type ThemeMode,
} from '../constants/theme';

const STORAGE_KEY = 'minds:theme-mode';

interface ThemeValue {
  /** User-selected mode: 'system' | 'light' | 'dark' */
  mode: ThemeMode;
  /** Currently rendered theme: 'light' | 'dark' (resolves 'system') */
  resolved: ResolvedTheme;
  /** Convenience flag */
  isDark: boolean;
  /** Active color tokens — reactive */
  colors: ColorTokens;
  /** Set the user's mode. Persists across launches. */
  setMode: (mode: ThemeMode) => void;
  /**
   * True once this device has a stored theme — either hydrated from storage or
   * set in this session. Distinguishes "the reader chose system" from "nothing
   * has ever been chosen here", which the mode alone cannot express.
   */
  hasDevicePreference: boolean;
  /** Toggle between light/dark (sets explicit, leaves 'system' if user wants) */
  toggle: () => void;
  /** Bumps when colors change so memoized consumers can opt in to recompute */
  version: number;
}

const noop = () => {};

const ThemeContext = React.createContext<ThemeValue>({
  mode: 'system',
  resolved: 'dark',
  isDark: true,
  colors: darkColors,
  hasDevicePreference: false,
  setMode: noop,
  toggle: noop,
  version: 0,
});

function resolveSystem(): ResolvedTheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

/**
 * Mutate the legacy `colors` export so files that still do
 * `import { colors } from '../constants/theme'` see updated values
 * the next time they read the object. New code should use useColors().
 *
 * The mutation is a transitional aid; a render trigger still requires
 * the consumer to be inside a component tree that re-renders. The
 * provider triggers a global re-render via context value change, so
 * subscribed components recompute. Non-subscribed components reading
 * the static import fall back to the mutated singleton.
 */
function mutateLegacyColors(source: ColorTokens) {
  for (const key of Object.keys(source) as (keyof ColorTokens)[]) {
    (legacyColors as any)[key] = source[key];
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = React.useState<ResolvedTheme>(
    resolveSystem,
  );
  const [version, setVersion] = React.useState(0);
  const [hydrated, setHydrated] = React.useState(false);
  // Has THIS DEVICE ever been given a theme? 'system' is the default, and it is
  // also a legitimate explicit choice, so the mode alone cannot tell them apart.
  // Anything syncing a theme from the server needs the difference: adopting a
  // stored account theme onto a device the reader has already set is how a dark
  // reader gets flipped to light just by opening Settings.
  const [hasDevicePreference, setHasDevicePreference] = React.useState(false);

  // Hydrate user-selected mode from storage once.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let saved: string | null = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          saved = window.localStorage.getItem(STORAGE_KEY);
        } else {
          saved = await AsyncStorage.getItem(STORAGE_KEY);
        }
        if (!cancelled && (saved === 'system' || saved === 'light' || saved === 'dark')) {
          setModeState(saved);
          setHasDevicePreference(true);
        }
      } catch {
        // ignore — fall through to default
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Listen for OS color scheme changes — relevant when mode === 'system'.
  React.useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const resolved: ResolvedTheme = mode === 'system' ? systemScheme : mode;
  const colors = resolved === 'dark' ? darkColors : lightColors;

  // Mutate the legacy singleton synchronously during render so that
  // any component that does `import { colors }` reads fresh values
  // when this provider re-renders the tree. This is a transitional
  // aid until every component migrates to useColors().
  mutateLegacyColors(colors);

  // Web: keep <body> bg + CSS custom properties in sync so global
  // styles (scrollbar, ::selection) flip with the theme.
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const body = document.body;
      const root = document.documentElement;
      body.style.backgroundColor = colors.bg;
      const isDark = resolved === 'dark';
      root.style.setProperty('--scrollbar-thumb', isDark
        ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)');
      root.style.setProperty('--scrollbar-thumb-hover', isDark
        ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)');
      root.style.setProperty('--scrollbar-thumb-solid', isDark
        ? 'rgba(255,255,255,0.28)'
        : 'rgba(0,0,0,0.28)');
      root.style.setProperty('--selection-bg', isDark
        ? 'rgba(212,168,68,0.30)' : 'rgba(160,126,36,0.22)');
      // Row hover tint for CSS-driven hover (see lib/webStyles.ts). Driving the
      // Discover row hover in CSS instead of a function-style Pressable means no
      // React re-render fires on mouseenter/leave — the fix for the laggy hover.
      root.style.setProperty('--row-hover', colors.glass);
      // Mirror to <html> so OS-level UA chrome (form controls, autofill)
      // picks the right base palette where supported.
      root.style.colorScheme = isDark ? 'dark' : 'light';
    }
    setVersion(v => v + 1);
  }, [colors, resolved]);

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
    setHasDevicePreference(true);
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, next);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, next);
        }
      } catch {
        // best-effort persist; in-memory state still updates
      }
    })();
  }, []);

  const toggle = React.useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const value = React.useMemo<ThemeValue>(
    () => ({
      mode,
      resolved,
      isDark: resolved === 'dark',
      colors,
      setMode,
      toggle,
      version,
      hasDevicePreference,
    }),
    [mode, resolved, colors, setMode, toggle, version, hasDevicePreference],
  );

  // Don't render children until hydrated to avoid one-frame light/dark flash.
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return React.useContext(ThemeContext);
}

/** Convenience: just the colors. */
export function useColors(): ColorTokens {
  return React.useContext(ThemeContext).colors;
}

/** Convenience: just the resolved 'light' | 'dark'. */
export function useResolvedTheme(): ResolvedTheme {
  return React.useContext(ThemeContext).resolved;
}

/**
 * Keyboard-facing props every raw TextInput should spread in: iOS keyboard
 * chrome matched to the app theme (a light keyboard over the dark UI reads
 * as broken) and caret/selection in the brand accent, like X. The shared
 * <Input> component applies these itself; use this for bespoke inputs
 * (composers, search fields).
 */
export function useInputKeyboardProps() {
  const { colors, resolved } = React.useContext(ThemeContext);
  return {
    keyboardAppearance: (resolved === 'dark' ? 'dark' : 'light') as 'dark' | 'light',
    selectionColor: colors.accent,
  };
}
