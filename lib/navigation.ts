import * as React from 'react';
import { useRouter } from 'expo-router';

/**
 * History-aware back navigation (X/Twitter-style).
 *
 * The back control used to always `router.replace('/(tabs)')` / `router.back()`
 * blindly, which on a deep-link cold-start (empty navigation stack) either
 * threw or dumped the user on the Feed even when there WAS a screen to return
 * to. This returns a handler that:
 *   - goes to the EXACT previous screen when the stack has one (router.back),
 *   - falls back to home ('/(tabs)') only when the stack is empty (deep link /
 *     fresh launch into a detail screen).
 *
 * Use this everywhere a back affordance lives (ScreenHeader, Header, etc.) so
 * back behaves like a browser/Twitter back — returns to where you were.
 */
export function useSmartBack(fallback = '/(tabs)') {
  const router = useRouter();
  return React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Empty stack (cold start / deep link) — there's nowhere to go back to,
      // so land on the feed/home instead of a dead end.
      router.replace(fallback as any);
    }
  }, [router, fallback]);
}
