/**
 * Web audio engine — a single HTMLAudioElement driven through the MediaSession
 * API so the browser exposes real OS media controls: lockscreen transport on
 * mobile browsers, the macOS Now Playing widget / media keys on desktop, and
 * keeps playing when the tab is backgrounded. This is the same mechanism the
 * Spotify web player uses, so "Spotify-grade" holds on web with no native build.
 */
import type { AudioEngine, AudioEngineHandlers, AudioRemoteHandlers, AudioTrack } from './types';

class WebAudioEngine implements AudioEngine {
  private el: HTMLAudioElement | null = null;
  private handlers: AudioEngineHandlers = {};
  private remote: AudioRemoteHandlers = {};
  private playbackRequest = 0;

  private audio(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = 'metadata';
    el.addEventListener('play', () => this.handlers.onState?.(true));
    el.addEventListener('pause', () => this.handlers.onState?.(false));
    el.addEventListener('ended', () => this.handlers.onEnded?.());
    el.addEventListener('waiting', () => this.handlers.onLoading?.(true));
    el.addEventListener('playing', () => this.handlers.onLoading?.(false));
    el.addEventListener('canplay', () => this.handlers.onLoading?.(false));
    el.addEventListener('error', () => {
      // A queued error from a previous source may arrive after load() reset it.
      if (!el.error) return;
      this.playbackRequest += 1;
      this.handlers.onLoading?.(false);
      this.handlers.onState?.(false);
    });
    el.addEventListener('timeupdate', () =>
      this.handlers.onProgress?.(el.currentTime || 0, el.duration || 0),
    );
    el.addEventListener('loadedmetadata', () => {
      this.handlers.onProgress?.(el.currentTime || 0, el.duration || 0);
      this.syncPositionState();
    });
    this.el = el;
    return el;
  }

  async load(track: AudioTrack): Promise<void> {
    const el = this.audio();
    if (el.src !== track.url) {
      this.playbackRequest += 1;
      el.src = track.url;
      el.load();
    }
  }

  async play(): Promise<void> {
    const el = this.audio();
    const request = ++this.playbackRequest;
    try {
      // Retry a failed resource only after another explicit play request.
      // Healthy pause/resume must retain its current position and buffer.
      if (el.error) el.load();
      await el.play();
    } catch {
      // load(), pause(), or a newer play may supersede this pending promise.
      if (request !== this.playbackRequest) return;
      this.handlers.onLoading?.(false);
      this.handlers.onState?.(false);
    }
  }

  async pause(): Promise<void> {
    this.playbackRequest += 1;
    this.audio().pause();
  }

  async seekTo(seconds: number): Promise<void> {
    const el = this.audio();
    if (Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
    this.syncPositionState();
  }

  async setRate(rate: number): Promise<void> {
    this.audio().playbackRate = rate;
  }

  async stop(): Promise<void> {
    this.playbackRequest += 1;
    if (!this.el) return;
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }

  setHandlers(handlers: AudioEngineHandlers): void {
    this.handlers = handlers;
  }

  setRemoteHandlers(handlers: AudioRemoteHandlers): void {
    this.remote = handlers;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, cb?: (d: MediaSessionActionDetails) => void) => {
      try {
        ms.setActionHandler(action, cb ? (d) => cb(d) : null);
      } catch {
        /* unsupported action on this browser — ignore */
      }
    };
    set('play', () => this.remote.onPlay?.());
    set('pause', () => this.remote.onPause?.());
    set('previoustrack', () => this.remote.onPrev?.());
    set('nexttrack', () => this.remote.onNext?.());
    set('seekto', (d) => {
      if (typeof d.seekTime === 'number') this.remote.onSeek?.(d.seekTime);
    });
    set('seekbackward', (d) => {
      const el = this.audio();
      this.remote.onSeek?.(Math.max(0, el.currentTime - (d.seekOffset || 10)));
    });
    set('seekforward', (d) => {
      const el = this.audio();
      this.remote.onSeek?.(el.currentTime + (d.seekOffset || 10));
    });
  }

  setNowPlaying(track: AudioTrack, positionSeconds?: number, durationSeconds?: number): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Audio',
        artist: track.artist || 'Minds',
        artwork: track.artwork
          ? [
              { src: track.artwork, sizes: '512x512', type: 'image/jpeg' },
              { src: track.artwork, sizes: '256x256', type: 'image/jpeg' },
            ]
          : [],
      });
      navigator.mediaSession.playbackState = 'playing';
      this.syncPositionState(positionSeconds, durationSeconds);
    } catch {
      /* MediaMetadata unsupported — controls still work, just no rich metadata */
    }
  }

  /** Feed the OS scrubber an accurate position/duration so the lockscreen seek bar tracks. */
  private syncPositionState(position?: number, duration?: number): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession as MediaSession & {
      setPositionState?: (s: { duration: number; position: number; playbackRate: number }) => void;
    };
    const el = this.el;
    const dur = duration ?? el?.duration ?? 0;
    const pos = position ?? el?.currentTime ?? 0;
    if (ms.setPositionState && Number.isFinite(dur) && dur > 0) {
      try {
        ms.setPositionState({ duration: dur, position: Math.min(pos, dur), playbackRate: el?.playbackRate || 1 });
      } catch {
        /* invalid state values — ignore */
      }
    }
  }
}

const engine: AudioEngine = new WebAudioEngine();
/** The web engine has no native module to fail — always available. */
export const audioEngineAvailable = true;
export default engine;
