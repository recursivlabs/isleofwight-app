/**
 * Global audio player — the single source of truth for the queue + playback
 * state, shared across the in-feed inline players and the floating mini-player.
 *
 * Matches the app's provider pattern (Context + useState, like AuthProvider).
 * Playback + OS integration is delegated to a platform engine (lib/audio/engine
 * → web: HTMLAudio+MediaSession, native: track-player), so this file is
 * platform-agnostic. Mounted once at the root (app/_layout.tsx).
 */
import * as React from 'react';
import engine, { audioEngineAvailable } from './audio/engine';
import type { AudioTrack } from './audio/types';

interface AudioPlayerState {
  /** The track currently loaded, or null when nothing is playing. */
  current: AudioTrack | null;
  queue: AudioTrack[];
  index: number;
  isPlaying: boolean;
  loading: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  rate: number;
}

interface LoadAttempt {
  track: AudioTrack;
  status: 'loading' | 'loaded' | 'failed';
  playWhenReady: boolean;
  metadataSet: boolean;
}

interface AudioPlayerContextValue extends AudioPlayerState {
  /**
   * False when the native audio module failed to load (#186) — playback would
   * silently no-op, so the UI hides audio controls instead of showing dead ones.
   */
  available: boolean;
  /** Play a track. Pass `list` to seed a queue (e.g. a channel's audio feed). */
  play: (track: AudioTrack, list?: AudioTrack[]) => void;
  toggle: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  /** Relative skip — negative rewinds. */
  skipBy: (seconds: number) => void;
  next: () => void;
  prev: () => void;
  addToQueue: (track: AudioTrack) => void;
  /** Jump to a queue index (the fullscreen "up next" list). */
  jumpTo: (index: number) => void;
  setRate: (rate: number) => void;
  /** Stop + dismiss the player entirely. */
  close: () => void;
  /** True when `track.id` is the loaded track. */
  isCurrent: (id: string) => boolean;
}

