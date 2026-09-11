import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ user: { id: 'viewer-1', name: 'Viewer' }, sdk: null as any }));
const picker = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock('../../lib/auth', () => ({ useAuth: () => auth }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: picker, MediaTypeOptions: { All: 'All' } }));
vi.mock('../../lib/mediaUpload', () => ({ uploadMediaBlob: upload }));
vi.mock('../../components/Toast', () => ({ showToast: toast }));

import { ConversationView } from '../../app/(tabs)/chat';
import { clearChatComposerSession } from '../../lib/chatComposerSession';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

let testSequence = 0;
let threadId: string;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function setup(
  send: ReturnType<typeof vi.fn>,
  conversation = vi.fn(async (id: string) => ({ data: {
    id,
    members: [{ id: 'viewer-1', name: 'Viewer', is_ai: false }, { id: 'alice-1', name: 'Alice', is_ai: false }],
  } })),
) {
  auth.sdk = {
    chat: {
      conversation,
      messages: vi.fn(async () => ({ data: [] })),
      markAsRead: vi.fn(async () => ({})),
      send,
    },
    realtime: {
      connect: vi.fn(async () => null), getSocket: () => null, disconnect: vi.fn(),
      joinConversation: vi.fn(), leaveConversation: vi.fn(), onMessage: vi.fn(() => () => {}),
    },
  };
  return render(<ConversationView conversationId={threadId} onBack={() => {}} />);
}

beforeEach(() => {
  clearChatComposerSession();
  auth.user = { id: 'viewer-1', name: 'Viewer' };
  threadId = `pending-attachment-${++testSequence}`;
  picker.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:chosen-photo', mimeType: 'image/jpeg' }] });
  upload.mockReset().mockResolvedValue('https://media.example/chosen-photo.jpg');
  toast.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) })));
});

afterEach(() => vi.unstubAllGlobals());

