import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

// This is deliberately an Expo public variable: EAS Update can flip it off
// without shipping a replacement native binary. A missing DSN also disables
// the reporter, so local/dev builds never send to an accidental project.
const ENABLED = !!DSN && process.env.EXPO_PUBLIC_SENTRY_ENABLED !== 'false';

let initialized = false;

export function initNativeMonitoring(): void {
  if (initialized) return;
  initialized = true;

  Sentry.init({
    dsn: DSN,
    enabled: ENABLED,
    enableNative: true,
    environment: process.env.EXPO_PUBLIC_DEPLOY_ENV || (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

function withContext(context: Record<string, unknown> | undefined, capture: () => void): void {
  Sentry.withScope(scope => {
    if (context) scope.setContext('minds', context);
    capture();
  });
}

export function captureNativeException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  initNativeMonitoring();
  if (!ENABLED) return;
  withContext(context, () => Sentry.captureException(error));
}

export function captureNativeMessage(
  message: string,
  context?: Record<string, unknown>,
): void {
  initNativeMonitoring();
  if (!ENABLED) return;
  withContext(context, () => Sentry.captureMessage(message, 'warning'));
}

export function setNativeUser(user: { id: string; username?: string } | null): void {
  initNativeMonitoring();
  if (!ENABLED) return;
  Sentry.setUser(user ? { id: user.id, username: user.username } : null);
}
