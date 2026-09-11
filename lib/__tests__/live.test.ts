import { describe, expect, it } from 'vitest';
import {
  LIVE_STREAM_METADATA_URL,
  LIVE_STREAM_URL,
  isLiveStreamAvailable,
} from '../live';

describe('Minds Live spectator contract', () => {
  it('uses the adapted production spectator endpoints', () => {
    expect(LIVE_STREAM_URL).toBe('https://streams.battlechat.live/cmaf/battle/index.m3u8');
    expect(LIVE_STREAM_METADATA_URL).toBe('https://streams.battlechat.live/json_battle.js');
  });

  it('requires both a live signal and a playable video track', () => {
    expect(isLiveStreamAvailable({
      type: 'live',
      meta: { tracks: { video: { type: 'video', codec: 'H264' } } },
    })).toBe(true);

    expect(isLiveStreamAvailable({
      meta: { live: 1, tracks: { video: { codec: 'H264' } } },
    })).toBe(true);

    expect(isLiveStreamAvailable({
      type: 'live',
      meta: { tracks: { audio: { type: 'audio', codec: 'AAC' } } },
    })).toBe(false);

    expect(isLiveStreamAvailable({
      type: 'live',
      error: 'stream offline',
      meta: { tracks: { video: { type: 'video' } } },
    })).toBe(false);

    expect(isLiveStreamAvailable(null)).toBe(false);
  });
});