describe('chat attachment admission during a pending text send', () => {
  it('sends a picked attachment normally when the composer is idle', async () => {
    const send = vi.fn(async () => ({ data: { id: 'accepted-photo' } }));
    setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      conversation_id: threadId, content: 'https://media.example/chosen-photo.jpg',
    })));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('shows cold-thread preflight as busy and releases it after lookup (recipient available: %s)', async (recipientAvailable) => {
    const pending = deferred<any>();
    const conversation = vi.fn().mockReturnValue(pending.promise);
    const send = vi.fn(async () => ({ data: { id: 'accepted-text' } }));
    setup(send, conversation);
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'First cold-thread message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(conversation).toHaveBeenCalled());
    expect(send).not.toHaveBeenCalled();
    const attach = screen.getByRole('button', { name: 'Attach media' });
    expect(attach).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Send message' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(attach);
    expect(picker).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    await act(async () => pending.resolve({ data: {
      id: threadId,
      members: recipientAvailable ? [{ id: 'viewer-1', name: 'Viewer', is_ai: false }, { id: 'alice-1', name: 'Alice', is_ai: false }] : [],
    } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach media' })).not.toHaveAttribute('aria-disabled', 'true'));
    if (recipientAvailable) expect(send).toHaveBeenCalledOnce();
    else {
      expect(send).not.toHaveBeenCalled();
      expect(input).toHaveValue('First cold-thread message');
    }
  });

  it('does not open an attachment picker whose selection will be silently discarded during a pending send', async () => {
    const pending = deferred<any>();
    const send = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ data: { id: 'accepted-photo' } });
    setup(send);
    await screen.findByText('Start the conversation');
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'First message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'Next message draft' } });
    const attach = screen.getByRole('button', { name: 'Attach media' });
    expect(attach).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(attach);
    expect(picker).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ data: { id: 'accepted-text' } }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    expect(input).toHaveValue('Next message draft');

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'https://media.example/chosen-photo.jpg' }));
    expect(input).toHaveValue('Next message draft');
  });

  it('holds Enter and button sends during attachment upload without losing typed text', async () => {
    const pending = deferred<string>();
    upload.mockReturnValueOnce(pending.promise);
    let acceptedSequence = 0;
    const send = vi.fn(async () => ({ data: { id: `accepted-${++acceptedSequence}` } }));
    setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Text after my photo' } });
    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(sendButton);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue('Text after my photo');

    await act(async () => pending.resolve('https://media.example/chosen-photo.jpg'));
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'https://media.example/chosen-photo.jpg' }));
    expect(input).toHaveValue('Text after my photo');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Text after my photo' }));
  });

  it('waits to consume a route prompt until the same conversation upload finishes', async () => {
    const pending = deferred<string>();
    upload.mockReturnValueOnce(pending.promise);
    let acceptedSequence = 0;
    const send = vi.fn(async () => ({ data: { id: `accepted-${++acceptedSequence}` } }));
    const view = setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());

    __setLocalSearchParams({ id: threadId, prompt: 'Queued route prompt' });
    view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    expect(send).not.toHaveBeenCalled();
    expect(router.setParams).not.toHaveBeenCalled();

    await act(async () => pending.resolve('https://media.example/chosen-photo.jpg'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({
      conversation_id: threadId, content: 'https://media.example/chosen-photo.jpg',
    }));
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      conversation_id: threadId, content: 'Queued route prompt',
    }));
    expect(router.setParams).toHaveBeenCalledExactlyOnceWith({ prompt: undefined });
  });

  it.each([false, true])('does not send a deferred route prompt after leaving its conversation (return to original thread: %s)', async (returnToOriginal) => {
    const pending = deferred<string>();
    upload.mockReturnValueOnce(pending.promise);
    const send = vi.fn(async () => ({ data: { id: 'accepted' } }));
    const view = setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());

    __setLocalSearchParams({ id: threadId, prompt: 'Only for the original thread' });
    view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    expect(send).not.toHaveBeenCalled();
    view.rerender(<ConversationView conversationId={`${threadId}-second`} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach media' })).not.toHaveAttribute('aria-disabled', 'true'));
    if (returnToOriginal) view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    expect(send).not.toHaveBeenCalled();
    expect(router.setParams).toHaveBeenCalledExactlyOnceWith({ prompt: undefined });

    await act(async () => pending.resolve('https://media.example/stale-photo.jpg'));
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send a deferred route prompt under a replacement account', async () => {
    const pending = deferred<string>();
    upload.mockReturnValueOnce(pending.promise);
    const send = vi.fn(async () => ({ data: { id: 'accepted' } }));
    const view = setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());

    __setLocalSearchParams({ id: threadId, prompt: 'Only from the original account' });
    view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    expect(send).not.toHaveBeenCalled();
    auth.user = { id: 'alice-1', name: 'Alice' };
    view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach media' })).not.toHaveAttribute('aria-disabled', 'true'));
    expect(send).not.toHaveBeenCalled();
    expect(router.setParams).toHaveBeenCalledExactlyOnceWith({ prompt: undefined });

    // Apply the router update at the stub boundary, then recreate the view
    // under the replacement account. The abandoned intent must stay gone.
    __setLocalSearchParams({ id: threadId });
    view.unmount();
    setup(send);
    await screen.findByText('Start the conversation');
    expect(send).not.toHaveBeenCalled();

    await act(async () => pending.resolve('https://media.example/stale-photo.jpg'));
    expect(send).not.toHaveBeenCalled();
  });

  it('admits one picker synchronously and releases admission when that picker is cancelled', async () => {
    const pending = deferred<any>();
    picker.mockReturnValueOnce(pending.promise);
    const send = vi.fn().mockResolvedValue({ data: { id: 'accepted' } });
    setup(send);
    await screen.findByText('Start the conversation');
    const attach = screen.getByRole('button', { name: 'Attach media' });
    act(() => { fireEvent.click(attach); fireEvent.click(attach); });
    await waitFor(() => expect(picker).toHaveBeenCalledOnce());
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Keep this text' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(send).not.toHaveBeenCalled();

    await act(async () => pending.resolve({ canceled: true }));
    expect(upload).not.toHaveBeenCalled();
    expect(input).toHaveValue('Keep this text');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
  });

  it('releases failed upload admission so a later attachment can be sent', async () => {
    upload.mockResolvedValueOnce(null);
    const send = vi.fn().mockResolvedValue({ data: { id: 'accepted' } });
    setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach media' })).not.toHaveAttribute('aria-disabled', 'true'));
    expect(send).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])('a stale upload cannot send or unlock the current media operation (return to original thread: %s)', async (returnToOriginal) => {
    const oldUpload = deferred<string>();
    const newUpload = deferred<string>();
    upload.mockReturnValueOnce(oldUpload.promise).mockReturnValueOnce(newUpload.promise);
    const send = vi.fn().mockResolvedValue({ data: { id: 'accepted-new-photo' } });
    const view = setup(send);
    await screen.findByText('Start the conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());

    view.rerender(<ConversationView conversationId={`${threadId}-second`} onBack={() => {}} />);
    if (returnToOriginal) view.rerender(<ConversationView conversationId={threadId} onBack={() => {}} />);
    const currentThread = returnToOriginal ? threadId : `${threadId}-second`;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach media' })).not.toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));

    await act(async () => oldUpload.resolve('https://media.example/stale-photo.jpg'));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Attach media' })).toHaveAttribute('aria-disabled', 'true');
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Current thread draft' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(send).not.toHaveBeenCalled();

    await act(async () => newUpload.resolve('https://media.example/current-photo.jpg'));
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      conversation_id: currentThread, content: 'https://media.example/current-photo.jpg',
    }));
    expect(input).toHaveValue('Current thread draft');
  });
});
