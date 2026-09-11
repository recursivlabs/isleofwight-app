import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngineHandlers, AudioRemoteHandlers, AudioTrack } from '../../lib/audio/types';

const media = vi.hoisted(() => ({
  handlers: {} as AudioEngineHandlers,
  remote: {} as AudioRemoteHandlers,
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  nowPlaying: vi.fn(),
}));

// Keep the real shared provider and inline controls. Only the platform engine
// boundary is controlled; no browser media, native module or URL is opened.
vi.mock('../../lib/audio/engine', () => ({
  audioEngineAvailable: true,
  default: {
    load: media.load,
    play: media.play,
    pause: media.pause,
    stop: media.stop,
    seekTo: vi.fn(async () => {}),
    setRate: vi.fn(async () => {}),
    setNowPlaying: media.nowPlaying,
    setHandlers: (handlers: AudioEngineHandlers) => { media.handlers = handlers; },
    setRemoteHandlers: (remote: AudioRemoteHandlers) => { media.remote = remote; },
  },
}));

import { InlineAudioPlayer } from '../../components/audio/InlineAudioPlayer';
import { AudioPlayerProvider, useAudioPlayer } from '../../lib/audioPlayer';

const A: AudioTrack = { id: 'audio-load-a', url: 'https://media.example/a.m4a', title: 'Audio A' };
const B: AudioTrack = { id: 'audio-load-b', url: 'https://media.example/b.m4a', title: 'Audio B' };

function Controls() {
  const player = useAudioPlayer();
  return <>
    <button type="button" onClick={() => player.play(A)}>Play A explicitly</button>
    <button type="button" onClick={player.close}>Close audio</button>
    <output data-testid="current-audio">{player.current?.id ?? 'none'}</output>
    <output data-testid="audio-playing">{String(player.isPlaying)}</output>
  </>;
}

function openPlayers() {
  return render(<AudioPlayerProvider>
    <Controls />
    {[A, B].map(track => <div key={track.id} data-testid={track.id}>
      <InlineAudioPlayer track={track} />
    </div>)}
  </AudioPlayerProvider>);
}

function transport(track = A) {
  const icon = screen.getByTestId(track.id)
    .querySelector('[data-icon="play"], [data-icon="pause"], [data-icon="ellipsis-horizontal"]');
  if (!icon?.parentElement) throw new Error('Audio transport is missing');
  return icon.parentElement;
}

function expectTransport(track: AudioTrack, icon: 'play' | 'pause' | 'ellipsis-horizontal') {
  expect(transport(track).querySelector('[data-icon]')).toHaveAttribute('data-icon', icon);
}

async function pressTransport(track = A) {
  await act(async () => { fireEvent.click(transport(track)); });
}

function deferredLoad() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return {
    promise,
    resolve,
    reject: () => reject(new Error('Synthetic audio load rejection')),
  };
}

beforeEach(() => {
  media.handlers = {};
  media.remote = {};
  media.load.mockReset().mockResolvedValue(undefined);
  media.nowPlaying.mockReset();
  media.play.mockReset().mockImplementation(async () => {
    await Promise.resolve();
    media.handlers.onState?.(true);
    media.handlers.onLoading?.(false);
  });
  media.pause.mockReset().mockImplementation(async () => {
    await Promise.resolve();
    media.handlers.onState?.(false);
  });
  media.stop.mockReset().mockImplementation(async () => {
    await Promise.resolve();
    media.handlers.onState?.(false);
    media.handlers.onLoading?.(false);
  });
});

describe('shared audio load failure recovery', () => {
  it('clears buffering when load rejects without sending any engine callbacks', async () => {
    const pending = deferredLoad();
    media.load.mockReturnValueOnce(pending.promise);
    openPlayers();
    await pressTransport();
    expectTransport(A, 'ellipsis-horizontal');

    await act(async () => { pending.reject(); });

    expectTransport(A, 'play');
    expect(media.play).not.toHaveBeenCalled();
    expect(media.nowPlaying).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-audio')).toHaveTextContent(A.id);
  });

  it.each(['inline', 'explicit', 'remote'] as const)('retries a failed load from %s Play', async (entry) => {
    const pending = deferredLoad();
    media.load.mockReturnValueOnce(pending.promise);
    openPlayers();
    await pressTransport();
    await act(async () => { pending.reject(); });

    await act(async () => {
      if (entry === 'inline') fireEvent.click(transport());
      if (entry === 'explicit') fireEvent.click(screen.getByRole('button', { name: 'Play A explicitly' }));
      if (entry === 'remote') media.remote.onPlay?.();
    });

    expect(media.load).toHaveBeenCalledTimes(2);
    expect(media.load).toHaveBeenLastCalledWith(A);
    expect(media.play).toHaveBeenCalledOnce();
    expect(media.nowPlaying).toHaveBeenCalledWith(A, 0, A.duration);
    expectTransport(A, 'pause');
  });

  it('pauses and resumes healthy audio without loading it again', async () => {
    openPlayers();
    await pressTransport();
    expectTransport(A, 'pause');
    await pressTransport();
    expectTransport(A, 'play');
    await pressTransport();

    expectTransport(A, 'pause');
    expect(media.load).toHaveBeenCalledOnce();
    expect(media.play).toHaveBeenCalledTimes(2);
    expect(media.pause).toHaveBeenCalledOnce();
  });

  it('sets selected-track metadata when a paused pending load is explicitly resumed', async () => {
    const pending = deferredLoad();
    media.load.mockReturnValueOnce(pending.promise);
    openPlayers();
    await pressTransport();
    await act(async () => { media.remote.onPause?.(); });
    await act(async () => { pending.resolve(); });
    expect(media.play).not.toHaveBeenCalled();
    expect(media.nowPlaying).not.toHaveBeenCalled();

    await act(async () => { media.remote.onPlay?.(); });

    expect(media.load).toHaveBeenCalledOnce();
    expect(media.play).toHaveBeenCalledOnce();
    expectTransport(A, 'pause');
    expect(media.nowPlaying).toHaveBeenCalledWith(A, 0, A.duration);
  });

  it.each(['resolve', 'reject'] as const)('ignores an old load that later %ss after B starts', async (settle) => {
    const pending = deferredLoad();
    media.load.mockReturnValueOnce(pending.promise);
    openPlayers();
    await pressTransport();
    await pressTransport(B);
    expectTransport(B, 'pause');
    expect(media.play).toHaveBeenCalledOnce();

    await act(async () => { pending[settle](); });

    expect(screen.getByTestId('current-audio')).toHaveTextContent(B.id);
    expectTransport(A, 'play');
    expectTransport(B, 'pause');
    expect(media.play).toHaveBeenCalledOnce();
    expect(media.nowPlaying).toHaveBeenCalledOnce();
    expect(media.nowPlaying).toHaveBeenLastCalledWith(B, 0, B.duration);
  });

  it.each(['resolve', 'reject'] as const)('does not restart dismissed audio when its load later %ss', async (settle) => {
    const pending = deferredLoad();
    media.load.mockReturnValueOnce(pending.promise);
    openPlayers();
    await pressTransport();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close audio' })); });
    expect(media.stop).toHaveBeenCalledOnce();

    await act(async () => { pending[settle](); });

    expect(screen.getByTestId('current-audio')).toHaveTextContent('none');
    expect(screen.getByTestId('audio-playing')).toHaveTextContent('false');
    expectTransport(A, 'play');
    expect(media.play).not.toHaveBeenCalled();
    expect(media.nowPlaying).not.toHaveBeenCalled();
  });
});
