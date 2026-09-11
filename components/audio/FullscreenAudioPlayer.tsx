/**
 * Fullscreen now-playing — opens from the mini-player. Large artwork, full
 * transport (skip ±15s, prev/next), a draggable scrubber, a playback-speed
 * cycle, and the "Up Next" queue (tap to jump). Reads/writes the same global
 * AudioPlayerProvider state, so it stays in lockstep with the mini-player + OS.
 */
import * as React from 'react';
import { View, Pressable, Image, Modal, ScrollView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { Scrubber } from './Scrubber';
import { DownloadButton } from './DownloadButton';
import { formatDuration } from './format';
import { useColors } from '../../lib/theme';
import { spacing, radius } from '../../constants/theme';
import { useAudioPlayer } from '../../lib/audioPlayer';
import { PLAYBACK_RATES } from '../../lib/audio/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined;

export function FullscreenAudioPlayer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const player = useAudioPlayer();
  const track = player.current;

  if (!track) return null;

  const cycleRate = () => {
    const i = PLAYBACK_RATES.indexOf(player.rate as (typeof PLAYBACK_RATES)[number]);
    player.setRate(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]);
  };

  const goToPost = () => {
    onClose();
    router.push(`/post/${track.id}` as any);
  };

  const upNext = player.queue.slice(player.index + 1);
  const hasPrev = player.index > 0 || player.position > 3;
  const hasNext = player.index < player.queue.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Minimize audio player" hitSlop={10} style={webCursor}>
            <Ionicons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
          <Text variant="label" color={colors.textSecondary}>
            Now Playing
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <DownloadButton track={track} size={22} />
            <Pressable onPress={goToPost} accessibilityRole="button" accessibilityLabel={`Open post for ${track.title || 'Audio'}`} hitSlop={10} style={webCursor}>
              <Ionicons name="open-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
          {/* Artwork */}
          <View
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 420,
              aspectRatio: 1,
              borderRadius: radius.xl,
              overflow: 'hidden',
              backgroundColor: colors.accentMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: spacing.md,
              marginBottom: spacing['2xl'],
            }}
          >
            {track.artwork ? (
              <Image source={{ uri: track.artwork }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Ionicons name="musical-notes" size={96} color={colors.accent} />
            )}
          </View>

          {/* Title / artist */}
          <Text variant="h2" numberOfLines={2}>
            {track.title || 'Audio'}
          </Text>
          {track.artist ? (
            <Text variant="body" color={colors.textMuted} numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {track.artist}
            </Text>
          ) : null}

          {/* Scrubber + time */}
          <View style={{ marginTop: spacing.xl }}>
            <Scrubber position={player.position} duration={player.duration} onSeek={player.seekTo} height={5} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color={colors.textMuted}>
                {formatDuration(player.position)}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatDuration(player.duration)}
              </Text>
            </View>
          </View>

          {/* Transport */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, paddingHorizontal: spacing.md }}>
            <Pressable onPress={cycleRate} accessibilityRole="button" accessibilityLabel={`Playback speed, ${player.rate}x`} hitSlop={8} style={[{ width: 48, alignItems: 'center' }, webCursor]}>
              <Text variant="label" color={colors.textSecondary}>
                {player.rate}x
              </Text>
            </Pressable>
            <Pressable onPress={player.prev} accessibilityRole="button" accessibilityLabel="Previous track" accessibilityState={{ disabled: !hasPrev }} hitSlop={8} disabled={!hasPrev} style={webCursor}>
              <Ionicons name="play-skip-back" size={30} color={hasPrev ? colors.text : colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => player.skipBy(-15)} accessibilityRole="button" accessibilityLabel="Rewind 15 seconds" hitSlop={8} style={webCursor}>
              <Ionicons name="play-back" size={28} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={player.toggle}
              accessibilityRole="button"
              accessibilityLabel={`${player.isPlaying ? 'Pause' : 'Play'} ${track.title || 'Audio'}`}
              accessibilityState={{ busy: player.loading }}
              aria-busy={player.loading}
              hitSlop={8}
              style={[
                { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
                webCursor,
              ]}
            >
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={36} color={colors.textOnAccent} style={!player.isPlaying ? { marginLeft: 3 } : undefined} />
            </Pressable>
            <Pressable onPress={() => player.skipBy(15)} accessibilityRole="button" accessibilityLabel="Forward 15 seconds" hitSlop={8} style={webCursor}>
              <Ionicons name="play-forward" size={28} color={colors.text} />
            </Pressable>
            <Pressable onPress={player.next} accessibilityRole="button" accessibilityLabel="Next track" accessibilityState={{ disabled: !hasNext }} hitSlop={8} disabled={!hasNext} style={webCursor}>
              <Ionicons name="play-skip-forward" size={30} color={hasNext ? colors.text : colors.textMuted} />
            </Pressable>
            <View style={{ width: 48 }} />
          </View>

          {/* Up next */}
          {upNext.length > 0 ? (
            <View style={{ marginTop: spacing['3xl'] }}>
              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
                Up Next
              </Text>
              {upNext.map((t, i) => {
                const queueIndex = player.index + 1 + i;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => player.jumpTo(queueIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${t.title || 'Audio'} next`}
                    style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }, webCursor]}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                      {t.artwork ? (
                        <Image source={{ uri: t.artwork }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="musical-notes" size={18} color={colors.accent} />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {t.title || 'Audio'}
                      </Text>
                      {t.artist ? (
                        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                          {t.artist}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
