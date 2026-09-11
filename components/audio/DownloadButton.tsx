/**
 * Download-for-offline control. Native only (downloadsSupported gates it) — on
 * web it renders nothing, since in-app offline storage is a device capability.
 * Tap to download, tap again (when done) to remove. Reflects live status from
 * the downloads store via useSyncExternalStore.
 */
import * as React from 'react';
import { Pressable, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../../lib/theme';
import {
  downloadsSupported,
  downloadStatus,
  downloadTrack,
  removeDownload,
  subscribeDownloads,
  downloadsVersion,
} from '../../lib/audio/downloads';
import type { AudioTrack } from '../../lib/audio/types';

function useDownloadStatus(id: string) {
  React.useSyncExternalStore(subscribeDownloads, downloadsVersion, downloadsVersion);
  return downloadStatus(id);
}

export function DownloadButton({ track, size = 22 }: { track: AudioTrack; size?: number }) {
  const colors = useColors();
  const status = useDownloadStatus(track.id);

  if (!downloadsSupported) return null;

  const onPress = () => {
    if (status === 'downloaded') removeDownload(track.id);
    else if (status === 'none') downloadTrack(track);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      disabled={status === 'downloading'}
      accessibilityState={{ disabled: status === 'downloading', busy: status === 'downloading' }}
      hitSlop={8}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
      accessibilityLabel={
        status === 'downloaded' ? 'Downloaded — tap to remove' : status === 'downloading' ? 'Downloading' : 'Download for offline'
      }
    >
      {status === 'downloading' ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Ionicons
          name={status === 'downloaded' ? 'checkmark-circle' : 'download-outline'}
          size={size}
          color={status === 'downloaded' ? colors.success : colors.textMuted}
        />
      )}
    </Pressable>
  );
}
