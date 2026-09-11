/**
 * Offline downloads (native) — saves a track's audio to the device so it plays
 * with no network, in the background. This is the feature the long-form / audio
 * ("confessionals") audience cares about. The native engine's load() prefers the
 * cached file via getLocalUri().
 *
 * State: an in-memory map (id → local uri) + in-progress set, persisted to
 * AsyncStorage so downloads survive restarts. A version counter drives the UI
 * via useSyncExternalStore.
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioTrack } from './types';
import { captureMessage } from '../monitoring';

export type DownloadStatus = 'none' | 'downloading' | 'downloaded';

export const downloadsSupported = true;

const DIR = `${FileSystem.documentDirectory ?? ''}audio-downloads/`;
const INDEX_KEY = 'minds.audio.downloads.v1';

const downloaded = new Map<string, string>(); // id → local uri
const inProgress = new Set<string>();
let version = 0;
// Sign-out may race an active download. A generation captured before the clear
// must never be allowed to repopulate the next account's index afterwards.
let accountGeneration = 0;
const subs = new Set<() => void>();

function bump(): void {
  version += 1;
  for (const f of subs) f();
}

let hydrating: Promise<void> | null = null;
function hydrate(): Promise<void> {
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as Record<string, string>;
          for (const [k, v] of Object.entries(obj)) downloaded.set(k, v);
        }
      } catch {
        /* corrupt index — start empty */
      }
      bump();
    })();
  }
  return hydrating;
}
// Warm the index on module load.
void hydrate();

async function persist(): Promise<void> {
  const obj: Record<string, string> = {};
  for (const [k, v] of downloaded) obj[k] = v;
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(obj));
  } catch {
    /* best-effort */
  }
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    /* ignore */
  }
}

function pathFor(id: string): string {
  return `${DIR}${encodeURIComponent(id)}.audio`;
}

export async function getLocalUri(id: string): Promise<string | null> {
  await hydrate();
  return downloaded.get(id) ?? null;
}

export function downloadStatus(id: string): DownloadStatus {
  if (downloaded.has(id)) return 'downloaded';
  if (inProgress.has(id)) return 'downloading';
  return 'none';
}

export async function downloadTrack(track: AudioTrack): Promise<void> {
  await hydrate();
  if (downloaded.has(track.id) || inProgress.has(track.id)) return;
  const generation = accountGeneration;
  inProgress.add(track.id);
  bump();
  try {
    await ensureDir();
    const res = await FileSystem.downloadAsync(track.url, pathFor(track.id));
    if (res && res.status >= 200 && res.status < 300) {
      if (generation === accountGeneration) {
        downloaded.set(track.id, res.uri);
        await persist();
      } else {
        // The account signed out while the transfer was in flight. The file is
        // previous-account data even though it arrived after the directory was
        // swept, so remove it rather than attaching it to the next session.
        try {
          await FileSystem.deleteAsync(res.uri, { idempotent: true });
        } catch {
          captureMessage('audio: failed to remove a download completed after sign-out', {
            consequence: 'previous-account audio may remain in the app sandbox',
          });
        }
      }
    }
  } catch {
    /* network/disk error — leave un-downloaded */
  } finally {
    inProgress.delete(track.id);
    bump();
  }
}

export async function removeDownload(id: string): Promise<void> {
  const uri = downloaded.get(id);
  if (uri) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      /* file already gone */
    }
  }
  downloaded.delete(id);
  await persist();
  bump();
}

/**
 * Remove every account-derived download surface on sign-out: persisted index,
 * files, in-memory state, and any in-flight transfer's authority to persist.
 * Storage failures are surfaced so auth can report an incomplete privacy clear.
 */
export async function clearAllDownloads(): Promise<void> {
  accountGeneration += 1;
  await hydrate();

  downloaded.clear();
  inProgress.clear();
  bump();

  const results = await Promise.allSettled([
    AsyncStorage.removeItem(INDEX_KEY),
    FileSystem.deleteAsync(DIR, { idempotent: true }),
  ]);
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`Failed to clear ${failed.length} offline download surface(s)`);
  }
}

export function subscribeDownloads(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function downloadsVersion(): number {
  return version;
}
