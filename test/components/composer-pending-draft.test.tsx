// Publish an immutable post snapshot without erasing work entered while the
// request or durable draft cleanup is pending. Keep the real draft module.
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  uploadMediaBatch: vi.fn(),
  removeItem: vi.fn(),
  showToast: vi.fn(),
  blur: null as null | (() => void),
}));
vi.mock('expo-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('expo-router')>();
  return {
    ...actual,
    // Memoized on the incoming effect: the shared stub re-runs a focus effect
    // whenever its identity changes (as the real useFocusEffect does), so an
    // inline wrapper recreated per render would re-fire it — and create.tsx
    // counts each blur as a navigation.
    useFocusEffect: (effect: React.EffectCallback) =>
      actual.useFocusEffect(React.useCallback(() => {
        const cleanup = effect();
        mocks.blur = typeof cleanup === 'function' ? cleanup : null;
        return cleanup;
      }, [effect])),
  };
});
vi.mock('../../components/Toast', () => ({ showToast: mocks.showToast }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: { posts: { create: mocks.create } },
    user: { id: 'viewer-1', username: 'viewer', name: 'Viewer', image: null },
  }),
}));
vi.mock('../../lib/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/hooks')>(),
  useCommunities: () => ({
    communities: [{ id: 'community-1', name: 'Minds Builders' }],
    loading: false,
  }),
}));
vi.mock('../../lib/mediaUpload', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/mediaUpload')>(),
  uploadMediaBatch: mocks.uploadMediaBatch,
}));
vi.mock('../../lib/storage', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/storage')>(),
  removeItem: mocks.removeItem,
}));

import CreateScreen from '../../app/(tabs)/create';
import { clearDrafts, getLatestDraft, saveDraftConfirmed } from '../../lib/drafts';
import * as storage from '../../lib/storage';

const DRAFTS_KEY = 'minds:drafts:v2';
const submittedContent = 'The post being published';
const acceptedPost = { data: { id: 'accepted-post' } };
const originalCreateObjectURL = URL.createObjectURL;
const originalSetItem = storage.setItem;
const input = () => screen.getByPlaceholderText("What's happening?");
const postButton = () => screen.getByRole('button', { name: 'Post' });
const durableDraft = () => JSON.parse(window.localStorage.getItem(DRAFTS_KEY) || '[]')[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function beginPost() {
  const request = deferred<typeof acceptedPost>();
  mocks.create.mockReturnValueOnce(request.promise);
  fireEvent.change(input(), { target: { value: submittedContent } });
  await act(async () => { fireEvent.click(postButton()); });
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ content: submittedContent }));
  expect(postButton()).toBeDisabled();
  return request;
}

function pasteImage(name: string) {
  fireEvent.paste(document, {
    clipboardData: { files: [new File(['image'], name, { type: 'image/png' })] },
  });
}

