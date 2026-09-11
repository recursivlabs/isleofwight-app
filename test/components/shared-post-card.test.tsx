import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  push: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('expo-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../lib/auth', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../lib/discover', () => ({ postThumb: () => ({ url: null }) }));
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#8a6d1f',
    borderSubtle: '#ddd',
    glass: '#eee',
    surface: '#fff',
    surfaceHover: '#eee',
    text: '#111',
    textInverse: '#fff',
    textMuted: '#666',
    textSecondary: '#444',
  }),
}));
vi.mock('../../components/Avatar', () => ({ Avatar: () => null }));

import { SharedPostCard } from '../../components/SharedPostCard';

describe('SharedPostCard loading failures', () => {
  beforeEach(() => {
    mocks.getPost.mockReset();
    mocks.push.mockReset();
    mocks.useAuth.mockReturnValue({
      sdk: { posts: { get: mocks.getPost } },
    });
  });

  it('shows an honest failure and recovers through an in-place retry', async () => {
    mocks.getPost
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          content: 'Recovered shared post',
          author: { id: 'author-1', name: 'Alice' },
        },
      });

    render(<SharedPostCard postId="post-1" />);

    expect(await screen.findByText('Post preview unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Loading post…')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry post preview' }));

    expect(await screen.findByText('Recovered shared post')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getPost).toHaveBeenCalledTimes(2));
  });

  it('keeps the original post reachable while its preview is unavailable', async () => {
    mocks.getPost.mockResolvedValueOnce({ data: null });

    render(<SharedPostCard postId="post-2" />);

    expect(await screen.findByText('Post preview unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Open shared post' }));

    expect(mocks.push).toHaveBeenCalledWith('/post/post-2');
  });
});
