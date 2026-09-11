import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobsApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());
// One stable sdk reference: the screen's load() is memoized on it, and a
// fresh object per render would re-trigger the loading state mid-test.
const sdkMock = vi.hoisted(() => ({ jobs: jobsApi }));

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: sdkMock }),
}));
// The components barrel reaches lib/recursiv, whose real module imports the
// workspace SDK package; mock it out the same way the other screen tests do.
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import JobsScreen from '../../app/jobs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Scheduled jobs outage honesty', () => {
  it('reports an outage instead of presenting it as no jobs, and retries in place', async () => {
    jobsApi.list.mockRejectedValue(new Error('jobs offline'));

    render(<JobsScreen />);

    expect(
      await screen.findByText("Couldn't load your scheduled jobs · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the "no scheduled jobs" empty state.
    expect(screen.queryByText('No scheduled jobs')).not.toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'jobs', step: 'load-jobs' },
    );

    // With a stable sdk, the mount fires exactly one load; the recovery below
    // must come from the retry click, not an automatic re-run.
    expect(jobsApi.list).toHaveBeenCalledTimes(1);
    jobsApi.list.mockResolvedValue({
      data: [{ id: 'j1', name: 'Nightly digest', cron: '0 3 * * *', status: 'active' }],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading scheduled jobs' }),
    );

    expect(await screen.findByText('Nightly digest')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your scheduled jobs · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('treats a 200 whose body carries no list as an outage', async () => {
    jobsApi.list.mockResolvedValue({});

    render(<JobsScreen />);

    expect(
      await screen.findByText("Couldn't load your scheduled jobs · Tap to retry"),
    ).toBeInTheDocument();
    expect(screen.queryByText('No scheduled jobs')).not.toBeInTheDocument();
  });

  it('still shows the real empty state when the server answers with zero jobs', async () => {
    jobsApi.list.mockResolvedValue({ data: [] });

    render(<JobsScreen />);

    expect(await screen.findByText('No scheduled jobs')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry loading scheduled jobs' }),
    ).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
