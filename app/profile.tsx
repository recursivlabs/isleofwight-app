import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Container } from '../components/Container';
import { useColors } from '../lib/theme';

/**
 * /profile is a hard redirect to the unified /user/<username> page. It
 * exists only so the bottom tab bar's "Profile" item keeps working — all
 * navigation links now push straight to /user/<username>. Using expo-router's
 * declarative <Redirect> means the route never lingers on a loader or leaves
 * the user stuck on a half-mounted screen.
 */
export default function ProfileRedirectScreen() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <Container safeTop padded={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Container>
    );
  }

  if (!user) return <Redirect href="/" />;
  const slug = user.username || user.id;
  return <Redirect href={`/${slug}` as any} />;
}
