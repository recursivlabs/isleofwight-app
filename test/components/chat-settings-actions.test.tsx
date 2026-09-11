import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../components/Toast', () => ({ showToast: mocks.showToast }));

import { ChatSettingsSheet } from '../../components/ChatSettingsSheet';
import { clearPreferences } from '../../lib/preferences';

describe('Chat settings destructive actions', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.clear();
    clearPreferences();
  });

  it('keeps mute off and reports a retryable error when device storage rejects it', async () => {
    mocks.useAuth.mockReturnValue({ sdk: {} });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    try {
      render(
        <ChatSettingsSheet
          visible
          onClose={vi.fn()}
          partner={{ id: 'user-2', name: 'Alice' }}
          conversationId="conversation-storage-failure"
          onDeleted={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByText('Mute notifications'));

      await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(
        'Conversation mute was not saved. Try again.',
        'error',
      ));
      expect(screen.getByRole('switch')).not.toBeChecked();
    } finally {
      setItem.mockRestore();
    }
  });

  it('reports a failed conversation delete and leaves the thread open', async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    mocks.useAuth.mockReturnValue({
      sdk: { chat: { deleteConversation: vi.fn().mockRejectedValue(new Error('offline')) } },
    });

    render(
      <ChatSettingsSheet
        visible
        onClose={onClose}
        partner={{ id: 'user-2', name: 'Alice' }}
        conversationId="conversation-1"
        onDeleted={onDeleted}
      />,
    );

    await userEvent.click(screen.getByText('Delete conversation'));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(
      'Could not delete conversation',
      'error',
    ));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports a successful delete before closing the thread', async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    mocks.useAuth.mockReturnValue({
      sdk: { chat: { deleteConversation: vi.fn().mockResolvedValue(undefined) } },
    });

    render(
      <ChatSettingsSheet
        visible
        onClose={onClose}
        partner={{ id: 'user-2', name: 'Alice' }}
        conversationId="conversation-1"
        onDeleted={onDeleted}
      />,
    );

    await userEvent.click(screen.getByText('Delete conversation'));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(
      'Conversation deleted',
      'success',
    ));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledOnce();
  });
});
