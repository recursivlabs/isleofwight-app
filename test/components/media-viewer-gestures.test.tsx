import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type PanEvent = {
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
};
type TestPan = {
  change?: (event: PanEvent) => void;
  end?: (event: PanEvent) => void;
  onChange: (callback: (event: PanEvent) => void) => TestPan;
  onEnd: (callback: (event: PanEvent) => void) => TestPan;
};

const mocks = vi.hoisted(() => ({ activePan: null as TestPan | null }));

// Retain only this viewer's real Pan callbacks. This exercises its paging
// decisions, not native gesture recognition, timing, or device integration.
vi.mock('react-native-gesture-handler', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-native-gesture-handler')>(),
  Gesture: {
    Pan: (): TestPan => {
      const pan: TestPan = {
        onChange(callback) { pan.change = callback; return pan; },
        onEnd(callback) { pan.end = callback; return pan; },
      };
      return pan;
    },
  },
  GestureDetector: ({ gesture, children }: { gesture: TestPan; children: ReactNode }) => {
    mocks.activePan = gesture;
    return <>{children}</>;
  },
}));
vi.mock('../../components/VideoPlayer', () => ({
  VideoPlayer: ({ uri }: { uri: string }) => <video aria-label="Post video" src={uri} />,
}));
vi.mock('../../components/audio/InlineAudioPlayer', () => ({
  InlineAudioPlayer: ({ track }: { track: { url: string } }) => <audio aria-label="Post audio" src={track.url} />,
}));

import { MediaViewer } from '../../components/MediaViewer';

const image = (id: string) => ({
  url: `https://media.example/${id}.jpg`, type: 'image', width: 1200, height: 800,
});
const audio = (id: string) => ({ url: `https://media.example/${id}.mp3`, type: 'audio' });
const video = { url: 'https://media.example/clip.mp4', type: 'video' };
const displayedImage = () => screen.getByRole('img', { name: /^Post image(?:\.|$)/ });

function swipe(direction: 'next' | 'previous') {
  const pan = mocks.activePan;
  if (!pan?.change || !pan.end) throw new Error('Expected the visible image viewer Pan callbacks');
  const event = {
    translationX: direction === 'next' ? -100 : 100,
    translationY: 0,
    velocityX: 0,
    velocityY: 0,
  };
  act(() => {
    pan.change!(event);
    pan.end!(event);
  });
}

beforeEach(() => {
  mocks.activePan = null;
});

describe('MediaViewer image-only swipe paging', () => {
  it('skips interleaved audio and video and clamps at both image edges', async () => {
    render(<MediaViewer media={[audio('before'), image('one'), video, image('two'), audio('after')]} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Open image/ })[0]);
    expect(displayedImage()).toHaveAttribute('src', image('one').url);

    swipe('next');
    expect(displayedImage()).toHaveAttribute('src', image('two').url);
    swipe('next');
    expect(displayedImage()).toHaveAttribute('src', image('two').url);

    swipe('previous');
    expect(displayedImage()).toHaveAttribute('src', image('one').url);
    swipe('previous');
    expect(displayedImage()).toHaveAttribute('src', image('one').url);
    expect(screen.getByRole('button', { name: 'Close image viewer' })).toBeInTheDocument();
  });

  it('keeps a single image selected when swiping beside audio and video attachments', async () => {
    render(<MediaViewer media={[audio('before'), image('only'), video]} />);
    await userEvent.click(screen.getByRole('button', { name: /^Open image/ }));
    expect(displayedImage()).toHaveAttribute('src', image('only').url);

    swipe('next');
    expect(displayedImage()).toHaveAttribute('src', image('only').url);
    swipe('previous');
    expect(displayedImage()).toHaveAttribute('src', image('only').url);
    expect(screen.getByRole('button', { name: 'Close image viewer' })).toBeInTheDocument();
  });
});
