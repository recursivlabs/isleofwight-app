import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  legacySignInEmail: null as string | null,
  signIn: vi.fn(async () => {}),
  signUp: vi.fn(async () => {}),
  sendOtp: vi.fn(async () => {}),
  verifyOtp: vi.fn(async () => {}),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock,
}));

import LandingScreen from '../../app/index';

describe('landing authentication return path', () => {
  // `delay: null` skips the macrotask user-event awaits between keystrokes at
  // its default delay of 0. These tests drive a 1,100-line screen, so every
  // keystroke is a full re-render and the waiting dominated the runtime.
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    authMock.isAuthenticated = false;
    authMock.isLoading = false;
    authMock.legacySignInEmail = null;
    authMock.sendOtp.mockReset();
    authMock.sendOtp.mockResolvedValue(undefined);
  });

  it('puts the email field on the landing itself, with quiet password and explore links', async () => {
    __setLocalSearchParams({});
    render(<LandingScreen />);

    expect(screen.getByRole('heading', { level: 1, name: 'think freely' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Community Guidelines' })).not.toBeInTheDocument();
    expect(screen.queryByText('Build your feed. Build your agents. Own your network.')).not.toBeInTheDocument();

    const usePassword = screen.getByRole('button', { name: 'Use password instead' });
    usePassword.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use email code instead' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('prefills the returning member email when legacy handoff needs OTP', () => {
    authMock.legacySignInEmail = 'returning@minds.com';
    __setLocalSearchParams({});

    render(<LandingScreen />);

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('returning@minds.com');
    expect(authMock.sendOtp).not.toHaveBeenCalled();
  });

  it('exposes public discovery as a real web link without starting authentication', () => {
    __setLocalSearchParams({});
    render(<LandingScreen />);

    const explore = screen.getByRole('link', { name: 'Explore Minds without signing in' });

    expect(explore).toHaveAttribute('href', '/discover');
    expect(authMock.sendOtp).not.toHaveBeenCalled();
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it('identifies password credentials to browsers and assistive technology', () => {
    __setLocalSearchParams({ auth: 'login' });
    render(<LandingScreen />);

    const username = screen.getByRole('textbox', { name: 'Email or username' });
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(username).toHaveAttribute('id', 'username');

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('id', 'password');
  });

  it('associates OTP email validation with the invalid field', async () => {
    __setLocalSearchParams({ auth: 'otp' });
    render(<LandingScreen />);

    const email = screen.getByRole('textbox', { name: 'Email' });
    await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));

    expect(screen.getByText('Enter a valid email')).toHaveAttribute('id', 'otp-email-error');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'otp-email-error');
  });

  it('keeps each missing password credential associated until that field is corrected', async () => {
    __setLocalSearchParams({ auth: 'login' });
    render(<LandingScreen />);

    const username = screen.getByRole('textbox', { name: 'Email or username' });
    const password = screen.getByLabelText('Password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('All fields are required')).toHaveAttribute('id', 'password-login-error');
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username).toHaveAttribute('aria-describedby', 'password-login-error');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-describedby', 'password-login-error');

    await user.type(username, 'reader');

    expect(username).not.toHaveAttribute('aria-invalid');
    expect(username).not.toHaveAttribute('aria-describedby');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('All fields are required')).toBeInTheDocument();
  });

  it('associates one-time-code validation with the code field', async () => {
    __setLocalSearchParams({ auth: 'otp' });
    render(<LandingScreen />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter the 6-digit code')).toHaveAttribute('id', 'otp-code-error');
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAttribute('aria-describedby', 'otp-code-error');
  });

  it('confirms that a replacement OTP was sent', async () => {
    __setLocalSearchParams({ auth: 'otp' });
    render(<LandingScreen />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    await user.click(await screen.findByRole('button', { name: 'Resend code' }));

    expect(await screen.findByText('New code sent.')).toBeInTheDocument();
    expect(authMock.sendOtp).toHaveBeenCalledTimes(2);
  });

  it('surfaces resend failures without marking the OTP itself invalid', async () => {
    authMock.sendOtp
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Please wait before requesting another code.'));
    __setLocalSearchParams({ auth: 'otp' });
    render(<LandingScreen />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    await user.click(screen.getByRole('button', { name: 'Resend code' }));

    expect(await screen.findByText('Please wait before requesting another code.')).toBeInTheDocument();
    expect(code).not.toHaveAttribute('aria-invalid');
    expect(code).not.toHaveAttribute('aria-describedby');
    expect(authMock.sendOtp).toHaveBeenCalledTimes(2);
  });

  it('opens the OTP form and returns to the public post after verification', async () => {
    __setLocalSearchParams({ auth: 'otp', returnTo: '/post/post-1' });
    render(<LandingScreen />);

    expect(screen.getByText('Continue with email')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Email'), 'reader@example.com');
    await user.click(screen.getByText('Send code'));

    await user.type(await screen.findByPlaceholderText('000000'), '123456');
    await user.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(authMock.verifyOtp).toHaveBeenCalledWith('reader@example.com', '123456');
      expect(router.replace).toHaveBeenCalledWith('/post/post-1');
    });
    // This one renders the whole landing screen and drives 24 keystrokes across
    // two forms. At vitest's 5s default it timed out whenever the suite ran
    // under load — a false failure that said nothing about the code.
  }, 20000);

  it('keeps a Following deep link when restoring an authenticated session at root', async () => {
    authMock.isAuthenticated = true;
    __setLocalSearchParams({ tab: 'following', posted: '1787960824781' });

    render(<LandingScreen />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(tabs)?tab=following&posted=1787960824781');
    });
  });
});
