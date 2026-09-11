import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { Text } from './Text';
import { captureException } from '../lib/monitoring';
import { colors, spacing } from '../constants/theme';

/**
 * Per-screen error boundary, exported from route files as `ErrorBoundary`
 * (expo-router's convention — it renders this instead of the crashed route).
 *
 * WHY THIS EXISTS SEPARATELY FROM components/ErrorBoundary (#187):
 * that one wraps the WHOLE app at app/_layout.tsx, so a single broken screen
 * replaces everything — tab bar, navigation, the lot — with one "Something went
 * wrong". The user's only move is to force-quit, and every other working screen
 * is taken down with the broken one.
 *
 * Mounted per route, the crash is contained: the tab bar survives, the user can
 * navigate away, and only the failed screen shows a fallback. That is the first
 * half of #187's A-grade verification — "tab bar and navigation survive".
 *
 * It still reports. `captureException` is console-only on native today
 * (monitoring returns null when Platform.OS !== 'web'), which is #187's OTHER
 * half and is NOT fixed here — it is blocked on the §10 reporter decision. When
 * that lands, these reports start arriving with no change to this file.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  React.useEffect(() => {
    captureException(error, { boundary: 'screen' });
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        padding: spacing['3xl'],
        gap: spacing.lg,
      }}
    >
      <Text variant="h3" color={colors.text} align="center">
        This screen ran into a problem
      </Text>
      <Text
        variant="body"
        color={colors.textSecondary}
        align="center"
        style={{ maxWidth: 320, lineHeight: 22 }}
      >
        The rest of the app is still working — you can switch tabs or try again.
      </Text>
      <Pressable
        onPress={() => { void retry(); }}
        style={{
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: colors.accent,
          borderRadius: 999,
        }}
      >
        <Text variant="bodyMedium" color={colors.textInverse}>Try again</Text>
      </Pressable>
    </View>
  );
}
