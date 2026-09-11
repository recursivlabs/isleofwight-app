// Composer (app/(tabs)/create): input rendering, character-limit handling,
// and the submit gate. Network mocked at the SDK boundary (sdk.posts.create).
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => {
  const sdk = {
    posts: { create: vi.fn(async () => ({ data: { id: 'new-post' } })) },
  };
  return {
    sdk,
    showToast: vi.fn(),
    value: {
      sdk,
      user: { id: 'viewer-1', username: 'viewer', name: 'Viewer', image: null },
    },
  };
});
vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock.value,
}));
vi.mock('../../components/Toast', () => ({ showToast: authMock.showToast }));

vi.mock('../../lib/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/hooks')>();
  return {
    ...actual,
    useCommunities: () => ({
      communities: [
        {
          id: 'community-1',
          name: 'Minds Builders',
          description: 'People building Minds',
        },
      ],
      loading: false,
    }),
  };
});

import CreateScreen from '../../app/(tabs)/create';
import { clearDraft, saveDraftConfirmed } from '../../lib/drafts';

const composerInput = () => screen.getByPlaceholderText("What's happening?");
const postButton = () => screen.getByText('Post');

describe('composer', () => {
  beforeEach(() => {
    authMock.sdk.posts.create.mockReset().mockResolvedValue({ data: { id: 'new-post' } });
  });

  it('names primary controls and exposes toggle state without submitting', async () => {
    render(<CreateScreen />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Switch to article editor' })).toBeInTheDocument();

    const audience = screen.getByRole('button', { name: 'Post audience: Global' });
    const media = screen.getByRole('button', { name: 'Add media' });
    const tags = screen.getByRole('button', { name: 'Add tags' });
    const nsfw = screen.getByRole('switch', { name: 'Mark post as NSFW' });
    expect(audience).toHaveAttribute('aria-expanded', 'false');
    expect(media).toHaveAttribute('aria-expanded', 'false');
    expect(tags).toHaveAttribute('aria-expanded', 'false');
    expect(nsfw).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(audience);
    expect(screen.getByRole('dialog', { name: 'Choose post audience' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Post audience options' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Global' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Minds Builders' })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByRole('radio', { name: 'Minds Builders' }));
    expect(screen.getByRole('button', { name: 'Post audience: Minds Builders' }))
      .toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(nsfw);
    expect(screen.getByRole('switch', { name: 'Mark post as NSFW' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('exposes media attachment choices as named controls', async () => {
    render(<CreateScreen />);

    const media = screen.getByRole('button', { name: 'Add media' });
    await userEvent.click(media);

    expect(media).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Media attachment options' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add photo' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add video' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add audio' })).toBeInTheDocument();
  });

  it('reports a photo picker failure instead of silently closing the menu', async () => {
    render(<CreateScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add media' }));
    const createElement = vi.spyOn(document, 'createElement')
      .mockImplementationOnce(() => { throw new Error('photo picker unavailable'); });

    try {
      await userEvent.click(screen.getByRole('menuitem', { name: 'Add photo' }));
    } finally {
      createElement.mockRestore();
    }

    expect(screen.getByText('Could not open your photo library. Try again.')).toBeInTheDocument();
  });

  it('reports an audio picker failure instead of silently closing the menu', async () => {
    render(<CreateScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add media' }));
    const createElement = vi.spyOn(document, 'createElement')
      .mockImplementationOnce(() => { throw new Error('audio picker unavailable'); });

    try {
      await userEvent.click(screen.getByRole('menuitem', { name: 'Add audio' }));
    } finally {
      createElement.mockRestore();
    }

    expect(screen.getByText('Could not open your audio files. Try again.')).toBeInTheDocument();
  });

  it('reports a group picture picker failure instead of leaving creation stuck', async () => {
    __setLocalSearchParams({ mode: 'community' });
    render(<CreateScreen />);
    const createElement = vi.spyOn(document, 'createElement')
      .mockImplementationOnce(() => { throw new Error('picture picker unavailable'); });

    try {
      await userEvent.click(screen.getByRole('button', { name: 'Add group picture' }));
    } finally {
      createElement.mockRestore();
    }

    expect(screen.getByText('Could not open your image library. Try again.')).toBeInTheDocument();
  });

  it('renders the post input and the Post button', () => {
    render(<CreateScreen />);
    expect(composerInput()).toBeInTheDocument();
    expect(postButton()).toBeInTheDocument();
  });

  it('does not submit an empty post', async () => {
    render(<CreateScreen />);
    await userEvent.click(postButton());
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('whitespace-only content still cannot be submitted', async () => {
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: '   ' } });
    await userEvent.click(postButton());
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('submits typed content through the SDK and returns to the feed', async () => {
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: 'Hello from the composer' } });
    await userEvent.click(postButton());
    await waitFor(() =>
      expect(authMock.sdk.posts.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Hello from the composer' }),
      ),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(tabs)', params: expect.objectContaining({ tab: 'following' }) }),
      ),
    );
  });

  it('admits only one post when Enter is repeated while submission is pending', async () => {
    let resolvePost!: (value: { data: { id: string } }) => void;
    const pendingPost = new Promise<{ data: { id: string } }>((resolve) => { resolvePost = resolve; });
    authMock.sdk.posts.create.mockReturnValue(pendingPost);
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: 'Publish this once' } });

    try {
      act(() => {
        fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' });
      });
      expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
      fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' });
      expect(authMock.sdk.posts.create).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => { resolvePost({ data: { id: 'new-post' } }); });
    }
  });

  it('keeps the draft after a failed keyboard submission and allows a retry', async () => {
    authMock.sdk.posts.create.mockRejectedValueOnce(new Error('Temporary posting failure'));
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: 'Keep this for retry' } });
    fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Temporary posting failure')).toBeInTheDocument();
    expect(composerInput()).toHaveValue('Keep this for retry');
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(authMock.sdk.posts.create).toHaveBeenCalledTimes(2));
    expect(authMock.sdk.posts.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: 'Keep this for retry' }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['over-limit', 'x'.repeat(5001)],
  ])('does not let Enter submit %s content when Post is disabled', async (_label, content) => {
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: content } });
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();

    await act(async () => { fireEvent.keyDown(composerInput(), { key: 'Enter', code: 'Enter' }); });
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('warns after publishing when the old durable draft cannot be removed', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    try {
      render(<CreateScreen />);
      fireEvent.change(composerInput(), { target: { value: 'Published only once' } });
      await userEvent.click(postButton());

      await waitFor(() => expect(authMock.showToast).toHaveBeenCalledWith(
        'Posted, but the old draft could not be cleared and may reappear after restart.',
        'error',
      ));
      expect(authMock.sdk.posts.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Published only once' }),
      );
      expect(router.replace).toHaveBeenCalled();
    } finally {
      removeItem.mockRestore();
      clearDraft();
    }
  });

  it('keeps a manually emptied draft retryable when device storage refuses the discard', async () => {
    await saveDraftConfirmed('Restore, then discard me');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.mocked(router.back).mockClear();

    try {
      render(<CreateScreen />);
      await waitFor(() => expect(composerInput()).toHaveValue('Restore, then discard me'));

      fireEvent.change(composerInput(), { target: { value: '' } });
      await waitFor(() => expect(authMock.showToast).toHaveBeenCalledWith(
        'Draft not discarded. Try Cancel again.',
        'error',
      ));

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(await screen.findByText('Draft not discarded. Try again.')).toBeInTheDocument();
      expect(router.back).not.toHaveBeenCalled();
    } finally {
      removeItem.mockRestore();
      clearDraft();
    }
  });

  it('shows the remaining-characters counter as the 5000 limit approaches', () => {
    render(<CreateScreen />);
    // 4990 chars → 10 remaining; the counter only appears inside the final 240.
    fireEvent.change(composerInput(), { target: { value: 'x'.repeat(4990) } });
    // Both the header counter and the bottom meter show the remaining count.
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
  });

  it('blocks submit when the content is over the limit', async () => {
    render(<CreateScreen />);
    fireEvent.change(composerInput(), { target: { value: 'x'.repeat(5001) } });
    expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1);
    await userEvent.click(postButton());
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('does not claim a draft is saved when device storage rejects it, and retries', async () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => { throw new Error('storage full'); });

    try {
      render(<CreateScreen />);
      fireEvent.change(composerInput(), { target: { value: 'Do not lose this draft' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(1200); });

      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry saving draft' })).toBeInTheDocument();

      setItem.mockRestore();
      fireEvent.click(screen.getByRole('button', { name: 'Retry saving draft' }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByText('Saved')).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
      vi.useRealTimers();
      clearDraft();
    }
  });

  it('stays in the composer when the close-time draft save fails', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => { throw new Error('storage full'); });
    vi.mocked(router.back).mockClear();

    try {
      render(<CreateScreen />);
      fireEvent.change(composerInput(), { target: { value: 'Keep this before leaving' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByRole('button', { name: 'Retry saving draft' })).toBeInTheDocument();
      expect(router.back).not.toHaveBeenCalled();
      expect(composerInput()).toHaveValue('Keep this before leaving');
    } finally {
      setItem.mockRestore();
      clearDraft();
    }
  });
});
