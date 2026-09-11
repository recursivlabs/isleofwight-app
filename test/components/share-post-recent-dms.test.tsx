import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'viewer-1' } as { id: string } | null,
  conversations: [] as any[],
  dm: vi.fn(),
  send: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('../../lib/auth', () => {
  const auth = {
    sdk: { chat: { dm: mocks.dm, send: mocks.send } },
  };
  return { useAuth: () => ({ ...auth, user: mocks.user }) };
});
vi.mock('../../lib/hooks', () => ({
  useConversations: () => ({ conversations: mocks.conversations }),
}));
vi.mock('../../components/Toast', () => ({ useToast: () => ({ show: mocks.toast }) }));
vi.mock('../../lib/resolvePersonalAgent', () => ({ resolvePersonalAgent: vi.fn() }));

import { SharePostSheet } from '../../components/SharePostSheet';
import { router } from '../component-stubs/expo-router';

const viewer = { id: 'viewer-1', name: 'Viewer' };
const alice = { id: 'alice-1', name: 'Alice', username: 'alice' };
const bob = { id: 'bob-1', name: 'Bob' };

beforeEach(() => {
  mocks.user = { id: 'viewer-1' };
  mocks.conversations = [];
  mocks.dm.mockReset().mockResolvedValue({ data: { id: 'direct-alice' } });
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'synthetic-message' } });
  router.push.mockClear();
});

describe('recent recipients in the post share sheet', () => {
  it.each([
    ['two-member group', { type: 'group', members: [viewer, alice] }],
    ['three-member group', { type: 'group', members: [viewer, alice, bob] }],
    ['legacy group', { conversation_type: 'group', members: [viewer, alice] }],
    ['community', { type: 'community', community_id: 'community-1', members: [viewer, alice] }],
    ['unknown kind', { type: 'unknown-kind', members: [viewer, alice] }],
    ['ambiguous one-on-one', { type: 'one_on_one', members: [viewer, alice, bob] }],
    ['type-less multi-person row', { members: [viewer, alice, bob] }],
    ['unresolved member', { type: 'one_on_one', members: [viewer, alice, {}] }],
  ])('does not turn a %s into a private-message suggestion', (_label, conversation) => {
    mocks.conversations = [{ id: 'not-a-dm', name: 'Not a direct recipient', ...conversation as object }];
    render(<SharePostSheet visible post={{ id: 'shared-post' }} onClose={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /^Send post to / }).map(
      (button) => button.getAttribute('aria-label'),
    )).toEqual(['Send post to Minds AI']);
    expect(mocks.dm).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not guess a recent counterparty before the viewer is known', () => {
    mocks.user = null;
    mocks.conversations = [{ type: 'one_on_one', members: [alice] }];
    render(<SharePostSheet visible post={{ id: 'shared-post' }} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Send post to Alice' })).not.toBeInTheDocument();
    expect(mocks.dm).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each([
    ['explicit one-on-one with a custom title', {
      type: 'one_on_one', name: 'Old conversation title', members: [viewer, alice],
    }],
    ['type-less two-person legacy row', { members: [viewer, alice] }],
    ['nested participant users', { type: 'one_on_one', participants: [
      { id: 'membership-viewer', user: viewer },
      { id: 'membership-alice', user: alice },
    ] }],
    ['userId participant wrappers', { type: 'one_on_one', participants: [
      { id: 'membership-viewer', userId: 'viewer-1', name: 'Viewer' },
      { id: 'membership-alice', userId: 'alice-1', name: 'Alice' },
    ] }],
    ['user_id participant wrappers', { type: 'one_on_one', participants: [
      { id: 'membership-viewer', user_id: 'viewer-1', name: 'Viewer' },
      { id: 'membership-alice', user_id: 'alice-1', name: 'Alice' },
    ] }],
    ['empty participants with legacy discriminator and populated members', {
      conversation_type: 'one_on_one', participants: [], members: [viewer, alice],
    }],
  ])('labels and sends to the actual counterparty for %s', async (_label, conversation) => {
    mocks.conversations = [{ id: 'recent-dm', ...conversation as object }];
    const onClose = vi.fn();
    render(<SharePostSheet visible post={{ id: 'shared-post' }} onClose={onClose} />);

    expect(screen.queryByRole('button', { name: 'Send post to Old conversation title' })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send post to Alice' })));

    expect(mocks.dm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ user_id: 'alice-1' }));
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({
      conversation_id: 'direct-alice', content: 'http://localhost:3000/post/shared-post',
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/[id]', params: { id: 'direct-alice', focused: '1' },
    });
  });
});
