import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngineHandlers, AudioTrack } from '../../lib/audio/types';

const media = vi.hoisted(() => ({
  handlers: {} as AudioEngineHandlers,
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  rate: vi.fn(),
  stop: vi.fn(),
}));

// Keep react-native-web, the provider, controls, and modal real. Only the
// playback engine is controlled; no audio URL or native module is opened.
vi.mock('../../lib/audio/engine', () => ({
  audioEngineAvailable: true,
  default: {
    load: media.load,
    play: media.play,
    pause: media.pause,
    seekTo: media.seek,
    setRate: media.rate,
    stop: media.stop,
    setNowPlaying: vi.fn(),
    setHandlers: (handlers: AudioEngineHandlers) => { media.handlers = handlers; },
    setRemoteHandlers: vi.fn(),
  },
}));

import { AudioPlayerProvider } from '../../lib/audioPlayer';
import { InlineAudioPlayer } from '../../components/audio/InlineAudioPlayer';
import { AudioMiniPlayer } from '../../components/audio/AudioMiniPlayer';
import { Scrubber } from '../../components/audio/Scrubber';

const track: AudioTrack = {
  id: 'accessible-audio', title: 'Audio A', url: 'https://media.example/audio-a.m4a', duration: 120,
};

function renderPlayer(mini = false) {
  return render(<AudioPlayerProvider>
    <InlineAudioPlayer track={track} />
    {mini && <AudioMiniPlayer />}
  </AudioPlayerProvider>);
}

function finishModalAnimation() {
  // RNW activates/dismisses its real modal on CSS animationend, which jsdom
  // does not generate. Its animation host wraps the focus-trap/content pair.
  const content = document.querySelector('[aria-modal="true"]');
  const animation = content?.parentElement?.parentElement;
  if (!animation) throw new Error('Expected the rendered audio modal animation');
  fireEvent.animationEnd(animation);
}

beforeEach(() => {
  media.handlers = {};
  media.load.mockReset().mockResolvedValue(undefined);
  media.play.mockReset().mockImplementation(async () => {
    await Promise.resolve();
    media.handlers.onState?.(true);
    media.handlers.onLoading?.(false);
  });
  media.pause.mockReset().mockImplementation(async () => {
    await Promise.resolve();
    media.handlers.onState?.(false);
  });
  media.seek.mockReset().mockResolvedValue(undefined);
  media.rate.mockReset().mockResolvedValue(undefined);
  media.stop.mockReset().mockResolvedValue(undefined);
});

