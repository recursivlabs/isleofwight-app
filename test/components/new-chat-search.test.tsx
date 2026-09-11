import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const profileSearch = vi.fn();
  const agentSearch = vi.fn();
  const following = vi.fn().mockResolvedValue({ data: [] });
  const dm = vi.fn();
  return {
    profileSearch,
    agentSearch,
    following,
    dm,
    sdk: {
      profiles: { following, search: profileSearch },
      agents: { listDiscoverable: agentSearch },
      chat: { dm },
    },
  };
});

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'viewer-1' },
    sdk: mocks.sdk,
  }),
}));

vi.mock('../../lib/hooks', () => ({
  useProfiles: () => ({ profiles: [], loading: false, error: null }),
  useAgents: () => ({ agents: [], loading: false, error: null }),
}));

import { NewChatModal } from '../../components/NewChatModal';

describe('new-message recipient search', () => {
  beforeEach(() => {
    mocks.profileSearch.mockReset();
    mocks.agentSearch.mockReset();
    mocks.following.mockReset().mockResolvedValue({ data: [] });
    mocks.dm.mockReset();
  });

  it('shows a retryable outage instead of claiming there are no matches', async () => {
    mocks.profileSearch
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ data: [] });
    mocks.agentSearch
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ data: [] });
    render(<NewChatModal visible onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Search people or agents…'), {
      target: { value: 'alice' },
    });

    expect(await screen.findByText('Search is unavailable right now.')).toBeInTheDocument();
    expect(screen.queryByText('No people or agents match “alice”.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await waitFor(() => expect(mocks.profileSearch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No people or agents match “alice”.')).toBeInTheDocument();
  });

  it('keeps partial results visible and explains the incomplete search', async () => {
    mocks.profileSearch.mockRejectedValue(new TypeError('offline'));
    mocks.agentSearch.mockResolvedValue({
      data: [{ id: 'agent-1', name: 'Alice Agent', username: 'alice-agent' }],
    });
    render(<NewChatModal visible onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Search people or agents…'), {
      target: { value: 'alice' },
    });

    expect(await screen.findByText('Alice Agent')).toBeInTheDocument();
    expect(screen.getByText('Some search results could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No people or agents match “alice”.')).not.toBeInTheDocument();
  });
});
