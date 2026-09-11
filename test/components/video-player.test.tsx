import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayer } from '../../components/VideoPlayer';
import { shouldUseNativeHls } from '../../components/VideoPlayer.web';

const mocks = vi.hoisted(() => ({
  getVideoStatus: vi.fn(),
  players: [] as Array<{
    destroy: ReturnType<typeof vi.fn>;
    loadSource: ReturnType<typeof vi.fn>;
    emit: (event: string, data?: unknown) => void;
  }>,
}));

vi.mock('../../lib/video', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/video')>(),
  getVideoStatus: mocks.getVideoStatus,
}));
vi.mock('hls.js', () => ({
  default: class {
    static isSupported = () => true;
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest' };
    static ErrorTypes = { MEDIA_ERROR: 'media', NETWORK_ERROR: 'network' };
    callbacks = new Map<string, (event: string, data?: unknown) => void>();
    destroy = vi.fn();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    recoverMediaError = vi.fn();
    levels = [];
    constructor() { mocks.players.push(this); }
    on(event: string, callback: (event: string, data?: unknown) => void) {
      this.callbacks.set(event, callback);
    }
    emit(event: string, data?: unknown) { this.callbacks.get(event)?.(event, data); }
  },
}));

describe('VideoPlayer web autoplay', () => {
  const play = vi.fn<() => Promise<void>>();

  beforeEach(() => {
    mocks.players.length = 0;
    mocks.getVideoStatus.mockReset().mockResolvedValue(null);
    play.mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  });

  it('starts a progressive source attached after mount when autoplay is enabled', async () => {
    const { container } = render(<VideoPlayer uri="https://media.example/video.mp4" autoplay />);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(container.querySelector('video')?.src).toBe('https://media.example/video.mp4');
  });

  it('does not start playback when autoplay is disabled', async () => {
    render(<VideoPlayer uri="https://media.example/video.mp4" autoplay={false} />);

    await waitFor(() => expect(play).not.toHaveBeenCalled());
  });

  it('exposes a caller-provided accessible name on the video controls', () => {
    render(
      <VideoPlayer
        uri="https://media.example/live.m3u8"
        accessibilityLabel="Minds Live stream"
        autoplay={false}
      />,
    );

    expect(screen.getByLabelText('Minds Live stream')).toHaveAttribute('controls');
  });

  it('replaces a failed progressive player with an unavailable state', async () => {
    const onPlaybackError = vi.fn();
    const { container } = render(
      <VideoPlayer
        uri="https://media.example/missing-video.mp4"
        autoplay={false}
        onPlaybackError={onPlaybackError}
      />,
    );
    const video = container.querySelector('video');
    expect(video).not.toBeNull();

    fireEvent.error(video as HTMLVideoElement);

    expect(await screen.findByText("Couldn't load this video")).toBeInTheDocument();
    expect(video).toHaveStyle({ visibility: 'hidden' });
    expect(onPlaybackError).toHaveBeenCalledTimes(1);
  });

  it('reports readiness only after the media can actually play', async () => {
    const onPlaybackReady = vi.fn();
    const { container } = render(
      <VideoPlayer
        uri="https://media.example/video.mp4"
        autoplay={false}
        onPlaybackReady={onPlaybackReady}
      />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(onPlaybackReady).not.toHaveBeenCalled();
    fireEvent.canPlay(video);

    expect(onPlaybackReady).toHaveBeenCalledTimes(1);
  });

  it('does not trust a Chromium shell that only claims native HLS support', () => {
    const video = { canPlayType: () => 'maybe' } as Pick<HTMLVideoElement, 'canPlayType'>;

    expect(shouldUseNativeHls(
      video,
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    )).toBe(false);
    expect(shouldUseNativeHls(
      video,
      'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    )).toBe(true);
  });

  it('retries a failed new video without blaming migration or changing playback preferences', async () => {
    const user = userEvent.setup({ delay: null });
    const onPlaybackReady = vi.fn();
    const onPlaybackError = vi.fn();
    const { container } = render(<VideoPlayer
      uri="https://media.example/new.mp4"
      onPlaybackReady={onPlaybackReady}
      onPlaybackError={onPlaybackError}
    />);
    const first = container.querySelector('video')!;
    first.muted = false;
    first.volume = 0.4;
    fireEvent.error(first);
    expect(screen.getByText("Couldn't load this video")).toBeInTheDocument();
    expect(screen.queryByText(/still moving over/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry video' }));
    const second = container.querySelector('video')!;
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute('src', 'https://media.example/new.mp4');
    expect(second.muted).toBe(false);
    expect(second.volume).toBe(0.4);
    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Retry video' })).not.toBeInTheDocument();
    fireEvent.canPlay(second);
    expect(second).toHaveStyle({ visibility: 'visible' });
    expect(onPlaybackReady).toHaveBeenCalledTimes(1);
    fireEvent.canPlay(first);
    expect(onPlaybackReady).toHaveBeenCalledTimes(1);
    expect(onPlaybackError).toHaveBeenCalledTimes(1);
  });

  it('allows another retry after a repeated failure without enabling autoplay', async () => {
    const user = userEvent.setup({ delay: null });
    const onPlaybackError = vi.fn();
    const { container } = render(<VideoPlayer uri="https://media.example/new.mp4" autoplay={false} onPlaybackError={onPlaybackError} />);
    fireEvent.error(container.querySelector('video')!);
    await user.click(screen.getByRole('button', { name: 'Retry video' }));
    fireEvent.error(container.querySelector('video')!);
    expect(screen.getByRole('button', { name: 'Retry video' })).toBeEnabled();
    expect(onPlaybackError).toHaveBeenCalledTimes(2);
    expect(play).not.toHaveBeenCalled();
  });

  it('recreates failed HLS playback and cleans up the replacement on unmount', async () => {
    const user = userEvent.setup({ delay: null });
    const { container, unmount } = render(<VideoPlayer uri="https://media.example/stream.m3u8" />);
    await waitFor(() => expect(mocks.players).toHaveLength(1));
    act(() => mocks.players[0].emit('error', { fatal: true, type: 'network' }));
    expect(mocks.players[0].destroy).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Retry video' }));
    await waitFor(() => expect(mocks.players).toHaveLength(2));
    expect(mocks.players[1].loadSource).toHaveBeenCalledWith('https://media.example/stream.m3u8');
    fireEvent.canPlay(container.querySelector('video')!);
    expect(container.querySelector('video')).toHaveStyle({ visibility: 'visible' });
    unmount();
    expect(mocks.players[1].destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps processing recovery separate from a failed-playback retry', async () => {
    mocks.getVideoStatus.mockResolvedValue({ status: 'processing', progress: 40 });
    render(<VideoPlayer uri="https://media.example/12345678-1234-1234-1234-123456789abc/playlist.m3u8" />);
    await waitFor(() => expect(mocks.players).toHaveLength(1));
    act(() => mocks.players[0].emit('error', { fatal: true, type: 'network' }));
    expect(await screen.findByText('Processing video…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry video' })).not.toBeInTheDocument();
    expect(mocks.getVideoStatus).toHaveBeenCalledTimes(1);
  });

  it('ignores a late encoding lookup after the source is replaced', async () => {
    let resolveStatus!: (value: unknown) => void;
    mocks.getVideoStatus.mockReturnValue(new Promise((resolve) => { resolveStatus = resolve; }));
    const onPlaybackReady = vi.fn();
    const onPlaybackError = vi.fn();
    const { container, rerender } = render(<VideoPlayer
      uri="https://media.example/12345678-1234-1234-1234-123456789abc/playlist.m3u8"
      onPlaybackReady={onPlaybackReady}
      onPlaybackError={onPlaybackError}
    />);
    await waitFor(() => expect(mocks.players).toHaveLength(1));
    act(() => mocks.players[0].emit('error', { fatal: true, type: 'network' }));
    rerender(<VideoPlayer uri="https://media.example/replacement.mp4" onPlaybackReady={onPlaybackReady} onPlaybackError={onPlaybackError} />);
    const replacement = container.querySelector('video')!;
    fireEvent.canPlay(replacement);
    await act(async () => resolveStatus({ status: 'processing', progress: 40 }));
    expect(replacement).toHaveAttribute('src', 'https://media.example/replacement.mp4');
    expect(replacement).toHaveStyle({ visibility: 'visible' });
    expect(screen.queryByText('Processing video…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry video' })).not.toBeInTheDocument();
    expect(onPlaybackReady).toHaveBeenCalledTimes(1);
    expect(onPlaybackError).not.toHaveBeenCalled();
  });
});
