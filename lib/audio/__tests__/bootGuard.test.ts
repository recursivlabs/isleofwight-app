import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// #186: react-native-track-player is unsupported on the New Architecture and
// runs on a hand-maintained patch that has already broken twice. The decision
// on that issue is to KEEP the patched library and lockscreen audio — and to
// make boot survive the library anyway. These tests pin the two guards that
// decision requires: the entry-point require is caught, and the engine module
// degrades to a disabled no-op instead of throwing out of its import graph.

describe('audio boot guard (#186)', () => {
  it('index.js wraps the playback registration in try/catch, before the router entry', () => {
    // The registration runs pre-AppRegistry, outside every error boundary — a
    // module-scope throw there is a permanent black screen. Source-read the
    // entry file (the pattern signout-completeness.test.ts established): the
    // audio require must sit inside a try block, and expo-router/entry must be
    // required outside it, after.
    const src = readFileSync(join(__dirname, '..', '..', '..', 'index.js'), 'utf8');
    const tryBlock = src.match(/try\s*\{([\s\S]*?)\}\s*catch/);
    if (!tryBlock) throw new Error('index.js must guard the audio require with try/catch');
    expect(tryBlock[1]).toContain("require('./lib/audio/registerPlayback')");
    const afterCatch = src.slice(src.indexOf(tryBlock[0]) + tryBlock[0].length);
    expect(afterCatch).toContain("require('expo-router/entry')");
  });

  it('a throwing track-player yields a disabled engine, not a module error', async () => {
    vi.resetModules();
    vi.doMock('../loadTrackPlayer', () => ({
      loadTrackPlayerModule: () => {
        throw new Error('native module rejected 37 method signatures');
      },
    }));

    // The import itself must not throw — this module sits in _layout.tsx's
    // import graph, where the ErrorBoundary cannot catch it.
    const mod = await import('../engine.native');

    expect(mod.audioEngineAvailable).toBe(false);
    // Every control is inert but callable — the provider does not special-case.
    await expect(
      mod.default.load({ id: 't1', url: 'https://cdn.example/a.m4a', title: 'A' }),
    ).resolves.toBeUndefined();
    await expect(mod.default.play()).resolves.toBeUndefined();
    await expect(mod.default.stop()).resolves.toBeUndefined();
    expect(mod.nativeAudioEngine.remote).toEqual({});
    vi.doUnmock('../loadTrackPlayer');
  });

  it('a working track-player yields the real engine', async () => {
    // Positive control: the guard must not disable audio when the library
    // loads. A guard that always fell back would pass the test above.
    vi.resetModules();
    const add = vi.fn();
    const reset = vi.fn();
    vi.doMock('../loadTrackPlayer', () => ({
      loadTrackPlayerModule: () => ({
        default: {
          addEventListener: vi.fn(),
          add,
          reset,
          play: vi.fn(),
          pause: vi.fn(),
          seekTo: vi.fn(),
          setRate: vi.fn(),
        },
        Event: { PlaybackState: 'ps', PlaybackProgressUpdated: 'pp', PlaybackQueueEnded: 'pq' },
        State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading' },
      }),
    }));

    const mod = await import('../engine.native');

    expect(mod.audioEngineAvailable).toBe(true);
    await mod.default.load({ id: 't1', url: 'https://cdn.example/a.m4a', title: 'A' });
    expect(reset).toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    vi.doUnmock('../loadTrackPlayer');
  });

  it('remote handler replacement keeps the reference playbackService captured', async () => {
    // playbackService closes over nativeAudioEngine.remote at registration
    // time; replacing the OBJECT would orphan the lockscreen events. Replacing
    // the handlers must mutate in place.
    vi.resetModules();
    vi.doMock('../loadTrackPlayer', () => ({
      loadTrackPlayerModule: () => ({
        default: { addEventListener: vi.fn() },
        Event: { PlaybackState: 'ps', PlaybackProgressUpdated: 'pp', PlaybackQueueEnded: 'pq' },
        State: { Playing: 'playing', Buffering: 'buffering', Loading: 'loading' },
      }),
    }));
    const mod = await import('../engine.native');
    const captured = mod.nativeAudioEngine.remote;

    const onPlay = vi.fn();
    mod.default.setRemoteHandlers({ onPlay });
    expect(captured.onPlay).toBe(onPlay);

    const onPause = vi.fn();
    mod.default.setRemoteHandlers({ onPause });
    expect(captured.onPause).toBe(onPause);
    expect(captured.onPlay, 'stale handlers must not survive replacement').toBeUndefined();
    vi.doUnmock('../loadTrackPlayer');
  });
});
