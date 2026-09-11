// PostCard render + interaction behavior, including the sanitization path the
// markdown XSS corpus only covers at the string level: here the HTML actually
// lands in the DOM, so a regression executes (and fails) instead of hiding.
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';

// The mocked auth value must be REFERENTIALLY STABLE: the real useAuth memoizes
// it, and children (e.g. SharePostSheet) put `sdk` in effect dependency arrays.
// A fresh object per call re-fires those effects on every render, forever.
const authMock = vi.hoisted(() => {
  const sdk = {
    posts: {
      react: vi.fn(async () => ({})),
      unreact: vi.fn(async () => ({})),
    },
    reports: {
      create: vi.fn(async () => ({ data: { success: true } })),
    },
  };
  return {
    sdk,
    value: {
      sdk,
      user: { id: 'viewer-1', username: 'viewer', name: 'Viewer' },
    } as { sdk: typeof sdk | null; user: { id: string; username: string; name: string } | null },
  };
});
const sdkMock = authMock.sdk.posts;
const reportsMock = authMock.sdk.reports;

const shareSheetMock = vi.hoisted(() => vi.fn(() => null));
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock.value,
}));

vi.mock('../../components/SharePostSheet', () => ({
  SharePostSheet: shareSheetMock,
}));
vi.mock('../../components/Toast', () => ({
  useToast: () => ({ show: toastMock }),
  showToast: toastMock,
}));

import { PostCard } from '../../components/PostCard';

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3_600_000).toISOString();

function makePost(over: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    content: 'Hello from the feed',
    author: { id: 'author-1', name: 'Sarah Connor', username: 'sarah', image: null },
    created_at: TWO_HOURS_AGO,
    score: 42,
    userReaction: null,
    reply_count: 7,
    ...over,
  };
}

const upvoteButton = () => {
  return screen.getByRole('button', { name: /^(?:Remove )?upvote, score /i });
};

