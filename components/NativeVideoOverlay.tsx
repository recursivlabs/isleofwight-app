import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { SITE_URL } from '../lib/recursiv';

export type NativeVideoOverlayState = 'loading' | 'failed' | null;

interface Props {
  poster?: string;
  state: NativeVideoOverlayState;
  retryAvailable?: boolean;
}

export function NativeVideoOverlay({ poster, state, retryAvailable }: Props) {
  if (!state) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {poster ? (
        <Image
          source={{ uri: poster, headers: { Referer: SITE_URL } }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          accessibilityLabel="Video preview"
        />
      ) : null}
      {state === 'failed' ? (
        <View style={styles.message} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={30} color="#fff" />
          <Text variant="caption" style={styles.messageText}>Couldn't load this video</Text>
          {retryAvailable ? <Text variant="caption" style={styles.messageText}>Tap to retry</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  messageText: { color: '#fff' },
});
