/**
 * Base / web no-op for the native track-player registration. Web audio uses
 * HTMLAudio + MediaSession (engine.web.ts) and needs no app-entry setup, so this
 * keeps track-player out of the web bundle. Metro picks registerPlayback.native.ts
 * on iOS/Android.
 */
export {};
