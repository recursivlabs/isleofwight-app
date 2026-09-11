import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'new-user', username: 'assigned-name' },
  sdk: { profiles: { getByUsername: vi.fn(), update: vi.fn() } },
  refreshUser: vi.fn(),
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => auth }));

import PickUsernameScreen from '../../app/auth/pick-username';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: { status: number }) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function checkUsername(username: string) {
  fireEvent.change(screen.getByPlaceholderText('yourname'), { target: { value: username } });
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(auth.sdk.profiles.getByUsername).toHaveBeenLastCalledWith(username);
}

beforeEach(() => {
  vi.useFakeTimers();
  auth.sdk.profiles.getByUsername.mockReset();
  auth.sdk.profiles.update.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('username availability request freshness', () => {
  it('debounces edits so only the latest username is requested', async () => {
    auth.sdk.profiles.getByUsername.mockRejectedValue({ status: 404 });
    render(<PickUsernameScreen />);
    const input = screen.getByPlaceholderText('yourname');
    fireEvent.change(input, { target: { value: 'older-name' } });
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(auth.sdk.profiles.getByUsername).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'current-name' } });
    await act(async () => { vi.advanceTimersByTime(349); });
    expect(auth.sdk.profiles.getByUsername).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(auth.sdk.profiles.getByUsername).toHaveBeenCalledExactlyOnceWith('current-name');
    expect(screen.getByText('@current-name is available')).toBeInTheDocument();
  });

  it.each([
    ['taken', 200, 'Username is taken — try another', true],
    ['available', 404, '@current-name is available', false],
    ['network error', 503, 'Lowercase letters, numbers, _ and -', false],
  ] as const)('preserves the current lookup status mapping for %s', async (_label, status, hint, disabled) => {
    if (status === 200) auth.sdk.profiles.getByUsername.mockResolvedValue({});
    else auth.sdk.profiles.getByUsername.mockRejectedValue({ status });
    render(<PickUsernameScreen />);
    await checkUsername('current-name');
    expect(screen.getByText(hint)).toBeInTheDocument();
    if (disabled) expect(screen.getByText('Continue').parentElement).toHaveAttribute('aria-disabled', 'true');
    else expect(screen.getByText('Continue').parentElement).not.toHaveAttribute('aria-disabled', 'true');
    expect(auth.sdk.profiles.update).not.toHaveBeenCalled();
  });

  it('keeps the current available name when an older name is reported taken', async () => {
    const older = deferred();
    const current = deferred();
    auth.sdk.profiles.getByUsername
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(current.promise);
    render(<PickUsernameScreen />);

    await checkUsername('older-name');
    await checkUsername('current-name');
    await act(async () => current.reject({ status: 404 }));
    expect(screen.getByText('@current-name is available')).toBeInTheDocument();
    expect(screen.getByText('Continue').parentElement).not.toHaveAttribute('aria-disabled', 'true');

    await act(async () => older.resolve());

    expect(screen.getByPlaceholderText('yourname')).toHaveValue('current-name');
    expect(screen.getByText('@current-name is available')).toBeInTheDocument();
    expect(screen.getByText('Continue').parentElement).not.toHaveAttribute('aria-disabled', 'true');
    expect(auth.sdk.profiles.update).not.toHaveBeenCalled();
  });

  it('keeps the current taken name blocked when an older name is reported available', async () => {
    const older = deferred();
    const current = deferred();
    auth.sdk.profiles.getByUsername
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(current.promise);
    render(<PickUsernameScreen />);

    await checkUsername('older-name');
    await checkUsername('current-name');
    await act(async () => current.resolve());
    expect(screen.getByText('Username is taken — try another')).toBeInTheDocument();
    expect(screen.getByText('Continue').parentElement).toHaveAttribute('aria-disabled', 'true');

    await act(async () => older.reject({ status: 404 }));

    expect(screen.getByPlaceholderText('yourname')).toHaveValue('current-name');
    expect(screen.getByText('Username is taken — try another')).toBeInTheDocument();
    expect(screen.getByText('Continue').parentElement).toHaveAttribute('aria-disabled', 'true');
    expect(auth.sdk.profiles.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a', 'Use 3-30 chars: lowercase letters, numbers, _ or -', true],
    ['', 'Lowercase letters, numbers, _ and -', false],
    ['assigned-name', '@assigned-name is available', false],
  ] as const)('does not overwrite a newer local-only result for "%s"', async (value, hint, disabled) => {
    const older = deferred();
    auth.sdk.profiles.getByUsername.mockReturnValueOnce(older.promise);
    render(<PickUsernameScreen />);
    await checkUsername('older-name');
    fireEvent.change(screen.getByPlaceholderText('yourname'), { target: { value } });
    expect(screen.getByText(hint)).toBeInTheDocument();

    await act(async () => older.resolve());
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(screen.getByPlaceholderText('yourname')).toHaveValue(value);
    expect(screen.getByText(hint)).toBeInTheDocument();
    if (disabled) expect(screen.getByText('Continue').parentElement).toHaveAttribute('aria-disabled', 'true');
    else expect(screen.getByText('Continue').parentElement).not.toHaveAttribute('aria-disabled', 'true');
    expect(auth.sdk.profiles.getByUsername).toHaveBeenCalledExactlyOnceWith('older-name');
    expect(auth.sdk.profiles.update).not.toHaveBeenCalled();
  });
});