const noop = () => {};
const AudioPlayerContext = React.createContext<AudioPlayerContextValue>({
  available: audioEngineAvailable,
  current: null,
  queue: [],
  index: 0,
  isPlaying: false,
  loading: false,
  position: 0,
  duration: 0,
  rate: 1,
  play: noop,
  toggle: noop,
  pause: noop,
  seekTo: noop,
  skipBy: noop,
  next: noop,
  prev: noop,
  addToQueue: noop,
  jumpTo: noop,
  setRate: noop,
  close: noop,
  isCurrent: () => false,
});

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AudioPlayerState>({
    current: null,
    queue: [],
    index: 0,
    isPlaying: false,
    loading: false,
    position: 0,
    duration: 0,
    rate: 1,
  });

  // Refs mirror queue/index so the OS remote handlers (registered once) always
  // read live values instead of a stale closure.
  const queueRef = React.useRef<AudioTrack[]>([]);
  const indexRef = React.useRef(0);
  queueRef.current = state.queue;
  indexRef.current = state.index;
  const loadAttemptRef = React.useRef<LoadAttempt | null>(null);
  const playbackRequestRef = React.useRef(0);

  const playLoaded = React.useCallback((attempt: LoadAttempt) => {
    const request = ++playbackRequestRef.current;
    void engine.play().catch(() => {
      // A late rejection must not stop a newer track or resume request.
      setState((s) => loadAttemptRef.current === attempt && playbackRequestRef.current === request
        ? { ...s, isPlaying: false, loading: false }
        : s);
    });
    if (!attempt.metadataSet) {
      engine.setNowPlaying(attempt.track, 0, attempt.track.duration);
      attempt.metadataSet = true;
    }
  }, []);

  // Load + start the track at a given queue index.
  const playIndex = React.useCallback((list: AudioTrack[], i: number) => {
    const track = list[i];
    if (!track) return;
    const attempt: LoadAttempt = { track, status: 'loading', playWhenReady: true, metadataSet: false };
    loadAttemptRef.current = attempt;
    playbackRequestRef.current += 1;
    queueRef.current = list;
    indexRef.current = i;
    setState((s) => ({ ...s, queue: list, index: i, current: track, isPlaying: false, position: 0, duration: track.duration ?? 0, loading: true }));
    void engine.load(track).then(
      () => {
        if (loadAttemptRef.current !== attempt) return;
        attempt.status = 'loaded';
        if (attempt.playWhenReady) {
          playLoaded(attempt);
        }
      },
      () => {
        if (loadAttemptRef.current !== attempt) return;
        // Native load() may reject before it can emit any playback event.
        // Keep the track selected so every Play control can explicitly retry.
        attempt.status = 'failed';
        setState((s) => loadAttemptRef.current === attempt
          ? { ...s, isPlaying: false, loading: false }
          : s);
      },
    );
  }, [playLoaded]);

  const resume = React.useCallback(() => {
    const attempt = loadAttemptRef.current;
    if (!attempt) return;
    if (attempt.status === 'failed') playIndex(queueRef.current, indexRef.current);
    else if (attempt.status === 'loading') attempt.playWhenReady = true;
    else playLoaded(attempt);
  }, [playIndex, playLoaded]);

  const pause = React.useCallback(() => {
    if (loadAttemptRef.current) loadAttemptRef.current.playWhenReady = false;
    playbackRequestRef.current += 1;
    return engine.pause();
  }, []);

  const next = React.useCallback(() => {
    const q = queueRef.current;
    const i = indexRef.current + 1;
    if (i < q.length) playIndex(q, i);
  }, [playIndex]);

  const prev = React.useCallback(() => {
    // Standard behavior: if >3s in, restart the track; otherwise go to previous.
    const el = indexRef.current;
    const q = queueRef.current;
    setState((s) => {
      if (s.position > 3 || el === 0) {
        engine.seekTo(0);
        return { ...s, position: 0 };
      }
      playIndex(q, el - 1);
      return s;
    });
  }, [playIndex]);

  // Wire engine → React state, and OS remote controls → queue actions. Once.
  React.useEffect(() => {
    engine.setHandlers({
      onState: (playing) => setState((s) => ({ ...s, isPlaying: playing })),
      onLoading: (loading) => setState((s) => ({ ...s, loading })),
      onProgress: (position, duration) =>
        setState((s) => (s.position === position && s.duration === duration ? s : { ...s, position, duration })),
      onEnded: () => next(), // continuous playback → auto-advance
    });
    engine.setRemoteHandlers({
      onPlay: resume,
      onPause: pause,
      onNext: () => next(),
      onPrev: () => prev(),
      onSeek: (seconds) => {
        engine.seekTo(seconds);
        setState((s) => ({ ...s, position: seconds }));
      },
    });
    return () => {
      loadAttemptRef.current = null;
      playbackRequestRef.current += 1;
      engine.setHandlers({});
      engine.setRemoteHandlers({});
    };
  }, [next, prev, resume, pause]);

  const play = React.useCallback(
    (track: AudioTrack, list?: AudioTrack[]) => {
      const q = list?.length ? list : [track];
      const i = Math.max(0, q.findIndex((t) => t.id === track.id));
      // Same selected track → resume, or reload if its prior load failed.
      if (queueRef.current[indexRef.current]?.id === track.id && !list) {
        resume();
        return;
      }
      playIndex(q, i);
    },
    [playIndex, resume],
  );

  const toggle = React.useCallback(() => {
    if (state.isPlaying) pause();
    else resume();
  }, [state.isPlaying, pause, resume]);

  const seekTo = React.useCallback((seconds: number) => {
    engine.seekTo(seconds);
    setState((s) => ({ ...s, position: seconds }));
  }, []);

  const skipBy = React.useCallback((seconds: number) => {
    setState((s) => {
      const target = Math.max(0, Math.min(s.duration || Number.POSITIVE_INFINITY, s.position + seconds));
      engine.seekTo(target);
      return { ...s, position: target };
    });
  }, []);

  const addToQueue = React.useCallback((track: AudioTrack) => {
    setState((s) => {
      if (s.queue.some((t) => t.id === track.id)) return s;
      // Nothing playing yet → start it; otherwise append.
      if (!s.current) {
        playIndex([track], 0);
        return s;
      }
      return { ...s, queue: [...s.queue, track] };
    });
  }, [playIndex]);

  // Jump to a track already in the queue (the fullscreen "up next" list).
  const jumpTo = React.useCallback((i: number) => {
    const q = queueRef.current;
    if (i >= 0 && i < q.length && i !== indexRef.current) playIndex(q, i);
  }, [playIndex]);

  const setRate = React.useCallback((rate: number) => {
    engine.setRate(rate);
    setState((s) => ({ ...s, rate }));
  }, []);

  const close = React.useCallback(() => {
    loadAttemptRef.current = null;
    playbackRequestRef.current += 1;
    queueRef.current = [];
    indexRef.current = 0;
    engine.stop();
    setState((s) => ({ ...s, current: null, queue: [], index: 0, isPlaying: false, loading: false, position: 0, duration: 0 }));
  }, []);

  const isCurrent = React.useCallback((id: string) => state.current?.id === id, [state.current]);

  const value = React.useMemo<AudioPlayerContextValue>(
    () => ({ ...state, available: audioEngineAvailable, play, toggle, pause, seekTo, skipBy, next, prev, addToQueue, jumpTo, setRate, close, isCurrent }),
    [state, play, toggle, pause, seekTo, skipBy, next, prev, addToQueue, jumpTo, setRate, close, isCurrent],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  return React.useContext(AudioPlayerContext);
}
