/**
 * Offline downloads — base / web implementation = no-op. Saving audio to the
 * device for offline playback is a native capability (background file storage),
 * so on web these are inert and `downloadsSupported` is false (the UI hides the
 * download control). Metro picks downloads.native.ts on iOS/Android.
 */
import type { AudioTrack } from './types';

export type DownloadStatus = 'none' | 'downloading' | 'downloaded';

/** True only on native — the UI gates the download button on this. */
export const downloadsSupported = false;

/** Local file uri for a downloaded track, or null. */
export async function getLocalUri(_id: string): Promise<string | null> {
  return null;
}

export async function downloadTrack(_track: AudioTrack): Promise<void> {
  /* offline download is a mobile feature */
}

export async function removeDownload(_id: string): Promise<void> {
  /* no-op on web */
}

/** Native clears its persisted index/files; web has no download surface. */
export async function clearAllDownloads(): Promise<void> {
  /* no-op on web */
}

export function downloadStatus(_id: string): DownloadStatus {
  return 'none';
}

export function subscribeDownloads(_cb: () => void): () => void {
  return () => {};
}

/** Bumps when any download state changes — drives useSyncExternalStore. */
export function downloadsVersion(): number {
  return 0;
}
