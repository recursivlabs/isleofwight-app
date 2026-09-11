import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn(async (_email: string, _password: string) => {}),
  signUp: vi.fn(async () => {}),
  sendOtp: vi.fn(async () => {}),
  verifyOtp: vi.fn(async () => {}),
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => auth }));

import LandingScreen from '../../app/index';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function renderPasswordForm() {
  __setLocalSearchParams({ auth: 'login', returnTo: '/post/password-return' });
  render(<LandingScreen />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Email or username' }), {
    target: { value: 'Reader' },
  });
  const password = screen.getByLabelText('Password');
  fireEvent.change(password, { target: { value: 'example-password' } });
  return password;
}

beforeEach(() => {
  auth.signIn.mockReset().mockResolvedValue(undefined);
  router.replace.mockClear();
});

describe('password login request admission', () => {
  it('allows a corrected submission after missing-field validation', async () => {
    __setLocalSearchParams({ auth: 'login', returnTo: '/post/password-return' });
    render(<LandingScreen />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log in' })));
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByText('All fields are required')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email or username' }), {
      target: { value: ' Reader@Example.COM ' },
    });
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'example-password' } });

    await act(async () => fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' }));

    expect(auth.signIn).toHaveBeenCalledExactlyOnceWith('reader@example.com', 'example-password');
    expect(screen.queryByText('All fields are required')).not.toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/post/password-return');
  });

  it('admits one request from repeated Enter and button attempts until it settles', async () => {
    const pending = deferred();
    auth.signIn.mockReturnValue(pending.promise);
    const password = renderPasswordForm();

    act(() => {
      fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    });
    const login = screen.getByRole('button', { name: 'Log in' });
    expect(login).toHaveAttribute('aria-disabled', 'true');
    expect(login).toHaveTextContent('Signing in...');
    fireEvent.click(login);
    fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' });

    expect(auth.signIn).toHaveBeenCalledExactlyOnceWith('reader@minds.com', 'example-password');
    expect(login).toHaveTextContent('Signing in...');
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(login).not.toHaveAttribute('aria-disabled', 'true');
    expect(login).toHaveTextContent('Log in');
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/post/password-return');
  });

  it('keeps failed credentials editable and allows an explicit retry', async () => {
    const pending = deferred();
    auth.signIn.mockReturnValueOnce(pending.promise);
    const password = renderPasswordForm();
    fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveTextContent('Signing in...');

    await act(async () => pending.reject(new Error('Temporary sign-in failure')));

    expect(screen.getByText('Temporary sign-in failure')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email or username' })).toHaveValue('Reader');
    expect(password).toHaveValue('example-password');
    expect(screen.getByRole('button', { name: 'Log in' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => fireEvent.keyDown(password, { key: 'Enter', code: 'Enter' }));

    expect(auth.signIn).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Temporary sign-in failure')).not.toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/post/password-return');
  });

  it('normally signs in using the existing username mapping and return path', async () => {
    renderPasswordForm();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log in' })));

    expect(auth.signIn).toHaveBeenCalledExactlyOnceWith('reader@minds.com', 'example-password');
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/post/password-return');
  });
});
