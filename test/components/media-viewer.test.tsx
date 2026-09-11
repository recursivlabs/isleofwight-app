import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Image as RNImage } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoStatus } from '../../lib/video';
import { MediaViewer } from '../../components/MediaViewer';

const mocks = vi.hoisted(() => ({ getVideoStatus: vi.fn() }));

vi.mock('../../lib/video', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/video')>(),
  getVideoStatus: mocks.getVideoStatus,
}));
vi.mock('../../components/VideoPlayer', () => ({
  VideoPlayer: ({ uri }: { uri: string }) => <video aria-label="Post video" src={uri} />,
}));
vi.mock('../../components/audio/InlineAudioPlayer', () => ({
  InlineAudioPlayer: ({ track }: { track: { id: string; url: string } }) => (
    <audio aria-label="Post audio" data-track-id={track.id} src={track.url} />
  ),
}));

const image = (id: string) => ({
  id,
  url: `https://media.example/${id}.jpg`,
  type: 'image',
  width: 1200,
  height: 800,
});

beforeEach(() => {
  mocks.getVideoStatus.mockReset().mockResolvedValue(null);
});

describe('MediaViewer attachment lifecycle', () => {
  it('can gain and lose media without breaking the mounted post', async () => {
    const { rerender } = render(<MediaViewer media={[]} />);
    expect(screen.queryByRole('button', { name: /Open image/ })).not.toBeInTheDocument();

    rerender(<MediaViewer media={[image('first')]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image: Post image' }));
    expect(screen.getByRole('button', { name: 'Close image viewer' })).toBeInTheDocument();

    rerender(<MediaViewer media={[]} />);
    expect(screen.queryByRole('button', { name: /Open image/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument();

    rerender(<MediaViewer media={[image('second')]} />);
    expect(screen.getByRole('button', { name: 'Open image: Post image' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument();
  });

  it('plays the replacement direct video instead of the previous attachment', () => {
    const { rerender } = render(<MediaViewer media="https://media.example/first.mp4" />);
    expect(screen.getByLabelText('Post video')).toHaveAttribute('src', 'https://media.example/first.mp4');

    rerender(<MediaViewer media="https://media.example/second.mp4" />);
    expect(screen.getByLabelText('Post video')).toHaveAttribute('src', 'https://media.example/second.mp4');
  });

  it('keeps an open gallery on an existing image after attachments are removed', async () => {
    const { rerender } = render(<MediaViewer media={[image('first'), image('second'), image('third')]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open image 3 of 3: Post image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 3 of 3' })).toHaveAttribute('src', image('third').url);

    rerender(<MediaViewer media={[image('first'), image('second')]} />);
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('second').url);
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
  });

  it('replaces a pending Bunny video and ignores its late status result', async () => {
    let resolveStatus!: (status: VideoStatus) => void;
    mocks.getVideoStatus.mockReturnValue(new Promise<VideoStatus>((resolve) => { resolveStatus = resolve; }));
    const bunnyUrl = 'https://media.example/12345678-1234-1234-1234-123456789abc/playlist.m3u8';
    const { rerender } = render(<MediaViewer media={bunnyUrl} />);
    expect(mocks.getVideoStatus).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc');
    expect(screen.queryByLabelText('Post video')).not.toBeInTheDocument();

    rerender(<MediaViewer media="https://media.example/replacement.mp4" />);
    await act(async () => {
      resolveStatus({ status: 'ready', progress: 100, thumbnailUrl: null, hlsUrl: bunnyUrl });
    });

    expect(screen.getByLabelText('Post video')).toHaveAttribute('src', 'https://media.example/replacement.mp4');
  });

  it('uses replacement and updated image dimensions', () => {
    const { rerender } = render(<MediaViewer media={[image('landscape')]} />);
    const frame = () => screen.getByRole('button', { name: 'Open image: Post image' }).querySelector('img')?.parentElement;
    expect(frame()).toHaveStyle({ aspectRatio: '1.5' });

    const portrait = { ...image('portrait'), width: 600, height: 1200 };
    rerender(<MediaViewer media={[portrait]} />);
    expect(frame()).toHaveStyle({ aspectRatio: '0.5' });

    rerender(<MediaViewer media={[{ ...portrait, width: 1200, height: 1200 }]} />);
    expect(frame()).toHaveStyle({ aspectRatio: '1' });
  });

  it('measures a replacement image and ignores the old pending dimensions', async () => {
    const measurements = new Map<string, (width: number, height: number) => void>();
    vi.spyOn(RNImage, 'getSize').mockImplementation((uri, success) => {
      measurements.set(uri, success);
    });
    const first = 'https://media.example/first.jpg';
    const second = 'https://media.example/second.jpg';
    const { rerender } = render(<MediaViewer media={first} />);
    rerender(<MediaViewer media={second} />);

    await act(async () => { measurements.get(second)!(600, 1200); });
    await act(async () => { measurements.get(first)!(1200, 600); });

    const frame = screen.getByRole('button', { name: 'Open image: Post image' }).querySelector('img')?.parentElement;
    expect(frame).toHaveStyle({ aspectRatio: '0.5' });
    expect(RNImage.getSize).toHaveBeenCalledWith(second, expect.any(Function), expect.any(Function));
  });
});

describe('MediaViewer accessibility', () => {
  it('describes an image from the post context and labels the lightbox controls', async () => {
    render(
      <MediaViewer
        media={[image('mount-vernon')]}
        postContext={{
          id: 'post-1',
          authorName: 'Jack',
          text: 'Quick boat ride past Mount Vernon.',
          imageDescription: 'Mount Vernon across the river beneath a cloudy sky.',
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', {
      name: 'Open image: Mount Vernon across the river beneath a cloudy sky.',
    }));

    expect(screen.getByRole('img', {
      name: 'Mount Vernon across the river beneath a cloudy sky.',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close image viewer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post by Jack' })).toBeInTheDocument();
  });

  it('names multi-image positions and disables navigation at each edge', async () => {
    render(
      <MediaViewer
        media={[image('one'), image('two')]}
        postContext={{ text: 'Two photos from the trip.' }}
      />,
    );

    await userEvent.click(screen.getByRole('button', {
      name: 'Open image 1 of 2: Two photos from the trip.',
    }));

    expect(screen.getByRole('img', {
      name: 'Two photos from the trip. Image 1 of 2',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
    const next = screen.getByRole('button', { name: 'Next image' });
    expect(next).toBeEnabled();

    await userEvent.click(next);

    expect(screen.getByRole('img', {
      name: 'Two photos from the trip. Image 2 of 2',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous image' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
  });
});

describe('MediaViewer mixed attachments', () => {
  const audio = { url: 'https://media.example/note.mp3', type: 'audio' };
  const video = { url: 'https://media.example/clip.mp4', type: 'video' };

  it('opens and pages only images while preserving audio and video players', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MediaViewer
      media={[audio, image('one'), video, image('two'), { ...audio, url: 'https://media.example/second.mp3' }]}
      audioMeta={{ id: 'mixed-post' }}
    />);
    expect(screen.getByLabelText('Post video')).toHaveAttribute('src', video.url);
    expect(screen.getAllByLabelText('Post audio').map((node) => node.getAttribute('data-track-id')))
      .toEqual(['mixed-post-0', 'mixed-post-4']);

    await user.click(screen.getByRole('button', { name: 'Open image 1 of 2: Post image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 1 of 2' })).toHaveAttribute('src', image('one').url);
    expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('two').url);
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('img', { name: 'Post image. Image 1 of 2' })).toHaveAttribute('src', image('one').url);
    await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('two').url);
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 1 of 2' })).toHaveAttribute('src', image('one').url);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open image 2 of 2: Post image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('two').url);
  });

  it('has no image navigation for a single photo beside playable attachments', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MediaViewer media={[audio, image('only'), video]} />);
    await user.click(screen.getByRole('button', { name: 'Open image: Post image' }));
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowLeft}{ArrowRight}');
    expect(screen.getByRole('img', { name: 'Post image' })).toHaveAttribute('src', image('only').url);
  });

  it('closes when the last photo becomes a video at the same attachment count', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<MediaViewer media={[image('only')]} />);
    await user.click(screen.getByRole('button', { name: 'Open image: Post image' }));
    rerender(<MediaViewer media={[video]} />);
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Post video')).toHaveAttribute('src', video.url);
    rerender(<MediaViewer media={[image('replacement')]} />);
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument();
  });

  it('keeps the remaining photo selected when other media changes or images shrink', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<MediaViewer media={[image('one'), audio, image('two'), video]} />);
    await user.click(screen.getAllByRole('button', { name: /Open image/ })[1]);
    rerender(<MediaViewer media={[image('one'), image('two')]} />);
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('two').url);
    rerender(<MediaViewer media={[audio, image('one')]} />);
    expect(screen.getByRole('img', { name: 'Post image' })).toHaveAttribute('src', image('one').url);
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument();
  });

  it('retains the thumbnail fallback and counts deduplicated photos', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<MediaViewer media={null} thumbnail={image('fallback').url} />);
    await user.click(screen.getByRole('button', { name: 'Open image: Post image' }));
    expect(screen.getByRole('img', { name: 'Post image' })).toHaveAttribute('src', image('fallback').url);
    await user.keyboard('{Escape}');
    rerender(<MediaViewer media={[video, image('one'), { ...image('one'), url: `${image('one').url}?cache=2` }, image('two')]} />);
    expect(screen.getAllByRole('button', { name: /Open image/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Open image 2 of 2: Post image' }));
    expect(screen.getByRole('img', { name: 'Post image. Image 2 of 2' })).toHaveAttribute('src', image('two').url);
  });
});