describe('PostCard', () => {
  beforeEach(() => {
    authMock.value.sdk = authMock.sdk;
    authMock.value.user = { id: 'viewer-1', username: 'viewer', name: 'Viewer' };
    shareSheetMock.mockClear();
    toastMock.mockClear();
  });

  it('mounts the conversation-backed share sheet only after Share is opened', async () => {
    render(<PostCard post={makePost()} />);

    expect(shareSheetMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Share post' }));
    expect(shareSheetMock).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, post: expect.objectContaining({ id: 'post-1' }) }),
      undefined,
    );
  });

  it('renders the author name, handle, and content', () => {
    render(<PostCard post={makePost()} />);
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('@sarah')).toBeInTheDocument();
    expect(screen.getByText('Hello from the feed')).toBeInTheDocument();
  });

  it.each(['content', 'body'])('renders refreshed %s for the same post', (field) => {
    const post = makePost({ content: undefined, [field]: 'Cached body' });
    const view = render(<PostCard post={post} />);
    expect(screen.getByText('Cached body')).toBeInTheDocument();

    view.rerender(<PostCard post={{ ...post, [field]: 'Refreshed body' }} />);

    expect(screen.getByText('Refreshed body')).toBeInTheDocument();
    expect(screen.queryByText('Cached body')).not.toBeInTheDocument();
  });

  it('preserves an open edit draft when server content refreshes', async () => {
    const post = makePost({ author: authMock.value.user });
    const view = render(<PostCard post={post} />);
    await userEvent.click(screen.getByRole('button', { name: 'More post actions' }));
    await userEvent.click(screen.getByText('Edit', { exact: true }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My unsaved edit' } });

    view.rerender(<PostCard post={{ ...post, content: 'New server content' }} />);

    expect(screen.getByRole('textbox')).toHaveValue('My unsaved edit');
    await userEvent.click(screen.getByText('Cancel', { exact: true }));
    expect(screen.getByText('New server content')).toBeInTheDocument();
  });

  it('renders an identical title and body only once', () => {
    const caption = 'Pupper says no, I stay here';
    render(<PostCard post={makePost({ title: caption.toUpperCase(), content: `${caption}\n\n` })} />);

    expect(screen.getAllByText(/Pupper says no, I stay here/i)).toHaveLength(1);
  });

  it('compares the title with the visible body after removing a preview URL line', () => {
    const caption = 'Launch update';
    const url = 'https://example.com/launch';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<PostCard post={makePost({ title: caption, content: `${caption}\n${url}` })} />);

    expect(screen.getAllByText(caption)).toHaveLength(1);
  });

  it('preserves a title that is distinct from the body', () => {
    render(<PostCard post={makePost({ title: 'Pool day', content: 'Pupper says no, I stay here' })} />);

    expect(screen.getByText('Pool day')).toBeInTheDocument();
    expect(screen.getByText('Pupper says no, I stay here')).toBeInTheDocument();
  });

  it('preserves a title when the body is empty', () => {
    render(<PostCard post={makePost({ title: 'Photo from the park', content: '' })} />);

    expect(screen.getByText('Photo from the park')).toBeInTheDocument();
  });

  it('exposes truncated post expansion as a named button', async () => {
    const longContent = `${'A long post needs enough preview text to truncate. '.repeat(8)}Final disclosure.`;
    render(<PostCard post={makePost({ content: longContent })} compact />);

    const expand = screen.getByRole('button', { name: 'Show full post' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Final disclosure/)).not.toBeInTheDocument();

    await userEvent.click(expand);

    expect(screen.queryByRole('button', { name: 'Show full post' })).not.toBeInTheDocument();
    expect(screen.getByText(/Final disclosure/)).toBeInTheDocument();
  });

  it('exposes the author avatar and byline as named profile links', async () => {
    render(<PostCard post={makePost()} />);

    const profileLinks = screen.getAllByRole('link', { name: 'View profile for Sarah Connor' });
    expect(profileLinks).toHaveLength(2);
    expect(profileLinks[0]).toHaveAttribute('href', '/sarah');
    expect(profileLinks[1]).toHaveAttribute('href', '/sarah');

    await userEvent.click(profileLinks[0]);
    expect(router.push).toHaveBeenCalledWith('/sarah');
  });

  it('names source and agent attribution links separately', () => {
    render(<PostCard post={makePost({
      external_url: 'https://agentsource.test/report',
      author: {
        id: 'agent-1',
        name: 'Sarah Agent',
        username: 'sarah-agent',
        isAi: true,
      },
    })} />);

    const sourceLinks = screen.getAllByRole('link', { name: 'Open source Agentsource' });
    expect(sourceLinks).toHaveLength(2);
    expect(sourceLinks[0]).toHaveAttribute('href', 'https://agentsource.test/report');
    expect(screen.getByRole('link', { name: 'View profile for Sarah Agent' })).toBeInTheDocument();
  });

  it('renders a compact relative timestamp for a recent post', () => {
    render(<PostCard post={makePost()} />);
    expect(screen.getByText('· 2h')).toBeInTheDocument();
  });

  it('removes the card container from the focus order and names the timestamp link', async () => {
    const { container } = render(<PostCard post={makePost()} />);

    expect(container.firstElementChild).toHaveAttribute('tabindex', '-1');
    const permalink = screen.getByRole('link', { name: 'Open post by Sarah Connor, 2h' });
    expect(permalink).toHaveAttribute('href', '/post/post-1');
    await userEvent.click(permalink);

    expect(router.push).toHaveBeenCalledWith('/post/post-1');
  });

  it('renders the vote score and reply count', () => {
    render(<PostCard post={makePost({ score: 1234, reply_count: undefined, repliesCount: 56 })} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
  });

  it('gives every post action a descriptive button name', () => {
    render(<PostCard post={makePost({ score: 42, reply_count: 7, repost_count: 3 })} />);

    expect(screen.getByRole('button', { name: 'Upvote, score 42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downvote, score 42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply to post, 7 replies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repost options, 3 reposts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bookmark post' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share post' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More post actions' })).toBeInTheDocument();
  });

  it('reports bookmark changes so a saved-posts list can update immediately', async () => {
    const onBookmarkChange = vi.fn();
    render(<PostCard post={makePost({ id: 'bookmark-callback-post' })} onBookmarkChange={onBookmarkChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Bookmark post' }));

    expect(onBookmarkChange).toHaveBeenCalledWith('bookmark-callback-post', true);
  });

  it('keeps a failed bookmark unsaved and reports the retryable error', async () => {
    const onBookmarkChange = vi.fn();
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'minds:bookmarks') throw new DOMException('QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    try {
      render(<PostCard post={makePost({ id: 'bookmark-storage-failure' })} onBookmarkChange={onBookmarkChange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Bookmark post' }));

      await waitFor(() => expect(toastMock).toHaveBeenCalledWith(
        'Could not update saved posts. Try again.',
        'error',
      ));
      expect(screen.getByRole('button', { name: 'Bookmark post' })).toHaveAttribute('aria-pressed', 'false');
      expect(onBookmarkChange).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('opens post detail when Reply has no screen-specific action', async () => {
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reply to post, 7 replies' }));

    expect(router.push).toHaveBeenCalledWith('/post/post-1');
  });

  it('delegates Reply to a screen-specific action with the engagement target', async () => {
    const onReply = vi.fn();
    render(<PostCard post={makePost()} onReply={onReply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reply to post, 7 replies' }));

    expect(onReply).toHaveBeenCalledWith('post-1');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('uses the existing AI caption to describe attached post media', () => {
    render(<PostCard post={makePost({
      aiCaption: 'Mount Vernon across the river beneath a cloudy sky.',
      media: [{
        id: 'media-1',
        url: 'https://media.example/mount-vernon.jpg',
        type: 'image',
        width: 1200,
        height: 800,
      }],
    })} />);

    expect(screen.getByRole('button', {
      name: 'Open image: Mount Vernon across the river beneath a cloudy sky.',
    })).toBeInTheDocument();
  });

  it('announces an optimistic upvote as selected with the updated score', async () => {
    render(<PostCard post={makePost({ score: 42 })} />);

    const upvote = screen.getByRole('button', { name: 'Upvote, score 42' });
    expect(upvote).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(upvote);

    const selected = await screen.findByRole('button', { name: 'Remove upvote, score 43' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });

  it('upvote calls the SDK and bumps the score optimistically', async () => {
    render(<PostCard post={makePost()} />);
    await userEvent.click(upvoteButton());
    expect(await screen.findByText('43')).toBeInTheDocument();
    await waitFor(() => expect(sdkMock.react).toHaveBeenCalledWith('post-1', 'upvote'));
  });

  it('a failed vote reverts the optimistic score', async () => {
    sdkMock.react.mockRejectedValueOnce(new Error('network down'));
    render(<PostCard post={makePost()} />);
    await userEvent.click(upvoteButton());
    // Optimistic bump first, then the rejection rolls it back.
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.queryByText('43')).not.toBeInTheDocument();
  });

  it.each([
    ['Upvote', 'upvote'],
    ['Downvote', 'downvote'],
  ] as const)('takes a signed-out %s through OTP without losing the reaction intent', async (label, reaction) => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: `${label}, score 42` }));

    expect(router.push).toHaveBeenCalledWith(
      `/auth/sign-in?auth=otp&returnTo=%2Fpost%2Fpost-1%3Freaction%3D${reaction}`,
    );
    expect(sdkMock.react).not.toHaveBeenCalled();
  });

  it('lets a signed-out viewer choose Remind before starting OTP', async () => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    render(<PostCard post={makePost({ repost_count: 3 })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Repost options, 3 reposts' }));

    expect(await screen.findByText('Remind')).toBeInTheDocument();
    expect(screen.getByText('Quote Post')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Remind'));
    expect(router.push).toHaveBeenCalledWith(
      '/auth/sign-in?auth=otp&returnTo=%2Fpost%2Fpost-1%3Frepost%3D1',
    );
  });

  it('takes a signed-out Quote Post directly back to the populated composer', async () => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Repost options, 0 reposts' }));
    await userEvent.click(await screen.findByText('Quote Post'));

    const destination = new URL(
      String(vi.mocked(router.push).mock.calls.at(-1)?.[0]),
      'https://minds.local',
    ).searchParams.get('returnTo');
    expect(destination).toBe(
      '/create?quotePostId=post-1&quoteAuthor=Sarah%20Connor&quoteContent=Hello%20from%20the%20feed',
    );
  });

  it.each([
    'More like this',
    'Mute',
    'Block Sarah Connor',
    'Report',
  ])('takes a signed-out %s action to OTP instead of failing silently', async (action) => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    render(<PostCard post={makePost({ title: 'A post worth acting on' })} />);

    await userEvent.click(screen.getByRole('button', { name: 'More post actions' }));
    await userEvent.click(await screen.findByText(action));

    expect(router.push).toHaveBeenCalledWith('/auth/sign-in?auth=otp&returnTo=%2Fpost%2Fpost-1');
  });

  it('keeps a failed report open instead of claiming it was submitted', async () => {
    reportsMock.create.mockRejectedValueOnce(new Error('network unavailable'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: 'More post actions' }));
    await userEvent.click(await screen.findByText('Report'));
    await userEvent.click(await screen.findByText('Spam'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(reportsMock.create).toHaveBeenCalledWith({
        target_type: 'post',
        target_id: 'post-1',
        reason: 'Spam',
      });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Report Content')).toBeInTheDocument();
    expect(screen.queryByText('Report Submitted')).not.toBeInTheDocument();
  });

  it('reports a failed overflow-menu share instead of silently closing', async () => {
    const share = vi.fn().mockRejectedValueOnce(new Error('share transport unavailable'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: 'More post actions' }));
    await userEvent.click(await screen.findByText('Share'));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Could not share post', 'error'));
  });

  it('keeps an intentional share cancellation quiet', async () => {
    const cancelled = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValueOnce(cancelled);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<PostCard post={makePost()} />);

    await userEvent.click(screen.getByRole('button', { name: 'More post actions' }));
    await userEvent.click(await screen.findByText('Share'));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(toastMock).not.toHaveBeenCalledWith('Could not share post', 'error');
  });

  it('script tags in post content are escaped, not executed', () => {
    const { container } = render(
      <PostCard
        post={makePost({ content: 'Look <script>window.__pwned = true</script> at this' })}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    // The tag survives as visible text, proving it went through the escaper.
    expect(container.textContent).toContain('<script>');
  });

  it('img onerror injection cannot mount an event handler', () => {
    const { container } = render(
      <PostCard post={makePost({ content: '<img src=x onerror="window.__pwned = true"> hi' })} />,
    );
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('javascript: markdown links are not rendered as links', () => {
    const { container } = render(
      <PostCard post={makePost({ content: 'Click [here](javascript:alert(1)) **now**' })} />,
    );
    for (const a of Array.from(container.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
  });

  it('keeps a bare-URL post clickable when preview metadata is unavailable', async () => {
    const url = 'https://www.tumblr.com/sparxsys23/825806031791800320/agile-planning';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<PostCard post={makePost({ content: url })} />);

    const fallback = await screen.findByRole('link', { name: 'Open link to tumblr.com' });
    expect(fallback).toHaveTextContent('tumblr.com/sparxsys23/825806031791800320/agile-planning');

    await userEvent.click(fallback);
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener');
  });

  it('exposes a rich preview as a named link', async () => {
    const url = 'https://example.com/launch-story';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          url,
          domain: 'example.com',
          title: 'Minds launches everywhere',
          description: 'The launch story',
          image: 'https://example.com/preview.jpg',
          favicon: null,
          siteName: 'Example',
        },
      }),
    } as Response);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<PostCard post={makePost({ content: url })} />);

    const preview = await screen.findByRole('link', { name: 'Open Minds launches everywhere' });
    await userEvent.click(preview);
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener');
  });

  it('renders a bare repost as the original post with a reposted header', () => {
    const post = makePost({
      content: '',
      author: { id: 'reposter-1', name: 'Rita Repost', username: 'rita' },
      repostedFrom: {
        id: 'orig-1',
        content: 'The original words',
        author: { id: 'author-1', name: 'Sarah Connor', username: 'sarah' },
        created_at: TWO_HOURS_AGO,
      },
    });
    render(<PostCard post={post} />);
    expect(screen.getByText('Rita Repost reminded')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile for Rita Repost' }))
      .toHaveAttribute('href', '/rita');
    // The body is the ORIGINAL author's post, not the reposter's.
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('The original words')).toBeInTheDocument();
  });

  it('names community and quoted-post context links', () => {
    render(<PostCard post={makePost({
      content: 'My take on this',
      community_id: 'community-1',
      community_name: 'Open Minds',
      reposted_from: {
        id: 'quoted-1',
        content: 'The quoted words',
        author: { id: 'author-2', name: 'Kyle Reese', username: 'kyle' },
        created_at: TWO_HOURS_AGO,
      },
    })} />);

    expect(screen.getByRole('link', { name: 'View community Open Minds' }))
      .toHaveAttribute('href', '/community/community-1');
    expect(screen.getByRole('link', { name: 'Open quoted post by Kyle Reese' }))
      .toHaveAttribute('href', '/post/quoted-1');
  });

  it('exposes post tags as canonical Discover links', () => {
    render(<PostCard post={makePost({ tags: [{ name: 'AI' }] })} />);

    expect(screen.getByRole('link', { name: 'View posts tagged #AI' }))
      .toHaveAttribute('href', '/discover/posts?q=AI');
  });
});
