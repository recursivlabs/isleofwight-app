/**
 * Native audio engine — react-native-track-player. Delivers the things the web
 * surface can't: background playback, lockscreen / control-center transport, and
 * (via downloads) offline playback. Same AudioEngine contract as engine.web.ts,
 * so the provider + UI are platform-agnostic.
 *
 * Queue lives in the PROVIDER (parity with web): we load ONE track at a time and
 * the provider advances it. Lockscreen prev/next still work — the playback
 * service (playbackService.ts) routes those remote events back to the remote
 * handlers the provider registered here. Setup + service registration happen at
 * app entry (registerPlayback.native.ts).
 *
 * Downloaded tracks play from a local file (offline): load() rewrites the url to
 * the cached path when present.
 *
 * track-player is UNSUPPORTED on the New Architecture and runs here on a
 * hand-maintained patch that has already broken twice (#186). This module sits
 * in app/_layout.tsx's import graph, where the ErrorBoundary cannot catch a
 * module-scope throw — so the library is loaded through a guarded require. If
 * it throws, the app gets a no-op engine and boots without audio instead of
 * black-screening.
 */
import { getLocalUri } from './downloads';
import { loadTrackPlayerModule, type TrackPlayerModule } from './loadTrackPlayer';
import type { AudioEngine, AudioEngineHandlers, AudioRemoteHandlers, AudioTrack } from './types';

function loadTrackPlayer(): TrackPlayerModule | null {
  try {
    return loadTrackPlayerModule();
  } catch (error) {
    console.error('[audio] track-player failed to load — audio disabled for this session', error);
    return null;
  }
}

const tp = loadTrackPlayer();

/** False when track-player failed to load; the UI hides audio controls. */
export const audioEngineAvailable = tp != null;

interface NativeEngine extends AudioEngine {
  /** Public so playbackService.ts can route lockscreen events to the queue. */
  remote: AudioRemoteHandlers;
}

function createNativeEngine(mod: TrackPlayerModule): NativeEngine {
  const TrackPlayer = mod.default;
  const { Event, State } = mod;

  let handlers: AudioEngineHandlers = {};
  let subscribed = false;

  const remote: AudioRemoteHandlers = {};

  /** Subscribe once to playback events → provider handlers. */
  function subscribe(): void {
    if (subscribed) return;
    subscribed = true;
    TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
      handlers.onState?.(e.state === State.Playing);
      const loading = e.state === State.Buffering || e.state === State.Loading;
      handlers.onLoading?.(loading);
    });
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (e) => {
      handlers.onProgress?.(e.position, e.duration);
    });
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      handlers.onEnded?.();
    });
  }

  return {
    remote,

    async load(track: AudioTrack): Promise<void> {
      subscribe();
      // Offline-first: play the cached file when this track is downloaded.
      const local = await getLocalUri(track.id);
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: local ?? track.url,
        title: track.title || 'Audio',
        artist: track.artist || 'Minds',
        artwork: track.artwork,
        duration: track.duration,
      });
    },

    async play(): Promise<void> {
      subscribe();
      await TrackPlayer.play();
    },

    async pause(): Promise<void> {
      await TrackPlayer.pause();
    },

    async seekTo(seconds: number): Promise<void> {
      await TrackPlayer.seekTo(Math.max(0, seconds));
    },

    async setRate(rate: number): Promise<void> {
      await TrackPlayer.setRate(rate);
    },

    async stop(): Promise<void> {
      await TrackPlayer.reset();
    },

    setHandlers(next: AudioEngineHandlers): void {
      handlers = next;
      subscribe();
    },

    setRemoteHandlers(next: AudioRemoteHandlers): void {
      // Replace, not merge — the reference stays stable for playbackService.
      for (const key of Object.keys(remote) as (keyof AudioRemoteHandlers)[]) {
        delete remote[key];
      }
      Object.assign(remote, next);
    },

    setNowPlaying(): void {
      // track-player renders the lockscreen / control-center from the loaded
      // track's title/artist/artwork — nothing to push here.
    },
  };
}

/** Boot-safe stand-in: every control is inert, and the UI hides them anyway. */
function createDisabledEngine(): NativeEngine {
  return {
    remote: {},
    async load() {},
    async play() {},
    async pause() {},
    async seekTo() {},
    async setRate() {},
    async stop() {},
    setHandlers() {},
    setRemoteHandlers() {},
    setNowPlaying() {},
  };
}

const engine: NativeEngine = tp ? createNativeEngine(tp) : createDisabledEngine();

/** Named export so the playback service can reach the remote handlers. */
export const nativeAudioEngine = engine;
export default engine;
