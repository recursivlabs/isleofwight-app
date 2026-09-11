import { Redirect, Slot } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Container } from '../../components';
import { useAuth } from '../../lib/auth';
import { isFreshSignup } from '../../lib/signupWindow';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  // A successful sign-up updates auth state before navigation settles. Without
  // an auth-aware layout, web could keep /sign-up mounted inside the signed-in
  // shell: the account existed, but the person was still staring at the form.
  // This also makes reload/back deterministic. Fresh accounts continue to the
  // handle picker; established accounts never enter a route that can rename
  // them and go straight to the feed.
  if (isLoading) return null;
  if (user) {
    return (
      <Redirect
        href={(isFreshSignup(user.created_at) ? '/auth/pick-username' : '/(tabs)') as any}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Container centered maxWidth={400}>
        <Slot />
      </Container>
    </KeyboardAvoidingView>
  );
}
