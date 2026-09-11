import { Platform } from 'react-native';
import { captureException } from './monitoring';
import { getPushDeviceKey } from './pushDeviceKey';

// Lazy imports — expo-notifications/device/constants crash on web
const getNotifications = () => {
  if (Platform.OS === 'web') return null;
  try { return require('expo-notifications'); } catch { return null; }
};
const getDevice = () => {
  if (Platform.OS === 'web') return null;
  try { return require('expo-device'); } catch { return null; }
};
const getConstants = () => {
  try { return require('expo-constants').default; } catch { return null; }
};

// Configure notification handler (native only)
if (Platform.OS !== 'web') {
  try {
    const Notifications = getNotifications();
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          // SDK 54 split shouldShowAlert into banner/list; the old key is
          // ignored and foreground notifications silently don't display.
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch {}
}

/**
 * Register for push notifications and return the Expo push token.
 * Returns null on web or if registration fails.
 */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Device = getDevice();
  const Notifications = getNotifications();
  const Constants = getConstants();

  if (!Device?.isDevice || !Notifications) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return token.data;
  } catch (err) {
    // A swallowed failure here means the entire push channel is silently
    // dead for the user — it must be visible in monitoring.
    captureException(err, { action: 'registerPushToken' });
    return null;
  }
}

/**
 * Register push token with the Recursiv server.
 */
export async function registerTokenWithServer(sdk: any, token: string): Promise<void> {
  try {
    const deviceKey = await getPushDeviceKey();
    await sdk.notifications.registerToken({
      token,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      device_key: deviceKey,
    });
  } catch (err) {
    captureException(err, { action: 'registerTokenWithServer' });
  }
}

/**
 * Un-register this device's push token on sign-out.
 *
 * WHY THIS EXISTS (§10.7): the server binds a push token to exactly ONE user —
 * `registerToken` upserts with the token as conflict target and `userId` in the
 * SET, so a second account registering the same device moves the binding. That
 * is the right behaviour and it closes the accumulation risk.
 *
 * What it does NOT close is the gap in between. Rebinding happens when the NEXT
 * user registers, not when the previous one leaves — and sign-out used to clear
 * storage, cache and auth state while leaving the server-side binding intact.
 * So if the next person declines the push prompt, or never foregrounds the app,
 * the PREVIOUS user's notifications keep arriving on a device they no longer
 * hold, indefinitely. Shared phone, borrowed phone, resold phone.
 *
 * Failure is swallowed on purpose: a user signing out must always get signed
 * out. A network error here degrades to exactly the old behaviour — the binding
 * survives until the next registration — which is strictly no worse than not
 * calling this at all, and is why it is safe to call on a path that must not
 * throw.
 */
export async function unregisterTokenWithServer(sdk: any, token: string): Promise<void> {
  try {
    await sdk.notifications.unregisterToken(token);
  } catch (err) {
    captureException(err, { action: 'unregisterTokenWithServer' });
  }
}

/**
 * Set up notification listeners. Returns cleanup function.
 * No-op on web.
 */
export function setupNotificationListeners(
  onNotification?: (notification: any) => void,
  onResponse?: (response: any) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};

  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  const notifSub = Notifications.addNotificationReceivedListener((notification: any) => {
    onNotification?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    onResponse?.(response);
  });

  return () => {
    notifSub.remove();
    responseSub.remove();
  };
}
