/**
 * Native audio engine — PLACEHOLDER.
 *
 * Spotify-grade native audio (background playback + lockscreen/control-center)
 * uses `react-native-track-player`, a native module that requires a custom dev
 * build (it can't run in Expo Go). Until that build exists, this stub keeps the
 * app compiling + running in Expo Go; audio playback is web-only for now.
 *
 * TO ACTIVATE (when the dev build is set up):
 *   1. `npx expo install react-native-track-player`
 *   2. add the background-audio config plugin (iOS UIBackgroundModes=['audio'],
 *      Android foreground service) to app.json
 *   3. register the playback service at app entry (TrackPlayer.registerPlaybackService)
 *      + TrackPlayer.setupPlayer() + updateOptions({ capabilities: [Play, Pause,
 *      SkipToNext, SkipToPrevious, SeekTo] })
 *   4. replace the bodies below with TrackPlayer.add/load/play/pause/seekTo/setRate;
 *      map setHandlers → TrackPlayer event listeners (PlaybackState, PlaybackProgressUpdated);
 *      setRemoteHandlers → the playback service's remote-* events.
 * The provider + UI already speak this contract, so only this file changes.
 * Reference impl: github.com/Minds/mobile-native src/modules/audio-player.
 */
import { Platform } from 'react-native';
import type { AudioEngine, AudioEngineHandlers, AudioRemoteHandlers, AudioTrack } from './types';

let warned = false;
function warnOnce(): void {
  if (warned) return;
  warned = true;
  if (__DEV__) {
    console.warn(
      `[audio] Native playback needs react-native-track-player + a dev build; audio is web-only for now (platform=${Platform.OS}).`,
    );
  }
}

class NativeAudioStubEngine implements AudioEngine {
  async load(_track: AudioTrack): Promise<void> {
    warnOnce();
  }
  async play(): Promise<void> {
    warnOnce();
  }
  async pause(): Promise<void> {}
  async seekTo(_seconds: number): Promise<void> {}
  async setRate(_rate: number): Promise<void> {}
  async stop(): Promise<void> {}
  setHandlers(_handlers: AudioEngineHandlers): void {}
  setRemoteHandlers(_handlers: AudioRemoteHandlers): void {}
  setNowPlaying(_track: AudioTrack): void {}
}

const engine: AudioEngine = new NativeAudioStubEngine();
/** The stub warns instead of playing, but the controls stay visible. */
export const audioEngineAvailable = true;
export default engine;
