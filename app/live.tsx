import * as React from 'react';
import { AppState, Platform, Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { Text } from '../components/Text';
import { VideoPlayer } from '../components/VideoPlayer';
import { radius, spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import {
  LIVE_STREAM_URL,
  fetchLiveStreamAvailable,
} from '../lib/live';

type LiveState = 'checking' | 'live' | 'offline';

const STATUS_POLL_MS = 15_000;
const PLAYBACK_START_TIMEOUT_MS = 12_000;

function useLiveState(): LiveState {
  const [state, setState] = React.useState<LiveState>('checking');

  React.useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const refresh = async () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
      if (Platform.OS !== 'web' && AppState.currentState !== 'active') return;

      controller?.abort();
      controller = new AbortController();
      try {
        const live = await fetchLiveStreamAvailable(controller.signal);
        if (active) setState(live ? 'live' : 'offline');
      } catch (error) {
        if (active && !(error instanceof Error && error.name === 'AbortError')) {
          setState((current) => current === 'checking' ? 'offline' : current);
        }
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), STATUS_POLL_MS);
    let removeWake: (() => void) | undefined;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibility = () => { if (!document.hidden) void refresh(); };
      document.addEventListener('visibilitychange', onVisibility);
      removeWake = () => document.removeEventListener('visibilitychange', onVisibility);
    } else {
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') void refresh();
      });
      removeWake = () => subscription.remove();
    }

    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
      removeWake?.();
    };
  }, []);

  return state;
}

export default function LiveScreen() {
  const colors = useColors();
  const liveState = useLiveState();
  const isLive = liveState === 'live';
  const [playerAttempt, setPlayerAttempt] = React.useState(0);
  const [playbackState, setPlaybackState] = React.useState<'loading' | 'ready' | 'failed'>('loading');

  // Retrying intentionally restarts the bounded startup timer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: playerAttempt is the retry generation.
  React.useEffect(() => {
    if (!isLive) {
      setPlaybackState('loading');
      return;
    }

    const timeout = setTimeout(() => {
      setPlaybackState((current) => current === 'ready' ? current : 'failed');
    }, PLAYBACK_START_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isLive, playerAttempt]);

  const playbackReady = React.useCallback(() => setPlaybackState('ready'), []);
  const playbackFailed = React.useCallback(() => setPlaybackState('failed'), []);
  const retryPlayback = React.useCallback(() => {
    setPlaybackState('loading');
    setPlayerAttempt((attempt) => attempt + 1);
  }, []);
  const playbackIsReady = isLive && playbackState === 'ready';
  const statusLabel = liveState === 'checking'
    ? 'CHECKING'
    : !isLive
      ? 'OFF AIR'
      : playbackState === 'failed'
        ? 'STREAM UNAVAILABLE'
        : playbackState === 'ready'
          ? 'LIVE NOW'
          : 'CONNECTING';

  return (
    <Container safeTop padded={false} noAvoidKeyboard>
      <ScreenHeader title="Live" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 900,
          alignSelf: 'center',
          padding: spacing.xl,
          paddingBottom: spacing['5xl'],
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.sm,
                paddingVertical: 5,
                borderRadius: radius.full,
                backgroundColor: playbackIsReady ? colors.errorMuted : colors.glass,
                borderWidth: 0.5,
                borderColor: playbackIsReady ? colors.error : colors.glassBorder,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: playbackIsReady ? colors.error : colors.textMuted,
                }}
              />
              <Text variant="label" color={playbackIsReady ? colors.error : colors.textMuted}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text variant="h1">Two enter. One stays.</Text>
          <Text variant="body" color={colors.textSecondary}>
            Watch live two-minute webcam battles without leaving Minds.
          </Text>
        </View>

        <View
          style={{
            overflow: 'hidden',
            borderRadius: radius.lg,
            backgroundColor: '#000',
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            minHeight: 220,
            justifyContent: 'center',
          }}
        >
          {isLive && playbackState !== 'failed' ? (
            <VideoPlayer
              key={playerAttempt}
              uri={LIVE_STREAM_URL}
              autoplay
              accessibilityLabel="Minds Live stream"
              height={506}
              onPlaybackReady={playbackReady}
              onPlaybackError={playbackFailed}
            />
          ) : isLive ? (
            <View style={{ minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
              <Ionicons name="warning-outline" size={42} color={colors.textMuted} />
              <Text variant="h3" align="center">The live stream couldn’t start</Text>
              <Text variant="body" color={colors.textMuted} align="center">
                The source is live, but playback is not reaching this device yet.
              </Text>
              <Pressable
                onPress={retryPlayback}
                accessibilityRole="button"
                accessibilityLabel="Retry live stream"
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  opacity: pressed ? 0.7 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Text variant="bodyMedium">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
              <Ionicons name="radio-outline" size={42} color={colors.textMuted} />
              <Text variant="h3" align="center">The stage is quiet right now</Text>
              <Text variant="body" color={colors.textMuted} align="center">
                We’ll reconnect automatically when the stream returns.
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
            Minds Live is intended for adults and may include mature content. The stream reconnects automatically.
          </Text>
        </View>
      </ScrollView>
    </Container>
  );
}
