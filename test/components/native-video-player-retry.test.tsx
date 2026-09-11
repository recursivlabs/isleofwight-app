import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Status = 'loading' | 'readyToPlay' | 'error';
type StatusEvent = { status: Status };
type Source = { uri: string; headers: { Referer: string } };
interface MockPlayer {
  id: number;
  source: Source;
  status: Status;
  muted: boolean;
  loop: boolean;
  playing: boolean;
  play: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  listeners: Set<(event: StatusEvent) => void>;
}

const mocks = vi.hoisted(() => ({
  players: [] as MockPlayer[],
  initialStatus: 'loading' as Status,
}));

vi.mock('expo', async () => {
  const React = await import('react');
  return {
    useEvent(player: MockPlayer, eventName: string, initialValue: StatusEvent) {
      const [event, setEvent] = React.useState(initialValue);
      React.useEffect(() => {
        player.listeners.add(setEvent);
        return () => { player.listeners.delete(setEvent); };
      }, [player, eventName]);
      return event;
    },
  };
});

vi.mock('expo-video', async () => {
  const React = await import('react');
  return {
    // Model the installed expo-video 3.0.16 hook's source-keyed ownership and
    // unmount release, not a native decoder or the Expo device runtime.
    useVideoPlayer(source: Source, setup?: (player: MockPlayer) => void) {
      const sourceKey = JSON.stringify(source);
      const player = React.useMemo(() => {
        const instance: MockPlayer = {
          id: mocks.players.length,
          source,
          status: mocks.initialStatus,
          muted: false,
          loop: false,
          playing: false,
          play: vi.fn(),
          release: vi.fn(),
          listeners: new Set(),
        };
        instance.play.mockImplementation(() => { instance.playing = true; });
        mocks.players.push(instance);
        setup?.(instance);
        return instance;
      }, [sourceKey]);
      React.useEffect(() => () => { player.release(); }, [player]);
      return player;
    },
    VideoView: ({ player }: { player: MockPlayer }) => (
      <div data-testid="native-video-view" data-player-id={player.id} />
    ),
  };
});

// Component tests normally prefer .web.tsx. Explicit importActual keeps this
// suite on the native implementation while avoiding a native package runtime.
vi.mock('../../components/VideoPlayer', () => vi.importActual('../../components/VideoPlayer.tsx'));

import { VideoPlayer } from '../../components/VideoPlayer';
import { SITE_URL } from '../../lib/recursiv';

const uri = 'https://media.example/new-upload.mp4';

function setStatus(player: MockPlayer, status: Status) {
  act(() => {
    player.status = status;
    player.listeners.forEach((listener) => listener({ status }));
  });
}

beforeEach(() => {
  mocks.players = [];
  mocks.initialStatus = 'loading';
});

describe('native video playback retry', () => {
  it('offers an enabled retry with a fresh same-source player and releases the failed instance', () => {
    const { unmount } = render(<VideoPlayer uri={uri} poster="https://media.example/poster.jpg" />);
    const first = mocks.players[0];
    setStatus(first, 'error');

    const retry = screen.getByRole('button', { name: 'Retry video' });
    expect(retry).toBeEnabled();
    expect(screen.getByText("Couldn't load this video")).toBeInTheDocument();
    expect(screen.getByText('Tap to retry')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Video preview' })).toBeInTheDocument();
    fireEvent.click(retry);

    expect(mocks.players).toHaveLength(2);
    const second = mocks.players[1];
    expect(first.release).toHaveBeenCalledOnce();
    expect(second.release).not.toHaveBeenCalled();
    expect(second.source).toEqual({ uri, headers: { Referer: SITE_URL } });
    expect(second.source).toEqual(first.source);
    expect(second.loop).toBe(true);
    expect(screen.getByTestId('native-video-view')).toHaveAttribute('data-player-id', String(second.id));
    expect(screen.queryByRole('button', { name: 'Retry video' })).not.toBeInTheDocument();

    unmount();
    expect(first.release).toHaveBeenCalledOnce();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it('retains a caller label and reports a new error for each immediately failed attempt', () => {
    mocks.initialStatus = 'error';
    const onPlaybackError = vi.fn();
    render(<VideoPlayer uri={uri} accessibilityLabel="Minds Live stream" onPlaybackError={onPlaybackError} />);
    expect(onPlaybackError).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Minds Live stream, retry video' }));

    expect(mocks.players).toHaveLength(2);
    expect(onPlaybackError).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Minds Live stream, retry video' })).toBeEnabled();
    setStatus(mocks.players[1], 'error');
    expect(onPlaybackError).toHaveBeenCalledTimes(2);
  });

  it('resets readiness per attempt and ignores status events from the released player', () => {
    const onPlaybackReady = vi.fn();
    const onPlaybackError = vi.fn();
    render(<VideoPlayer uri={uri} onPlaybackReady={onPlaybackReady} onPlaybackError={onPlaybackError} />);
    const first = mocks.players[0];
    setStatus(first, 'readyToPlay');
    setStatus(first, 'readyToPlay');
    expect(onPlaybackReady).toHaveBeenCalledOnce();
    setStatus(first, 'error');
    expect(onPlaybackError).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry video' }));

    const second = mocks.players[1];
    expect(first.listeners.size).toBe(0);
    setStatus(first, 'readyToPlay');
    setStatus(first, 'error');
    expect(onPlaybackReady).toHaveBeenCalledOnce();
    expect(onPlaybackError).toHaveBeenCalledOnce();

    setStatus(second, 'readyToPlay');
    setStatus(second, 'readyToPlay');
    expect(onPlaybackReady).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Couldn't load this video")).not.toBeInTheDocument();
    setStatus(second, 'error');
    expect(onPlaybackError).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Retry video' })).toBeEnabled();
  });

  it('does not automatically play a retry when autoplay is disabled', () => {
    render(<VideoPlayer uri={uri} autoplay={false} />);
    const first = mocks.players[0];
    expect(first.play).not.toHaveBeenCalled();
    setStatus(first, 'error');
    fireEvent.click(screen.getByRole('button', { name: 'Retry video' }));

    const second = mocks.players[1];
    expect(second.play).not.toHaveBeenCalled();
    expect(second.muted).toBe(false);
    setStatus(second, 'readyToPlay');
    expect(second.play).not.toHaveBeenCalled();
  });

  it.each([true, false])('preserves the previous mute choice with autoplay=%s', (autoplay) => {
    render(<VideoPlayer uri={uri} autoplay={autoplay} />);
    const first = mocks.players[0];
    expect(first.play).toHaveBeenCalledTimes(autoplay ? 1 : 0);
    setStatus(first, 'readyToPlay');
    fireEvent.click(screen.getByRole('button', { name: autoplay ? 'Unmute video' : 'Mute video' }));
    expect(first.muted).toBe(!autoplay);
    setStatus(first, 'error');
    fireEvent.click(screen.getByRole('button', { name: 'Retry video' }));

    const second = mocks.players[1];
    expect(second.muted).toBe(!autoplay);
    expect(second.play).toHaveBeenCalledTimes(autoplay ? 1 : 0);
    setStatus(second, 'readyToPlay');
    expect(screen.getByRole('button', { name: autoplay ? 'Mute video' : 'Unmute video' })).toBeEnabled();
  });
});
