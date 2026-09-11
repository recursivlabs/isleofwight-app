/**
 * In-feed audio card. Shows artwork + title/artist + a play/pause control; once
 * it's the active track it expands to a live scrubber with elapsed/remaining
 * time. Playback itself is owned by the global AudioPlayerProvider, so starting
 * one card pauses any other and drives the floating mini-player + OS controls.
 */
import * as React from 'react';
import { View, Pressable, Image, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../Text';
import { Scrubber } from './Scrubber';
import { DownloadButton } from './DownloadButton';
import { formatDuration } from './format';
import { useColors } from '../../lib/theme';
import { spacing, radius } from '../../constants/theme';
import { useAudioPlayer } from '../../lib/audioPlayer';
import type { AudioTrack } from '../../lib/audio/types';

export function InlineAudioPlayer({ track }: { track: AudioTrack }) {
  const colors = useColors();
  const player = useAudioPlayer();
  // No engine (native audio module failed to load, #186): hide the controls
  // rather than render a player whose every button silently does nothing.
  if (!player.available) return null;
  const active = player.isCurrent(track.id);
  const playing = active && player.isPlaying;
  const loading = active && player.loading;

  const onToggle = () => {
    if (active) player.toggle();
    else player.play(track);
  };

  const position = active ? player.position : 0;
  const duration = active && player.duration ? player.duration : track.duration || 0;

  return (
    <View
      style={{
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.accentMuted : colors.border,
      }}
    >
      {/* Artwork (or a music-note placeholder on the accent tint). */}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {track.artwork ? (
          <Image source={{ uri: track.artwork }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name="musical-notes" size={28} color={colors.accent} />
        )}
      </View>

      {/* Meta + (when active) scrubber. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {track.title || 'Audio'}
        </Text>
        {track.artist ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {track.artist}
          </Text>
        ) : null}

        {active ? (
          <View style={{ marginTop: spacing.xs }}>
            <Scrubber position={position} duration={duration} onSeek={player.seekTo} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color={colors.textMuted}>
                {formatDuration(position)}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatDuration(duration)}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
            {duration ? formatDuration(duration) : 'Audio'}
          </Text>
        )}
      </View>

      {/* Download for offline (native only — hidden on web). */}
      <DownloadButton track={track} size={24} />

      {/* Add to queue (only once something is playing + this isn't it). */}
      {!active && player.current ? (
        <Pressable
          onPress={() => player.addToQueue(track)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${track.title || 'Audio'} to queue`}
          hitSlop={8}
          style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
        >
          <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {/* Play / pause. */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${track.title || 'Audio'}`}
        accessibilityState={{ busy: loading }}
        aria-busy={loading}
        hitSlop={8}
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
        ]}
      >
        <Ionicons
          name={loading ? 'ellipsis-horizontal' : playing ? 'pause' : 'play'}
          size={24}
          color={colors.textOnAccent}
          style={!playing && !loading ? { marginLeft: 2 } : undefined}
        />
      </Pressable>
    </View>
  );
}
