/**
 * Native app-entry side-effect: register the playback service + initialize
 * track-player with the transport capabilities that drive the lockscreen /
 * control-center. Imported once from index.js before the app mounts. The web
 * build resolves registerPlayback.ts (a no-op) instead, so track-player never
 * enters the web bundle.
 */
import TrackPlayer, { Capability } from 'react-native-track-player';
import { playbackService } from './playbackService';

TrackPlayer.registerPlaybackService(() => playbackService);

TrackPlayer.setupPlayer()
  .then(() =>
    TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1, // 1s → a smooth-enough scrubber
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
    }),
  )
  .catch(() => {
    // setupPlayer throws if already initialized (fast refresh / re-entry) — safe to ignore.
  });
