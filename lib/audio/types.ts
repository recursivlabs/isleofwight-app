/**
 * Audio player — shared types + the platform engine contract.
 *
 * The provider (lib/audioPlayer.tsx) owns the QUEUE, the current index, and all
 * React-facing state. A platform ENGINE owns actual playback + OS integration:
 *   - engine.web.ts   → HTMLAudioElement + the MediaSession API (real lockscreen /
 *                        media-key / now-playing controls in the browser — the same
 *                        approach the Spotify web player uses). Works today, no native build.
 *   - engine.native.ts → react-native-track-player (background + lockscreen on
 *                        iOS/Android). Wired behind this same contract; needs a dev build.
 *
 * Metro resolves `./engine` to the right file per platform, so neither side leaks
 * into the other's bundle.
 */

export interface AudioTrack {
  /** Stable id — the post/activity guid. Used for resume + dedupe. */
  id: string;
  /** Playable URL (remote, or a local file path once downloaded). */
  url: string;
  title: string;
  artist?: string;
  /** Artwork URL (post thumbnail / channel avatar). */
  artwork?: string;
  /** Seconds, if known up front (improves the scrubber before metadata loads). */
  duration?: number;
}

/** Engine → provider notifications. The provider maps these to React state. */
export interface AudioEngineHandlers {
  onState?: (playing: boolean) => void;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  /** Buffering/stalled → spinner in the UI. */
  onLoading?: (loading: boolean) => void;
}

/** OS remote-control events (lockscreen / media keys / control center). */
export interface AudioRemoteHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (seconds: number) => void;
}

export interface AudioEngine {
  /** Load a track and prepare it for playback (does not auto-play). */
  load(track: AudioTrack): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  /** Stop + release the current track. */
  stop(): Promise<void>;
  /** Playback-state + progress callbacks. */
  setHandlers(handlers: AudioEngineHandlers): void;
  /** OS media-control callbacks (the provider routes these to the queue). */
  setRemoteHandlers(handlers: AudioRemoteHandlers): void;
  /** Push now-playing metadata to the OS (lockscreen / control center). */
  setNowPlaying(track: AudioTrack, positionSeconds?: number, durationSeconds?: number): void;
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.weba'];

/** Heuristic: is this URL an audio file? (mirrors MediaViewer's isVideoUrl). */
export function isAudioUrl(url: string): boolean {
  const u = (url || '').toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => u.includes(ext)) || u.includes('/audio/');
}
