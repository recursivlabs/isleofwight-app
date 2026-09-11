import { describe, expect, it } from 'vitest';
import { audioTrackIdFromUrl } from '../audio/trackId';

// The defect this exists for: MediaViewer had no id for an audio attachment
// that came without a post behind it, so it made one up from the item's index
// — `audio-0` for every DM voice note in the app. AudioTrack.id is compared
// globally (the provider's `isCurrent`) and used as a cache key (the native
// downloads index), so a per-instance id is a collision by construction.

describe('audioTrackIdFromUrl', () => {
  it('gives different audio different ids', () => {
    // The whole point. Two voice notes in one thread are two tracks.
    const a = audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-1.m4a');
    const b = audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-2.m4a');
    expect(a).not.toEqual(b);
  });

  it('separates urls that differ only in the last character', () => {
    // A weak hash that folded near-identical strings together would pass the
    // test above (the names differ in the middle) and still collide on the
    // sequentially-named uploads this actually sees.
    const ids = new Set(
      Array.from({ length: 64 }, (_, i) => audioTrackIdFromUrl(`https://cdn.example/a/${i}.m4a`)),
    );
    expect(ids.size).toBe(64);
  });

  it('is the same id every time for the same audio', () => {
    // A download survives a restart; an id that did not would orphan the file.
    const url = 'https://pub-abc.r2.dev/uploads/voice-1.m4a';
    expect(audioTrackIdFromUrl(url)).toEqual(audioTrackIdFromUrl(url));
  });

  it('ignores the query string and fragment', () => {
    // Re-signing an object mints a new token for the SAME audio. Keying on the
    // full URL would silently orphan its downloaded file at every refresh.
    const bare = audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-1.m4a');
    expect(audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-1.m4a?sig=aaa')).toEqual(bare);
    expect(audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-1.m4a?sig=bbb')).toEqual(bare);
    expect(audioTrackIdFromUrl('https://pub-abc.r2.dev/uploads/voice-1.m4a#t=3')).toEqual(bare);
  });

  it('stays short enough to be a filename after encodeURIComponent', () => {
    // downloads.native.ts does `${DIR}${encodeURIComponent(id)}.audio`. A raw
    // URL as the id would push a long signed link past the 255-byte name limit
    // and the download would fail inside a swallowing catch.
    const long = `https://pub-abc.r2.dev/uploads/${'x'.repeat(4000)}.m4a?sig=${'y'.repeat(4000)}`;
    expect(encodeURIComponent(audioTrackIdFromUrl(long)).length).toBeLessThan(64);
  });

  it('does not return a constant', () => {
    // Positive control. Every assertion above except the first would pass
    // against a function that returns one fixed string — which is precisely the
    // bug being fixed, so the guard has to be able to see it.
    expect(audioTrackIdFromUrl('https://a/1.m4a')).not.toEqual(audioTrackIdFromUrl('https://b/2.m4a'));
    expect(audioTrackIdFromUrl('https://a/1.m4a')).not.toEqual('audio-0');
  });
});
