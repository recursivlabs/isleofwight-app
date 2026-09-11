/**
 * Playback service — registered with track-player, runs in its background
 * context. Routes lockscreen / control-center transport to the provider's queue
 * via the engine's remote handlers, so prev/next advance the queue (and the
 * provider loads the next track) even when the app is backgrounded.
 */
import TrackPlayer, { Event } from 'react-native-track-player';
import { nativeAudioEngine } from './engine.native';

export async function playbackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    if (nativeAudioEngine.remote.onPlay) nativeAudioEngine.remote.onPlay();
    else TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    if (nativeAudioEngine.remote.onPause) nativeAudioEngine.remote.onPause();
    else TrackPlayer.pause();
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => nativeAudioEngine.remote.onNext?.());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => nativeAudioEngine.remote.onPrev?.());
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => nativeAudioEngine.remote.onSeek?.(e.position));
}
