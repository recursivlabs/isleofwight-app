import * as React from 'react';
import { View, TextInput, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '../components';
import { Container } from '../components/Container';
import { BASE_ORIGIN } from '../lib/recursiv';
import { spacing, radius, typography } from '../constants/theme';
import { useColors } from '../lib/theme';
import { parsePasswordResetUrl } from '../lib/passwordResetUrl';

/**
 * Landing page for the password-reset email. The auth server appends
 * New Recursiv APIs deliver the token in a fragment; already-issued Better
 * Auth links still use `?token=...`. Both are read once and removed from
 * browser history before paint.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const browserResetState = React.useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    return parsePasswordResetUrl(window.location.href);
  }, []);
  const token = browserResetState?.token || (typeof params.token === 'string' ? params.token : '');
  const linkError = browserResetState?.error || (typeof params.error === 'string' ? params.error : '');

  React.useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !browserResetState) return;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== browserResetState.cleanPath) {
      window.history.replaceState(window.history.state, '', browserResetState.cleanPath);
    }
  }, [browserResetState]);

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    if (submitting) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_ORIGIN}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'This reset link is invalid or has expired. Request a new one.');
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not reset password. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [password, confirm, token, submitting]);

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    ...typography.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  } as const;

  const invalidLink = !token || !!linkError;

  return (
    <Container safeTop>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing['2xl'] }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Text variant="h2" color={colors.text} align="center">
            {done ? 'Password updated' : 'Reset your password'}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 22 }}>
            {done
              ? 'You can now log in with your new password.'
              : invalidLink
                ? 'This reset link is invalid or has expired. Request a new one from the sign-in screen.'
                : 'Choose a new password for your account.'}
          </Text>
        </View>

        {!done && !invalidLink && (
          <View style={{ width: '100%', maxWidth: 340, gap: spacing.sm }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              style={inputStyle}
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              onSubmitEditing={handleSubmit}
              style={inputStyle}
            />
            {error ? <Text variant="caption" color={colors.error} align="center">{error}</Text> : null}
          </View>
        )}

        <Pressable
          onPress={done || invalidLink ? () => router.replace('/') : handleSubmit}
          disabled={submitting}
          style={({ pressed }) => ({
            width: '100%',
            maxWidth: 340,
            paddingVertical: 14,
            borderRadius: radius.md,
            backgroundColor: colors.accent,
            alignItems: 'center',
            opacity: submitting ? 0.4 : pressed ? 0.85 : 1,
            ...(Platform.OS === 'web' ? { cursor: submitting ? 'default' : 'pointer' } as any : {}),
          })}
        >
          <Text variant="bodyMedium" color={colors.textOnAccent}>
            {done || invalidLink ? 'Back to log in' : submitting ? 'Saving…' : 'Set new password'}
          </Text>
        </Pressable>
      </View>
    </Container>
  );
}
