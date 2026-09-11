import * as React from 'react';
import { View, Platform } from 'react-native';
import { Text } from './Text';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

/**
 * Shows a banner when the device appears to be offline.
 * Web: checks navigator.onLine. Native: would use NetInfo.
 */
export function NetworkBanner() {
  const colors = useColors();
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.warningMuted,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        alignItems: 'center',
      }}
    >
      <Text variant="caption" color={colors.warning}>
        You're offline. Some features may not work.
      </Text>
    </View>
  );
}
