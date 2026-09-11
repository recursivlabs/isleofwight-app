import * as React from 'react';
import { View, TextInput, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { markUsernamePicked } from '../../lib/onboarding';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors, useInputKeyboardProps } from '../../lib/theme';

// The rule lives in lib/username.ts so this screen and Edit Profile cannot
// drift apart again (#201). Do not re-declare it here.
import { isValidUsername, sanitizeUsername } from '../../lib/username';

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function PickUsernameScreen() {
  const router = useRouter();
  const { sdk, user, refreshUser } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  // Pre-fill with server-assigned slug if it looks reasonable. Strip
  // anything that isn't URL-safe so the user can edit cleanly.
  const seed = sanitizeUsername(user?.username || '');
  const [username, setUsername] = React.useState(seed);
  const [availability, setAvailability] = React.useState<AvailabilityState>('idle');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounced availability check via getByUsername.
  React.useEffect(() => {
    setError(null);
    const v = username.trim().toLowerCase();
    if (!v) { setAvailability('idle'); return; }
    if (!isValidUsername(v)) { setAvailability('invalid'); return; }
    if (v === (user?.username || '').toLowerCase()) {
      // Server already has this exact value — count as available (the user's own).
      setAvailability('available');
      return;
    }
    setAvailability('checking');
    let active = true;
    const handle = setTimeout(async () => {
      try {
        await (sdk as any).profiles.getByUsername(v);
        if (!active) return;
        // 200 → username exists → taken
        setAvailability('taken');
      } catch (e: any) {
        if (!active) return;
        const status = e?.statusCode || e?.status || 0;
        if (status === 404) setAvailability('available');
        else setAvailability('idle'); // network blip — let submit handle it
      }
    }, 350);
    return () => {
      // Clearing the timer alone cannot stop a lookup that already started.
      active = false;
      clearTimeout(handle);
    };
  }, [username, sdk, user?.username]);

  const handleSubmit = React.useCallback(async () => {
    const v = username.trim().toLowerCase();
    if (!isValidUsername(v)) {
      setError('Username must be 3-30 chars, lowercase letters/numbers/_/-, and start/end with a letter or number.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await (sdk as any).profiles.update({ username: v });
      await markUsernamePicked();
      await refreshUser();
      // No swipe-deck onboarding — land in the feed. The agent-setup CTA
      // at the top of For You invites them to provision a personal agent
      // when they're ready.
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 0;
      if (status === 409) setError('Username is taken. Try another.');
      else setError(e?.message || 'Could not save username. Try again.');
      setSubmitting(false);
    }
  }, [username, sdk, refreshUser, router]);

  const canSubmit = !submitting && (availability === 'available' || availability === 'idle');

  const indicator = (() => {
    switch (availability) {
      case 'checking': return <ActivityIndicator size="small" color={colors.textMuted} />;
      case 'available': return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
      case 'taken': return <Ionicons name="close-circle" size={20} color={colors.error} />;
      case 'invalid': return <Ionicons name="warning-outline" size={20} color={colors.error} />;
      default: return null;
    }
  })();

  const hint = (() => {
    switch (availability) {
      case 'available': return `@${username.toLowerCase()} is available`;
      case 'taken': return 'Username is taken — try another';
      case 'invalid': return 'Use 3-30 chars: lowercase letters, numbers, _ or -';
      case 'checking': return 'Checking…';
      default: return 'Lowercase letters, numbers, _ and -';
    }
  })();

  return (
    <Container safeTop>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing['2xl'] }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Text variant="h2" color={colors.text} align="center">Pick your username</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 22 }}>
            This is how people find you on Wight.social. You can change it later.
          </Text>
        </View>

        <View style={{ width: '100%', maxWidth: 340, gap: spacing.sm }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: availability === 'taken' || availability === 'invalid' ? colors.error : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          }}>
            <Text variant="body" color={colors.textMuted} style={{ marginRight: 4 }}>@</Text>
            <TextInput
              value={username}
              onChangeText={(t) => setUsername(sanitizeUsername(t))}
              placeholder="yourname"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={30}
              autoFocus
              returnKeyType="done"
              {...kbProps}
              onSubmitEditing={handleSubmit}
              {...(Platform.OS === 'web' ? { 'data-bwignore': 'true', 'data-lpignore': 'true', 'data-form-type': 'other', name: 'pick-username' } as any : {})}
              style={{
                flex: 1,
                paddingVertical: 14,
                color: colors.text,
                ...typography.body,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>{indicator}</View>
          </View>
          <Text variant="caption" color={availability === 'taken' || availability === 'invalid' ? colors.error : colors.textMuted}>
            {hint}
          </Text>
          {error ? <Text variant="caption" color={colors.error} align="center">{error}</Text> : null}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            width: '100%',
            maxWidth: 340,
            paddingVertical: 14,
            borderRadius: radius.md,
            backgroundColor: colors.accent,
            alignItems: 'center',
            opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1,
            ...(Platform.OS === 'web' ? { cursor: !canSubmit ? 'default' : 'pointer' } as any : {}),
          })}
        >
          <Text variant="bodyMedium" color={colors.textOnAccent}>{submitting ? 'Saving…' : 'Continue'}</Text>
        </Pressable>
      </View>
    </Container>
  );
}
