import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  create: vi.fn(),
  toast: vi.fn(),
  refresh: null as (() => void) | null,
  auth: { sdk: null as any, user: null as any },
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../lib/recursiv', () => ({
  ORG_ID: 'test-org',
  publicMinds: { publicPosts: { get: vi.fn() } },
}));
vi.mock('../../lib/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/hooks')>();
  return {
    ...actual,
    usePost: (id: string) => {
      const result = actual.usePost(id);
      mocks.refresh = result.refresh;
      return result;
    },
    useSimilarPosts: () => ({ posts: [], loading: false }),
    useConversations: () => ({ conversations: [], loading: false }),
  };
});
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../../components/Toast', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../components/Toast')>(),
  showToast: mocks.toast,
}));

import PostDetailScreen from '../../app/post/[id]';
import { clearAll, getCached, setCache, setCacheUser } from '../../lib/cache';

const A = 'reply-ownership-post-a';
const B = 'reply-ownership-post-b';
const post = (id: string, replies: any[] = []) => ({
  id,
  content: `Root post ${id}`,
  author: { id: 'author', name: 'Author', username: 'author' },
  created_at: '2026-09-07T12:00:00Z',
  replies,
  repliesCount: replies.length,
});
const reply = (id: string, parentId: string) => ({
  id, content: `Accepted ${id}`, reply_to_id: parentId,
  created_at: '2026-09-07T13:00:00Z',
});
const serverPosts = new Map<string, ReturnType<typeof post>>();
let settlePending: Array<() => void> = [];

function pendingReply(id: string, parentId: string) {
  let resolve!: (value: { data: ReturnType<typeof reply> }) => void;
  let reject!: (error: Error) => void;
  const result = { data: reply(id, parentId) };
  const promise = new Promise<typeof result>((yes, no) => { resolve = yes; reject = no; });
  const accept = () => resolve(result);
  settlePending.push(accept);
  return { promise, accept, reject, result };
}

function setViewer(id: string) {
  mocks.auth = {
    sdk: { posts: { get: mocks.getPost, create: mocks.create } },
    user: { id, name: id, username: id },
  };
}

const composer = () => screen.getByPlaceholderText('Write a reply...');
const send = () => screen.getByRole('button', { name: 'Send reply' });
function writeDraft(value: string) { fireEvent.change(composer(), { target: { value } }); }
function submit(value: string) {
  writeDraft(value);
  fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter' });
}

async function openPost(id = A) {
  __setLocalSearchParams({ id });
  const view = render(<PostDetailScreen />);
  await waitFor(() => expect(screen.getByText(post(id).content)).toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('Refreshing post…')).not.toBeInTheDocument());
  return view;
}

async function navigate(view: ReturnType<typeof render>, id: string) {
  await act(async () => {
    __setLocalSearchParams({ id });
    view.rerender(<PostDetailScreen />);
  });
  expect(screen.getByText(post(id).content)).toBeInTheDocument();
}

beforeEach(async () => {
  settlePending = [];
  mocks.getPost.mockReset();
  mocks.create.mockReset();
  mocks.toast.mockReset();
  mocks.refresh = null;
  setViewer('reply-owner-one');
  await setCacheUser(mocks.auth.user.id);
  await clearAll();
  serverPosts.clear();
  serverPosts.set(A, post(A));
  serverPosts.set(B, post(B));
  mocks.getPost.mockImplementation(async (id: string) => ({ data: serverPosts.get(id) }));
});

afterEach(async () => {
  await act(async () => { settlePending.forEach((accept) => accept()); });
  await clearAll();
});