describe('composer edits during publication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearDrafts();
    window.localStorage.clear();
    mocks.blur = null;
    mocks.create.mockReset().mockResolvedValue(acceptedPost);
    mocks.uploadMediaBatch.mockReset().mockResolvedValue({
      urls: ['https://media.example.test/submitted.png'], failed: false,
    });
    mocks.removeItem.mockReset().mockImplementation(async (key: string) => {
      window.localStorage.removeItem(key);
      return true;
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    clearDrafts();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true, writable: true, value: originalCreateObjectURL,
    });
  });

  it('clears an unchanged accepted draft and does not resurrect it through a pending autosave', async () => {
    await saveDraftConfirmed('Earlier draft');
    render(<CreateScreen />);
    const request = await beginPost();

    await act(async () => { request.resolve(acceptedPost); });
    expect(input()).toHaveValue('');
    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/(tabs)', params: expect.objectContaining({ tab: 'following' }),
    }));

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(getLatestDraft()).toBeNull();
  });

  it('preserves newer raw text even when it would submit the same trimmed content', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    const newerContent = `  ${submittedContent}  \n`;
    fireEvent.change(input(), { target: { value: newerContent } });

    await act(async () => { request.resolve(acceptedPost); });
    expect(input()).toHaveValue(newerContent);
    expect(router.replace).not.toHaveBeenCalled();
    expect(postButton()).toBeEnabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(durableDraft()).toEqual(expect.objectContaining({ content: newerContent }));
  });

  it('keeps replacement media selected after the original attachment is published', async () => {
    const page = render(<CreateScreen />);
    pasteImage('submitted.png');
    const request = await beginPost();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      media_urls: ['https://media.example.test/submitted.png'],
    }));
    pasteImage('newer.png');
    expect(page.container.querySelector('img[src="blob:newer.png"]')).not.toBeNull();

    await act(async () => { request.resolve(acceptedPost); });
    expect(page.container.querySelector('img[src="blob:newer.png"]')).not.toBeNull();
    expect(page.container.querySelector('img[src="blob:submitted.png"]')).toBeNull();
    expect(input()).toHaveValue(submittedContent);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps changed tags, unfinished tag input, audience, and NSFW selection', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    fireEvent.click(screen.getByRole('button', { name: 'Add tags' }));
    fireEvent.change(screen.getByPlaceholderText('Add a tag...'), { target: { value: 'new-tag' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Add a tag...'), { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Add tags' }));
    fireEvent.change(screen.getByPlaceholderText('Add a tag...'), { target: { value: 'unfinished-tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post audience: Global' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Minds Builders' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Mark post as NSFW' }));
    expect(screen.getByText('#new-tag')).toBeInTheDocument();

    await act(async () => { request.resolve(acceptedPost); });
    expect(screen.getByText('#new-tag')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a tag...')).toHaveValue('unfinished-tag');
    expect(screen.getByRole('button', { name: 'Post audience: Minds Builders' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Mark post as NSFW' })).toHaveAttribute('aria-checked', 'true');
    expect(input()).toHaveValue(submittedContent);
    expect(router.replace).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      tag_names: undefined, community_id: undefined, is_nsfw: undefined,
    }));
  });

  it('does not navigate away from a new article when a previous plain post succeeds', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to article editor' }));
    fireEvent.change(screen.getByPlaceholderText('Article title'), { target: { value: 'My next article' } });
    fireEvent.change(screen.getByPlaceholderText(/^Write your article/), {
      target: { value: 'New article body' },
    });

    await act(async () => { request.resolve(acceptedPost); });
    expect(screen.getByPlaceholderText('Article title')).toHaveValue('My next article');
    expect(screen.getByPlaceholderText(/^Write your article/)).toHaveValue('New article body');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });

  it('preserves edits in the editor and durable storage when cleanup was already awaiting device storage', async () => {
    await saveDraftConfirmed(submittedContent);
    const removalStarted = deferred<void>();
    const removalAllowed = deferred<void>();
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      removalStarted.resolve();
      await removalAllowed.promise;
      window.localStorage.removeItem(key);
      return true;
    });
    render(<CreateScreen />);
    const request = await beginPost();
    await act(async () => {
      request.resolve(acceptedPost);
      await removalStarted.promise;
    });
    const newerContent = 'Written while device storage was clearing the old draft';
    fireEvent.change(input(), { target: { value: newerContent } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });

    await act(async () => { removalAllowed.resolve(); });
    expect(input()).toHaveValue(newerContent);
    expect(router.replace).not.toHaveBeenCalled();
    expect(getLatestDraft()).toEqual(expect.objectContaining({ content: newerContent }));
    expect(durableDraft()).toEqual(expect.objectContaining({ content: newerContent }));
  });

  it('keeps the saved draft and does not redirect after Cancel leaves a pending post', async () => {
    const page = render(<CreateScreen />);
    const request = await beginPost();
    const newerContent = 'Keep this next draft when I leave';
    fireEvent.change(input(), { target: { value: newerContent } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(router.back).toHaveBeenCalledOnce();
    expect(durableDraft()).toEqual(expect.objectContaining({ content: newerContent }));
    page.unmount();

    await act(async () => { request.resolve(acceptedPost); });
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledOnce();
    expect(durableDraft()).toEqual(expect.objectContaining({ content: newerContent }));
  });

  it('clears an unchanged accepted post after Cancel leaves its persistent tab without redirecting', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(router.back).toHaveBeenCalledOnce();
    expect(durableDraft()).toEqual(expect.objectContaining({ content: submittedContent }));
    // Expo keeps Create mounted in its tab navigator after Cancel.
    await act(async () => { request.resolve(acceptedPost); });

    expect(input()).toHaveValue('');
    expect(getLatestDraft()).toBeNull();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it('clears an unchanged accepted draft in a blurred but still-mounted tab without redirecting', async () => {
    await saveDraftConfirmed(submittedContent);
    render(<CreateScreen />);
    const request = await beginPost();
    expect(mocks.blur).toEqual(expect.any(Function));
    act(() => { mocks.blur!(); });

    await act(async () => { request.resolve(acceptedPost); });

    expect(input()).toHaveValue('');
    expect(getLatestDraft()).toBeNull();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('finishes Cancel when acceptance arrives during its unchanged draft save, then clears the published draft', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    const saveStarted = deferred<void>();
    const saveAllowed = deferred<void>();
    vi.spyOn(storage, 'setItem').mockImplementationOnce(async (key, value) => {
      saveStarted.resolve();
      await saveAllowed.promise;
      return originalSetItem(key, value);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await saveStarted.promise;
    });
    await act(async () => { request.resolve(acceptedPost); });
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => { saveAllowed.resolve(); });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(input()).toHaveValue('');
    expect(getLatestDraft()).toBeNull();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  it('does not resave an unchanged accepted post when Cancel occurs during delayed cleanup', async () => {
    await saveDraftConfirmed(submittedContent);
    const removalStarted = deferred<void>();
    const removalAllowed = deferred<void>();
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      removalStarted.resolve();
      await removalAllowed.promise;
      window.localStorage.removeItem(key);
      return true;
    });
    render(<CreateScreen />);
    const request = await beginPost();
    await act(async () => {
      request.resolve(acceptedPost);
      await removalStarted.promise;
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });

    await act(async () => { removalAllowed.resolve(); });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(input()).toHaveValue('');
    expect(getLatestDraft()).toBeNull();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  it('navigates back only once when Cancel is pressed twice during accepted draft cleanup', async () => {
    await saveDraftConfirmed(submittedContent);
    const removalStarted = deferred<void>();
    const removalAllowed = deferred<void>();
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      removalStarted.resolve();
      await removalAllowed.promise;
      window.localStorage.removeItem(key);
      return true;
    });
    render(<CreateScreen />);
    const request = await beginPost();
    await act(async () => {
      request.resolve(acceptedPost);
      await removalStarted.promise;
    });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    act(() => {
      fireEvent.click(cancel);
      fireEvent.click(cancel);
    });

    await act(async () => { removalAllowed.resolve(); });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  it('does not publish by button or Enter while Cancel is saving an unsent draft', async () => {
    render(<CreateScreen />);
    const content = 'Keep this unsent draft while leaving';
    fireEvent.change(input(), { target: { value: content } });
    const saveStarted = deferred<void>();
    const saveAllowed = deferred<void>();
    vi.spyOn(storage, 'setItem').mockImplementationOnce(async (key, value) => {
      saveStarted.resolve();
      await saveAllowed.promise;
      return originalSetItem(key, value);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await saveStarted.promise;
    });
    expect(postButton()).toBeDisabled();
    act(() => {
      fireEvent.click(postButton());
      fireEvent.keyDown(input(), { key: 'Enter', code: 'Enter' });
    });
    expect(mocks.create).not.toHaveBeenCalled();

    await act(async () => { saveAllowed.resolve(); });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(durableDraft()).toEqual(expect.objectContaining({ content }));
  });

  it('lets Cancel save and leave when an accepted post is still clearing its old durable draft', async () => {
    await saveDraftConfirmed(submittedContent);
    const removalStarted = deferred<void>();
    const removalAllowed = deferred<void>();
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      removalStarted.resolve();
      await removalAllowed.promise;
      window.localStorage.removeItem(key);
      return true;
    });
    render(<CreateScreen />);
    const request = await beginPost();
    await act(async () => {
      request.resolve(acceptedPost);
      await removalStarted.promise;
    });
    const newerContent = 'Save this draft before leaving the still-mounted tab';
    fireEvent.change(input(), { target: { value: newerContent } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => { removalAllowed.resolve(); });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(durableDraft()).toEqual(expect.objectContaining({ content: newerContent }));
    expect(input()).toHaveValue(newerContent);
  });

  it('keeps newer text visible but reports when preserving the durable draft fails', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    const newerContent = 'New work that device storage cannot save';
    fireEvent.change(input(), { target: { value: newerContent } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage quota exceeded'); });

    await act(async () => { request.resolve(acceptedPost); });

    expect(input()).toHaveValue(newerContent);
    expect(screen.getByRole('button', { name: 'Retry saving draft' })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(durableDraft()).toBeUndefined();
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Posted. Newer edits are still here, but the draft was not saved.',
      'error',
    );
  });

  it('retains newer edits after a rejected post and permits publishing them on retry', async () => {
    render(<CreateScreen />);
    const request = await beginPost();
    const newerContent = '  Revised while waiting for the failed request  ';
    fireEvent.change(input(), { target: { value: newerContent } });
    await act(async () => { request.reject(new Error('Temporary posting failure')); });
    expect(screen.getByText('Temporary posting failure')).toBeInTheDocument();
    expect(input()).toHaveValue(newerContent);
    expect(postButton()).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(postButton()); });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ content: newerContent.trim() }));
    expect(input()).toHaveValue('');
    expect(router.replace).toHaveBeenCalledOnce();
  });
});
