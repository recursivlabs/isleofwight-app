import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const playerMock = vi.hoisted(() => ({ autoReady: true }));

const colors = {
  bg: '#010100',
  borderSubtle: '#222222',
  error: '#f87171',
  errorMuted: '#301818',
  glass: '#181818',
  glassBorder: '#333333',
  text: '#ffffff',
  textMuted: '#888888',
  textSecondary: '#bbbbbb',
};

vi.mock('../../lib/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/theme')>();
  return {
    ...actual,
    useColors: () => colors,
  };
});

vi.mock('../../components/VideoPlayer', () => ({
  VideoPlayer: ({
    uri,
    accessibilityLabel,
    onPlaybackReady,
    onPlaybackError,
  }: {
    uri: string;
    accessibilityLabel?: string;
    onPlaybackReady?: () => void;
    onPlaybackError?: () => void;
  }) => {
    React.useEffect(() => {
      if (playerMock.autoReady) onPlaybackReady?.();
    }, [onPlaybackReady]);
    return (
      <button
        type="button"
        aria-label={accessibilityLabel}
        data-testid="live-player"
        data-uri={uri}
        onClick={onPlaybackError}
      />
    );
  },
}));

import LiveScreen from '../../app/live';

describe('Live screen', () => {
  beforeEach(() => {
    playerMock.autoReady = true;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        type: 'live',
        meta: { tracks: { stage: { type: 'video', codec: 'H264' } } },
      }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the live spectator experience inside Minds', async () => {
    render(<LiveScreen />);

    await waitFor(() => expect(screen.getByText('LIVE NOW')).toBeInTheDocument());
    expect(screen.getByTestId('live-player')).toHaveAttribute(
      'data-uri',
      'https://streams.battlechat.live/cmaf/battle/index.m3u8',
    );
    expect(screen.getByRole('button', { name: 'Minds Live stream' })).toBeInTheDocument();
    expect(screen.getByText(/without leaving Minds/i)).toBeInTheDocument();
    expect(screen.getByText(/intended for adults/i)).toBeInTheDocument();
    expect(screen.queryByText(/Battlechat/i)).not.toBeInTheDocument();
  });

  it('replaces a failed live player with a clear retry state', async () => {
    playerMock.autoReady = false;
    render(<LiveScreen />);

    const player = await screen.findByTestId('live-player');
    fireEvent.click(player);

    expect(await screen.findByText('STREAM UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('The live stream couldn’t start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry live stream' })).toBeInTheDocument();
  });
});
