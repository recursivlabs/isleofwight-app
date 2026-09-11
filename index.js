// Custom app entry. Registers the native audio playback service (track-player)
// before the router mounts so background/lockscreen audio is ready; on web this
// import resolves to a no-op (registerPlayback.ts), keeping track-player out of
// the web bundle. Then hands off to expo-router's standard entry.
//
// The require is guarded because this runs before AppRegistry, outside every
// error boundary: a throw here is a black screen on every launch with no
// in-app recovery (#186). Background audio is optional; booting is not.
try {
  require('./lib/audio/registerPlayback');
} catch (error) {
  console.error('[audio] playback registration failed — booting without background audio', error);
}

require('expo-router/entry');
