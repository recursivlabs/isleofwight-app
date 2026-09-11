import * as React from 'react';
import { Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text, Input, Button, Container } from '../../components';
import { BASE_ORIGIN } from '../../lib/recursiv';
import { sendSignInOtp } from '../../lib/sendSignInOtp';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// ── /auth — the OAuth authorization bridge ───────────────────────────────────
//
// When an MCP client (Claude, Cursor, …) connects to the hosted MCP server at
// api.minds.com/mcp, Better Auth's `mcp` plugin redirects the unauthenticated
// authorize request to `<app>/auth` with the original OAuth params in the query
// string. Until this screen existed, that URL fell through to the [username]
// route, which looked up a user literally named "auth" and rendered
// "User not found" — the flow died at the last hop, after discovery,
// registration and PKCE had all succeeded (recursivlabs/recursiv#2420).
//
// Two things distinguish this from the ordinary /sign-in screen, and both are
// load-bearing:
//
//   1. Its session-producing verification calls Better Auth DIRECTLY with
//      `credentials: 'include'`. The app's normal sign-in goes through the SDK,
//      which does not store the Better Auth session cookie — and the authorize
//      endpoint needs that cookie. The OTP SEND does not create a session, so it
//      uses the same bounded-retry SDK path as ordinary Minds sign-in. The two
//      minds.com hosts are same-site and the API allows credentialed requests
//      from this origin, so the later verification cookie sets and flows.
//
//   2. After sign-in it does NOT enter the app. The user came here only to
//      authorize a client, so control returns to the authorize endpoint with
//      the untouched original query — Better Auth then issues the code and
//      redirects back to the client's callback.
//
// OTP is the PRIMARY flow: most accounts (including the founder's) are
// passwordless, and the first cut of this screen was password-only — which
// authorised nobody who actually needed it. Password remains as the alternate.
// The pattern is ported from packages/client's AuthScreen in the engine repo,
// which is why the Recursiv connector already worked while Minds did not.

function readOAuthQuery(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('response_type') === 'code' && q.get('client_id') && q.get('redirect_uri')) {
    return q.toString();
  }
  return null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return body.message;
  } catch {
    // Non-JSON error body — keep the fallback.
  }
  return fallback;
}

type Step = 'email' | 'code' | 'password';

export default function AuthBridgeScreen() {
  const colors = useColors();
  const [oauthQuery] = React.useState<string | null>(readOAuthQuery);
  const [step, setStep] = React.useState<Step>('email');
  const [identifier, setIdentifier] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // No OAuth params (someone typed /auth, or native): this screen has no job.
  // Send them to the normal sign-in rather than showing a dead form.
  if (!oauthQuery) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Same identifier convention as /sign-in: bare usernames get @minds.com.
  const email = () =>
    identifier.includes('@')
      ? identifier.trim().toLowerCase()
      : `${identifier.trim().toLowerCase()}@minds.com`;

  // Session cookie is set. Hand control back to the authorize endpoint with the
  // ORIGINAL query, untouched — it carries state, PKCE and resource, and any
  // modification breaks the client's verification.
  const resumeAuthorize = () => {
    window.location.replace(`${BASE_ORIGIN}/api/auth/mcp/authorize?${oauthQuery}`);
  };

  const sendCode = async () => {
    if (!identifier.trim()) {
      setError('Enter your email or username');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendSignInOtp(email());
      setStep('code');
    } catch (err: any) {
      setError(err?.message || 'Could not send the code. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!otp.trim()) {
      setError('Enter the code from your email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE_ORIGIN}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email(), otp: otp.trim() }),
      });
      if (!res.ok) {
        setError(await readError(res, 'That code did not work. Request a new one.'));
        return;
      }
      resumeAuthorize();
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithPassword = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE_ORIGIN}/api/auth/sign-in/email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email(), password }),
      });
      if (!res.ok) {
        setError(await readError(res, 'Sign in failed. Check your credentials.'));
        return;
      }
      resumeAuthorize();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container centered maxWidth={400}>
      <View style={{ width: '100%' }}>
        <Text
          variant="h2"
          color={colors.accent}
          style={{ marginBottom: spacing.lg, letterSpacing: 4, fontWeight: '300' }}
        >
          minds
        </Text>

        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing['2xl'] }}>
          An application is asking to connect to your Isle of Wight account. Sign in to continue.
        </Text>

        {step !== 'code' && (
          <Input
            label="Email or username"
            placeholder="you@example.com or username"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="email"
            error={step === 'email' ? error : undefined}
          />
        )}

        {step === 'email' && (
          <>
            <View style={{ height: spacing.sm }} />
            <Button onPress={sendCode} loading={loading} size="lg" fullWidth>
              Email me a sign-in code
            </Button>
            <View style={{ height: spacing.xl }} />
            <Button onPress={() => { setError(''); setStep('password'); }} variant="ghost" size="sm">
              Use a password instead
            </Button>
          </>
        )}

        {step === 'code' && (
          <>
            <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              We sent a code to {email()}.
            </Text>
            <Input
              label="Sign-in code"
              placeholder="6-digit code"
              value={otp}
              onChangeText={setOtp}
              autoCapitalize="none"
              autoComplete="one-time-code"
              error={error}
            />
            <View style={{ height: spacing.sm }} />
            <Button onPress={verifyCode} loading={loading} size="lg" fullWidth>
              Sign in and continue
            </Button>
            <View style={{ height: spacing.xl }} />
            <Button onPress={() => { setError(''); setOtp(''); setStep('email'); }} variant="ghost" size="sm">
              Different email
            </Button>
          </>
        )}

        {step === 'password' && (
          <>
            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              error={error}
            />
            <View style={{ height: spacing.sm }} />
            <Button onPress={signInWithPassword} loading={loading} size="lg" fullWidth>
              Sign in and continue
            </Button>
            <View style={{ height: spacing.xl }} />
            <Button onPress={() => { setError(''); setPassword(''); setStep('email'); }} variant="ghost" size="sm">
              Email me a code instead
            </Button>
          </>
        )}
      </View>
    </Container>
  );
}
