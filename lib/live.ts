/**
 * Minds-facing live spectator adapter.
 *
 * The current transport is a public HLS/Mist feed. Keep the product surface
 * independent from that upstream implementation so viewers stay inside Minds
 * and the source can move behind the Recursiv platform without another UI
 * migration.
 */
export const LIVE_STREAM_URL = 'https://streams.battlechat.live/cmaf/battle/index.m3u8';
export const LIVE_STREAM_METADATA_URL = 'https://streams.battlechat.live/json_battle.js';

type StreamTrack = {
  codec?: unknown;
  type?: unknown;
};

type StreamMetadata = {
  error?: unknown;
  meta?: {
    live?: unknown;
    tracks?: Record<string, StreamTrack>;
  };
  type?: unknown;
};

/** True only when Mist reports a live stream with a playable video track. */
export function isLiveStreamAvailable(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as StreamMetadata;
  if (metadata.error) return false;

  const tracks = Object.values(metadata.meta?.tracks || {});
  const hasVideo = tracks.some((track) => track?.type === 'video' || track?.codec === 'H264');
  const reportsLive = metadata.type === 'live' || metadata.meta?.live === 1 || metadata.meta?.live === true;

  return reportsLive && hasVideo;
}

export async function fetchLiveStreamAvailable(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(LIVE_STREAM_METADATA_URL, {
    cache: 'no-store',
    signal,
  });
  // A transport failure is not evidence that a stream already playing for the
  // viewer stopped. Let the caller preserve its last-known state; an explicit
  // 200 metadata response with no live video is the only "off air" signal.
  if (!response.ok) throw new Error(`Live stream metadata returned ${response.status}`);
  return isLiveStreamAvailable(await response.json());
}
