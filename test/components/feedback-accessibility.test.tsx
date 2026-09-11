import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => {
  const sdk = {
    posts: { create: vi.fn() },
  };
  return { sdk, showToast: vi.fn() };
});

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: authMock.sdk }),
}));

vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../components/Toast', () => ({ showToast: authMock.showToast }));

import FeedbackScreen from '../../app/feedback';

describe('Feedback accessibility', () => {
  beforeEach(() => {
    authMock.sdk.posts.create.mockReset();
    authMock.showToast.mockReset();
  });

  it('names the choice and return controls without submitting feedback', async () => {
    render(<FeedbackScreen />);

    const bug = screen.getByRole('button', { name: 'Report a bug' });
    const idea = screen.getByRole('button', { name: 'Propose a feature' });
    expect(bug).toBeInTheDocument();
    expect(idea).toBeInTheDocument();

    await userEvent.click(bug);
    expect(screen.getByRole('heading', { name: 'Report a bug' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to feedback choices' }));

    await userEvent.click(screen.getByRole('button', { name: 'Propose a feature' }));
    expect(screen.getByRole('heading', { name: 'Propose a feature' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to feedback choices' }));

    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
    expect(authMock.sdk.posts.create).not.toHaveBeenCalled();
  });

  it('warns that feedback is public before collecting it', () => {
    render(<FeedbackScreen />);

    expect(screen.getByText(/feedback is posted publicly/i)).toBeInTheDocument();
    expect(screen.getByText(/do not include private information/i)).toBeInTheDocument();
  });

  it('reports a failed submission and preserves the report for a retry', async () => {
    authMock.sdk.posts.create
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { id: 'post-1' } });
    render(<FeedbackScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    const report = screen.getByPlaceholderText('Describe exactly what went wrong…');
    await userEvent.type(report, 'The feed stopped loading');
    await userEvent.click(screen.getByRole('button', { name: 'Send bug report' }));

    await waitFor(() => expect(authMock.showToast).toHaveBeenCalledWith(
      'Could not send your feedback. Try again.',
      'error',
    ));
    expect(report).toHaveValue('The feed stopped loading');
    expect(screen.queryByText('Got it — thank you')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send bug report' }));
    await waitFor(() => expect(screen.getByText('Got it — thank you')).toBeInTheDocument());
    expect(authMock.sdk.posts.create).toHaveBeenCalledTimes(2);
  });
});
