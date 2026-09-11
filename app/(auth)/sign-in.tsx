import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Keep the historical /sign-in entry point without maintaining a second,
 * reduced authentication screen. The canonical login state includes password
 * recovery and the email-code fallback, and it owns return-path validation.
 */
export default function SignInCompatibilityRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const destination = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  return (
    <Redirect
      href={{
        pathname: '/',
        params: {
          auth: 'login',
          ...(destination ? { returnTo: destination } : {}),
        },
      }}
    />
  );
}
