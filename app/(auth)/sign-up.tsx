import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Text, Input, Button } from '../../components';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const colors = useColors();
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignUp = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(username.trim(), email.trim().toLowerCase(), password);
      router.replace('/auth/pick-username' as any);
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ width: '100%' }}>
      <Text
        variant="h2"
        color={colors.accent}
        style={{ marginBottom: spacing['3xl'], letterSpacing: 4, fontWeight: '300' }}
      >
        minds
      </Text>

      <Input
        label="Display name"
        placeholder="How people should know you"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Input
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input
        label="Password"
        placeholder="8+ characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={error}
      />

      <View style={{ height: spacing.sm }} />

      <Button
        onPress={handleSignUp}
        loading={loading}
        size="lg"
        fullWidth
      >
        Sign up
      </Button>

      <View style={{ height: spacing.xl }} />

      <Button
        onPress={() => router.push('/(auth)/sign-in')}
        variant="ghost"
        size="sm"
      >
        Already have an account? Sign in
      </Button>
    </View>
  );
}