describe('audio controls through real react-native-web keyboard behavior', () => {
  it('tabs to named Play, activates with Space, and pauses with Enter without reloading', async () => {
    const user = userEvent.setup({ delay: null });
    renderPlayer();
    const play = screen.getByRole('button', { name: 'Play Audio A' });
    await user.tab();
    expect(play).toHaveFocus();

    await user.keyboard(' ');

    expect(await screen.findByRole('button', { name: 'Pause Audio A' })).toHaveFocus();
    expect(media.load).toHaveBeenCalledOnce();
    expect(media.load).toHaveBeenCalledWith(track);
    expect(media.play).toHaveBeenCalledOnce();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'Play Audio A' })).toHaveFocus();
    expect(media.pause).toHaveBeenCalledOnce();
    await user.keyboard(' ');
    await screen.findByRole('button', { name: 'Pause Audio A' });
    expect(media.load).toHaveBeenCalledOnce();
    expect(media.play).toHaveBeenCalledTimes(2);
  });

  it('opens fullscreen from the mini-player and operates named transport and dismiss controls', async () => {
    const user = userEvent.setup({ delay: null });
    renderPlayer(true);
    await user.click(screen.getByRole('button', { name: 'Play Audio A' }));
    await screen.findAllByRole('button', { name: 'Pause Audio A' });
    const open = screen.getAllByRole('button', { name: 'Open audio player for Audio A' })[0];
    open.focus();
    await user.keyboard('{Enter}');
    finishModalAnimation();
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Previous track' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Next track' })).toBeDisabled();

    dialog.getByRole('button', { name: 'Forward 15 seconds' }).focus();
    await user.keyboard(' ');
    expect(media.seek).toHaveBeenLastCalledWith(15);
    dialog.getByRole('button', { name: 'Rewind 15 seconds' }).focus();
    await user.keyboard('{Enter}');
    expect(media.seek).toHaveBeenLastCalledWith(0);
    dialog.getByRole('button', { name: 'Playback speed, 1x' }).focus();
    await user.keyboard(' ');
    expect(media.rate).toHaveBeenCalledWith(1.25);
    expect(dialog.getByRole('button', { name: 'Playback speed, 1.25x' })).toBeInTheDocument();

    dialog.getByRole('button', { name: 'Minimize audio player' }).focus();
    await user.keyboard(' ');
    finishModalAnimation();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(media.stop).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Close audio player' }).focus();
    await user.keyboard('{Enter}');
    expect(media.stop).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Close audio player' })).not.toBeInTheDocument();
  });

  it('adds tracks and activates mini-player Next and fullscreen Up Next with the keyboard', async () => {
    const user = userEvent.setup({ delay: null });
    const second = { ...track, id: 'audio-b', title: 'Audio B', url: 'https://media.example/b.m4a' };
    const third = { ...track, id: 'audio-c', title: 'Audio C', url: 'https://media.example/c.m4a' };
    render(<AudioPlayerProvider>
      {[track, second, third].map(item => <InlineAudioPlayer key={item.id} track={item} />)}
      <AudioMiniPlayer />
    </AudioPlayerProvider>);
    await user.click(screen.getByRole('button', { name: 'Play Audio A' }));
    await screen.findAllByRole('button', { name: 'Pause Audio A' });
    screen.getByRole('button', { name: 'Add Audio B to queue' }).focus();
    await user.keyboard(' ');
    screen.getByRole('button', { name: 'Add Audio C to queue' }).focus();
    await user.keyboard('{Enter}');
    expect(media.load).toHaveBeenCalledOnce();

    screen.getByRole('button', { name: 'Next track' }).focus();
    await user.keyboard(' ');
    await screen.findAllByRole('button', { name: 'Pause Audio B' });
    expect(media.load).toHaveBeenLastCalledWith(second);
    screen.getByRole('button', { name: 'Open audio player for Audio B' }).focus();
    await user.keyboard('{Enter}');
    finishModalAnimation();
    const dialog = within(screen.getByRole('dialog'));
    dialog.getByRole('button', { name: 'Play Audio C next' }).focus();
    await user.keyboard(' ');
    expect(media.load).toHaveBeenCalledTimes(3);
    expect(media.load).toHaveBeenLastCalledWith(third);
    expect(await dialog.findByRole('button', { name: 'Pause Audio C' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Next track' })).toBeDisabled();
  });

  it('exposes actual slider values and seeks with Arrow keys, Home and End', async () => {
    const user = userEvent.setup({ delay: null });
    const seek = vi.fn();
    function PlayerPosition() {
      const [position, setPosition] = React.useState(30);
      return <Scrubber position={position} duration={120} onSeek={(next) => {
        seek(next);
        setPosition(next);
      }} />;
    }
    render(<PlayerPosition />);
    const slider = screen.getByRole('slider', { name: 'Audio position' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '120');
    expect(slider).toHaveAttribute('aria-valuenow', '30');
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/\S/));
    await user.tab();
    expect(slider).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(seek).toHaveBeenLastCalledWith(35);
    expect(slider).toHaveAttribute('aria-valuenow', '35');
    await user.keyboard('{ArrowLeft}');
    expect(seek).toHaveBeenLastCalledWith(30);
    await user.keyboard('{ArrowRight>3/}');
    expect(seek).toHaveBeenLastCalledWith(45);
    await user.keyboard('{End}{ArrowRight}');
    expect(seek).toHaveBeenLastCalledWith(120);
    expect(slider).toHaveAttribute('aria-valuenow', '120');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(seek).toHaveBeenLastCalledWith(0);
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it.each([0, Number.POSITIVE_INFINITY])('does not offer keyboard seeking with unavailable duration %s', async (duration) => {
    const user = userEvent.setup({ delay: null });
    const seek = vi.fn();
    render(<Scrubber position={30} duration={duration} onSeek={seek} />);
    const slider = screen.getByRole('slider', { name: 'Audio position' });
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    await user.tab();
    expect(slider).not.toHaveFocus();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'End' });
    expect(seek).not.toHaveBeenCalled();
  });
});