describe('post-detail reply ownership', () => {
  it('keeps B replies, count, cache and draft separate from a late accepted reply to A', async () => {
    const pending = pendingReply('reply-to-a', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Draft for A');
    expect(mocks.create).toHaveBeenCalledOnce();
    await navigate(view, B);
    writeDraft('New draft for B');
    const originalB = getCached(`post:${B}`);
    await act(async () => { pending.accept(); });

    expect.soft(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect.soft(screen.getByRole('button', { name: 'Reply to post, 0 replies' })).toBeInTheDocument();
    expect.soft(getCached(`post:${B}`)).toEqual(originalB);
    expect.soft(getCached(`post:${A}`)?.id).toBe(A);
    expect.soft(composer()).toHaveValue('New draft for B');
  });

  it('lets B submit while A is pending and does not let A settlement unlock B', async () => {
    const pendingA = pendingReply('reply-to-a', A);
    const pendingB = pendingReply('reply-to-b', B);
    mocks.create.mockReturnValueOnce(pendingA.promise).mockReturnValueOnce(pendingB.promise);
    const view = await openPost();
    submit('Draft for A');
    await navigate(view, B);
    writeDraft('Draft for B');
    expect(send()).toBeEnabled();
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter' });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ reply_to_id: B }));
    await act(async () => { pendingA.accept(); });

    expect(send()).toBeDisabled();
    expect(send()).toHaveAttribute('aria-busy', 'true');
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter' });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    await act(async () => { pendingB.accept(); });
    expect(composer()).toHaveValue('');
    expect(send()).toHaveAttribute('aria-busy', 'false');
  });

  it('does not clear a newer equal-text draft after A to B to A or allow a duplicate pending submission', async () => {
    const pending = pendingReply('reply-to-a', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Same words');
    await navigate(view, B);
    writeDraft('Separate B draft');
    await navigate(view, A);
    writeDraft('Newly edited words');
    writeDraft('Same words');
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter' });
    expect(mocks.create).toHaveBeenCalledOnce();

    await act(async () => { pending.accept(); });

    expect(composer()).toHaveValue('Same words');
    expect(send()).toBeEnabled();
    expect(send()).toHaveAttribute('aria-busy', 'false');
    expect(getCached(`post:${A}`).replies.filter((item: any) => item.id === pending.result.data.id)).toHaveLength(1);
  });

  it('keeps a departed failed draft without showing its failure toast on B', async () => {
    const pending = pendingReply('reply-to-a', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    const originalDraft = '  Failed draft for A\n ';
    submit(originalDraft);
    await navigate(view, B);
    writeDraft('Unrelated B draft');
    await act(async () => { pending.reject(new Error('Synthetic reply failure')); });

    expect(mocks.toast).not.toHaveBeenCalled();
    expect(composer()).toHaveValue('Unrelated B draft');
    expect(send()).toBeEnabled();
    await navigate(view, A);
    expect(composer()).toHaveValue(originalDraft);
    expect(send()).toBeEnabled();
  });

  it('shows a pending reply failure after returning to its original post', async () => {
    const pending = pendingReply('failed-after-return-to-a', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    const originalDraft = 'Draft pending while visiting B';
    submit(originalDraft);
    await navigate(view, B);
    await navigate(view, A);
    expect(composer()).toHaveValue(originalDraft);
    expect(send()).toBeDisabled();

    await act(async () => { pending.reject(new Error('Synthetic reply failure after returning')); });

    expect(mocks.toast).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith('Reply failed — your draft was kept', 'error');
    expect(composer()).toHaveValue(originalDraft);
    expect(send()).toBeEnabled();
  });

  it('does not show an old reply failure after the rendered account changes', async () => {
    const pending = pendingReply('failed-after-rendered-account-switch', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Old account pending draft');
    await act(async () => {
      setViewer('reply-owner-two');
      view.rerender(<PostDetailScreen />);
    });
    writeDraft('New account draft');

    await act(async () => { pending.reject(new Error('Synthetic old-account reply failure')); });

    expect(mocks.toast).not.toHaveBeenCalled();
    expect(composer()).toHaveValue('New account draft');
    expect(send()).toBeEnabled();
  });

  it('does not show an old reply failure after a cache-first account switch', async () => {
    const pending = pendingReply('failed-after-cache-generation-switch', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('Pending across cache-first account switch');
    const replacementPost = { ...post(A), viewerMarker: 'replacement-cache' };
    await act(async () => {
      await setCacheUser('reply-owner-two');
      setCache(`post:${A}`, replacementPost);
    });
    expect(mocks.auth.user.id).toBe('reply-owner-one');

    await act(async () => { pending.reject(new Error('Synthetic stale-generation reply failure')); });

    expect(mocks.toast).not.toHaveBeenCalled();
    expect(getCached(`post:${A}`)).toEqual(replacementPost);
  });

  it('persists a healthy same-route accepted reply once and clears only its submitted draft', async () => {
    const existing = reply('existing-a-reply', A);
    serverPosts.set(A, post(A, [existing]));
    const pending = pendingReply('new-a-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('A healthy reply');
    await act(async () => { pending.accept(); });

    expect(composer()).toHaveValue('');
    expect(screen.getAllByText(pending.result.data.content)).toHaveLength(1);
    expect(getCached(`post:${A}`).replies.map((item: any) => item.id))
      .toEqual([existing.id, pending.result.data.id]);
    expect(getCached(`post:${A}`).repliesCount).toBe(2);
    expect(screen.getByText('2 replies')).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('does not double-count an accepted reply that revalidation already returned', async () => {
    const pending = pendingReply('already-visible-a-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('A reply being revalidated');
    serverPosts.set(A, post(A, [pending.result.data]));
    await act(async () => { mocks.refresh?.(); });
    await waitFor(() => expect(mocks.getPost).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText(pending.result.data.content)).toHaveLength(1);
    await act(async () => { pending.accept(); });

    expect(composer()).toHaveValue('');
    expect(screen.getAllByText(pending.result.data.content)).toHaveLength(1);
    expect(getCached(`post:${A}`).replies.map((item: any) => item.id))
      .toEqual([pending.result.data.id]);
    expect(getCached(`post:${A}`).repliesCount).toBe(1);
    expect(screen.getByText('1 reply')).toBeInTheDocument();
  });

  it('retains loaded replies when a feed summary replaces the cache before reply acceptance', async () => {
    const existing = reply('existing-before-feed-summary', A);
    serverPosts.set(A, post(A, [existing]));
    const pending = pendingReply('accepted-after-feed-summary', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    expect(screen.getByText(existing.content)).toBeInTheDocument();
    submit('Reply while a feed request is pending');
    const { replies: _replies, ...summary } = post(A, [existing]);
    setCache(`post:${A}`, summary);
    expect(getCached(`post:${A}`).replies).toBeUndefined();

    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`).replies.map((item: any) => item.id))
      .toEqual([existing.id, pending.result.data.id]);
    expect(getCached(`post:${A}`).repliesCount).toBe(2);
    expect(screen.getByText(existing.content)).toBeInTheDocument();
    expect(screen.getAllByText(pending.result.data.content)).toHaveLength(1);
  });

  it('retains the latest loaded detail after a summary overwrite and departure before acceptance', async () => {
    const existing = reply('existing-before-detail-refresh', A);
    const refreshed = reply('arrived-during-detail-refresh', A);
    serverPosts.set(A, post(A, [existing]));
    const pending = pendingReply('accepted-after-departure-and-summary', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Reply while detail is refreshed');
    serverPosts.set(A, post(A, [existing, refreshed]));
    await act(async () => { mocks.refresh?.(); });
    await waitFor(() => expect(screen.getByText(refreshed.content)).toBeInTheDocument());
    const { replies: _replies, ...summary } = post(A, [existing, refreshed]);
    setCache(`post:${A}`, summary);
    expect(getCached(`post:${A}`).replies).toBeUndefined();
    await navigate(view, B);
    writeDraft('B draft must stay separate');
    const originalB = getCached(`post:${B}`);

    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`).replies.map((item: any) => item.id))
      .toEqual([existing.id, refreshed.id, pending.result.data.id]);
    expect(getCached(`post:${A}`).repliesCount).toBe(3);
    expect(getCached(`post:${B}`)).toEqual(originalB);
    expect(screen.queryByText(existing.content)).not.toBeInTheDocument();
    expect(screen.queryByText(refreshed.content)).not.toBeInTheDocument();
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(composer()).toHaveValue('B draft must stay separate');
  });

  it('does not write an old account completion into the replacement account cache or draft', async () => {
    const pending = pendingReply('old-account-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Same words in both accounts');
    const replacementPost = { ...post(A), viewerMarker: 'second-account' };
    serverPosts.set(A, replacementPost);
    await act(async () => {
      await setCacheUser('reply-owner-two');
      setCache(`post:${A}`, replacementPost);
      setViewer('reply-owner-two');
      view.rerender(<PostDetailScreen />);
    });
    await waitFor(() => expect(mocks.getPost).toHaveBeenCalledTimes(2));
    writeDraft('Same words in both accounts');
    const secondAccountCache = getCached(`post:${A}`);
    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`)).toEqual(secondAccountCache);
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(composer()).toHaveValue('Same words in both accounts');
    expect(send()).toBeEnabled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('does not write reply state or cache after the submitting screen unmounts', async () => {
    const pending = pendingReply('unmounted-a-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    const view = await openPost();
    submit('Reply from a departed screen');
    const cachedBeforeUnmount = getCached(`post:${A}`);
    view.unmount();
    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`)).toEqual(cachedBeforeUnmount);
    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument();
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('does not write into a replacement cache namespace before rendered identity catches up', async () => {
    const pending = pendingReply('cache-first-switch-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('Pending across cache-first account switch');
    const replacementPost = { ...post(A), viewerMarker: 'cache-switched-before-auth-render' };
    await act(async () => {
      await setCacheUser('reply-owner-two');
      setCache(`post:${A}`, replacementPost);
    });
    // persistSession switches cache first, then awaits storage before changing
    // the rendered SDK/user. Keep that old render mounted for this settlement.
    expect(mocks.auth.user.id).toBe('reply-owner-one');
    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`)).toEqual(replacementPost);
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('does not repopulate a cleared cache from an old pending reply', async () => {
    const pending = pendingReply('cache-cleared-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('Pending across cache clear');
    await act(async () => { await clearAll(); });
    expect(getCached(`post:${A}`)).toBeNull();
    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`)).toBeNull();
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('fences a namespace round trip even when the rendered account and final namespace match again', async () => {
    const pending = pendingReply('cache-round-trip-reply', A);
    mocks.create.mockReturnValue(pending.promise);
    await openPost();
    submit('Pending across namespace A to B to A');
    const replacementPost = { ...post(A), viewerMarker: 'new-generation-of-first-account' };
    await act(async () => {
      await setCacheUser('reply-owner-two');
      await setCacheUser('reply-owner-one');
      setCache(`post:${A}`, replacementPost);
    });
    await act(async () => { pending.accept(); });

    expect(getCached(`post:${A}`)).toEqual(replacementPost);
    expect(screen.queryByText(pending.result.data.content)).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
