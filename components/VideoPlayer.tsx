// Native video player (expo-video). Web override lives in VideoPlayer.web.tsx;
// Metro resolves the right one per platform. Plays Bunny HLS, autoplays muted
// in-feed, tap to unmute.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useEvent } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SITE_URL } from '../lib/recursiv';
import { NativeVideoOverlay, type NativeVideoOverlayState } from './NativeVideoOverlay';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  accessibilityLabel?: string;
  height?: number;
  onPlaybackReady?: () => void;
  onPlaybackError?: () => void;
}

export function VideoPlayer(props: VideoPlayerProps) {
  const [muted, setMuted] = useState(props.autoplay ?? true);
  const [attempt, setAttempt] = useState(0);

  // Remount the owner of useVideoPlayer, not just its view: Expo releases the
  // failed native player and creates a fresh same-source playback attempt.
  return <NativeVideoAttempt
    key={`${props.uri}:${attempt}`}
    {...props}
    muted={muted}
    onMutedChange={setMuted}
    onRetry={() => setAttempt((value) => value + 1)}
  />;
}

function NativeVideoAttempt({
  uri,
  poster,
  autoplay = true,
  accessibilityLabel,
  height = 260,
  onPlaybackReady,
  onPlaybackError,
  muted,
  onMutedChange,
  onRetry,
}: VideoPlayerProps & {
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onRetry: () => void;
}) {

  // Bunny gates direct file access on Referer; native has no browser referer,
  // so attach it explicitly or HLS 403s on device.
  const player = useVideoPlayer({ uri, headers: { Referer: SITE_URL } }, (p) => {
    p.loop = true;
    p.muted = muted;
    if (autoplay) p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const overlayState: NativeVideoOverlayState = status === 'error'
    ? 'failed'
    : status === 'readyToPlay'
      ? null
      : 'loading';
  const reportedState = useRef<'ready' | 'error' | null>(null);

  useEffect(() => {
    if (status === 'readyToPlay' && reportedState.current !== 'ready') {
      reportedState.current = 'ready';
      onPlaybackReady?.();
    } else if (status === 'error' && reportedState.current !== 'error') {
      reportedState.current = 'error';
      onPlaybackError?.();
    } else if (status !== 'readyToPlay' && status !== 'error') {
      reportedState.current = null;
    }
  }, [onPlaybackError, onPlaybackReady, status]);

  const toggleMute = () => {
    const next = !muted;
    player.muted = next;
    onMutedChange(next);
    if (!player.playing) player.play();
  };

  return (
    <Pressable
      onPress={status === 'error' ? onRetry : toggleMute}
      accessibilityRole="button"
      accessibilityLabel={status === 'error'
        ? accessibilityLabel ? `${accessibilityLabel}, retry video` : 'Retry video'
        : accessibilityLabel
          ? `${accessibilityLabel}, ${muted ? 'unmute' : 'mute'} video`
          : muted ? 'Unmute video' : 'Mute video'}
      style={[styles.wrap, { height }]}
    >
      <VideoView
        player={player}
        style={[styles.video, overlayState ? styles.videoLoading : undefined]}
        contentFit="contain"
        nativeControls={false}
      />
      <NativeVideoOverlay poster={poster} state={overlayState} retryAvailable />
      {status === 'readyToPlay' ? (
        <View style={styles.badge}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Transparent surround + left-aligned video so any contain() letterbox shows
  // the card background (no visible black bars) and the frame hugs the leading edge.
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: 'transparent', alignItems: 'flex-start', justifyContent: 'flex-start' },
  video: { width: '100%', height: '100%' },
  videoLoading: { opacity: 0 },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
});
