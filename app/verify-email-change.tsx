import * as React from 'react';
import { Platform, View } from 'react-native';
import { useURL } from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Text } from '../components';
import { Container } from '../components/Container';
import { radius, spacing } from '../constants/theme';
import { useAuth } from '../lib/auth';
import { parseEmailChangeUrl } from '../lib/emailChangeUrl';
import { useColors } from '../lib/theme';

type VerificationState = 'verifying' | 'success' | 'error' | 'invalid';

export default function VerifyEmailChangeScreen() {
  const router = useRouter();
  const colors = useColors();
  const linkingUrl = useURL();
  const params = useLocalSearchParams<{ token?: string }>();
  const { sdk, user, refreshUser } = useAuth();

  const parsedUrl = React.useMemo(() => {
    const rawUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.href
      : linkingUrl;
    return rawUrl ? parseEmailChangeUrl(rawUrl) : null;
  }, [linkingUrl]);
  const token = parsedUrl?.token || (typeof params.token === 'string' ? params.token : '');
  const [state, setState] = React.useState<VerificationState>(token ? 'verifying' : 'invalid');
  const [message, setMessage] = React.useState('Confirming your new email address…');
  const attemptedRef = React.useRef<string | null>(null);

  React.useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !parsedUrl) return;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== parsedUrl.cleanPath) {
      window.history.replaceState(window.history.state, '', parsedUrl.cleanPath);
    }
  }, [parsedUrl]);

  React.useEffect(() => {
    if (!sdk || !user || !token || attemptedRef.current === token) return;
    attemptedRef.current = token;
    setState('verifying');
    setMessage('Confirming your new email address…');
    void (async () => {
      try {
        const response = await sdk.settings.verifyEmailChange(token);
        const data = (response as any)?.data ?? response;
        await refreshUser();
        setState('success');
        setMessage(`Your email is now ${data?.new_email || 'updated'}.`);
      } catch (error: any) {
        setState('error');
        setMessage(error?.message || 'This confirmation link is invalid or has expired. Request a new change from Settings.');
      }
    })();
  }, [refreshUser, sdk, token, user]);

  const success = state === 'success';
  const failed = state === 'error' || state === 'invalid';
  const icon = success ? 'checkmark-circle' : failed ? 'alert-circle' : 'mail-open-outline';
  const title = success ? 'Email updated' : failed ? 'Could not update email' : 'Confirming your email';
  const body = state === 'invalid'
    ? 'This confirmation link is missing its token. Request a new email change from Settings.'
    : message;

  return (
    <Container safeTop>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <View
          style={{
            width: '100%',
            maxWidth: 440,
            gap: spacing.lg,
            padding: spacing.xl,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <Ionicons name={icon} size={42} color={success ? colors.success : failed ? colors.error : colors.accent} />
          <View style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Text variant="h2" align="center">{title}</Text>
            <Text variant="body" color={colors.textSecondary} align="center">{body}</Text>
          </View>
          {state !== 'verifying' ? (
            <Button onPress={() => router.replace('/settings' as any)}>
              {success ? 'Back to settings' : 'Request a new link'}
            </Button>
          ) : null}
        </View>
      </View>
    </Container>
  );
}
