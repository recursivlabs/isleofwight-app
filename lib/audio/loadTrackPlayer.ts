/**
 * The one place react-native-track-player is loaded. Isolated so the engine
 * can catch a module-scope throw (#186 — the library is unsupported on the
 * New Architecture and has broken on load twice), and so tests can substitute
 * the load without touching the native package. CJS require, not import:
 * an ESM import is hoisted above any try/catch that wraps it.
 */
export type TrackPlayerModule = typeof import('react-native-track-player');

export function loadTrackPlayerModule(): TrackPlayerModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-track-player');
  return (mod?.default ? mod : { ...mod, default: mod }) as TrackPlayerModule;
}
