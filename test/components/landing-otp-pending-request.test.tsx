import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn(async () => {}),
  signUp: vi.fn(async () => {}),
  sendOtp: vi.fn(async (_email: string) => {}),
  verifyOtp: vi.fn(async (_email: string, _code: string) => {}),
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => auth }));

import LandingScreen from '../../app/index';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function openEmailForm(mode: 'home' | 'otp' = 'otp') {
  __setLocalSearchParams(mode === 'otp'
    ? { auth: 'otp', returnTo: '/post/otp-return' }
    : { returnTo: '/post/otp-return' });
  const view = render(<LandingScreen />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'first@example.com' },
  });
  // Settle completed sends and their new controls before the next interaction.
  // Deferred responses remain pending so ownership tests still control them.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  });
  return view;
}

beforeEach(() => {
  auth.sendOtp.mockReset().mockResolvedValue(undefined);
  auth.verifyOtp.mockReset().mockResolvedValue(undefined);
});

describe('OTP request ownership on the landing screen', () => {
  it('normally verifies the email that received the code and preserves the return path', async () => {
    await openEmailForm();
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    expect(auth.sendOtp).toHaveBeenCalledWith('first@example.com');
    expect(screen.getByText('We sent a 6-digit code to first@example.com')).toBeInTheDocument();

    fireEvent.change(code, { target: { value: '123456' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));

    expect(auth.verifyOtp).toHaveBeenCalledWith('first@example.com', '123456');
    expect(router.replace).toHaveBeenCalledWith('/post/otp-return');
  });

  it.each(['home', 'otp'] as const)('does not claim a pending request sent a code to a newly edited email (%s form)', async (mode) => {
    const request = deferred();
    auth.sendOtp.mockImplementationOnce(() => request.promise);
    await openEmailForm(mode);
    expect(auth.sendOtp).toHaveBeenCalledWith('first@example.com');

    const email = screen.getByRole('textbox', { name: 'Email' });
    fireEvent.change(email, { target: { value: 'newer@example.com' } });
    expect(email).toHaveValue('newer@example.com');
    await act(async () => request.resolve());

    expect(screen.queryByText('We sent a 6-digit code to newer@example.com')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('newer@example.com');
    expect(screen.queryByRole('textbox', { name: 'One-time code' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    expect(auth.sendOtp).toHaveBeenLastCalledWith('newer@example.com');
    fireEvent.change(code, { target: { value: '654321' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith('newer@example.com', '654321');
  });

  it.each([true, false])('preserves a homepage request when the equivalent OTP route hydrates (success: %s)', async (succeeds) => {
    const request = deferred();
    auth.sendOtp.mockReturnValueOnce(request.promise);
    const view = await openEmailForm('home');
    expect(auth.sendOtp).toHaveBeenCalledExactlyOnceWith('first@example.com');
    __setLocalSearchParams({ auth: 'otp', returnTo: '/post/otp-return' });
    view.rerender(<LandingScreen />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('first@example.com');
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toHaveAttribute('aria-disabled', 'true');
    if (succeeds) {
      await act(async () => request.resolve());
      expect(await screen.findByRole('textbox', { name: 'One-time code' })).toBeInTheDocument();
      expect(screen.getByText('We sent a 6-digit code to first@example.com')).toBeInTheDocument();
    } else {
      await act(async () => request.reject(new Error('Hydrated request failed')));
      expect(await screen.findByText('Hydrated request failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send sign-in code' })).not.toHaveAttribute('aria-disabled', 'true');
    }
    expect(auth.sendOtp).toHaveBeenCalledOnce();
  });

  it('still invalidates a homepage request when the password route hydrates', async () => {
    const request = deferred();
    auth.sendOtp.mockReturnValueOnce(request.promise);
    const view = await openEmailForm('home');
    __setLocalSearchParams({ auth: 'login', returnTo: '/post/otp-return' });
    view.rerender(<LandingScreen />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    await act(async () => request.resolve());
    expect(screen.queryByRole('textbox', { name: 'One-time code' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('does not reopen verification after the user switches to password login during a pending request', async () => {
    const request = deferred();
    auth.sendOtp.mockImplementationOnce(() => request.promise);
    await openEmailForm();
    fireEvent.click(screen.getByRole('button', { name: 'Log in with password instead' }));
    expect(screen.getByLabelText('Password')).toBeInTheDocument();

    await act(async () => request.resolve());

    expect(screen.queryByRole('textbox', { name: 'One-time code' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('does not let an old visit finish or unlock a newer request after switching away and back', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    auth.sendOtp.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    await openEmailForm();
    fireEvent.click(screen.getByRole('button', { name: 'Log in with password instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use email code instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    expect(auth.sendOtp).toHaveBeenCalledTimes(2);

    await act(async () => oldRequest.resolve());
    expect(screen.queryByRole('textbox', { name: 'One-time code' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toHaveAttribute('aria-disabled', 'true');

    await act(async () => newRequest.resolve());
    expect(await screen.findByRole('textbox', { name: 'One-time code' })).toBeInTheDocument();
    expect(screen.getByText('We sent a 6-digit code to first@example.com')).toBeInTheDocument();
  });

  it('admits only one send from repeated Enter and button submits', async () => {
    const request = deferred();
    auth.sendOtp.mockReturnValueOnce(request.promise);
    await openEmailForm();
    const email = screen.getByRole('textbox', { name: 'Email' });
    act(() => {
      fireEvent.keyDown(email, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(email, { key: 'Enter', code: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    });
    expect(auth.sendOtp).toHaveBeenCalledOnce();
    await act(async () => request.resolve());
    expect(await screen.findByRole('textbox', { name: 'One-time code' })).toBeInTheDocument();
  });

  it('ignores a failed send for a superseded email and keeps the new draft retryable', async () => {
    const request = deferred();
    auth.sendOtp.mockReturnValueOnce(request.promise);
    await openEmailForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'newer@example.com' } });
    await act(async () => request.reject(new Error('Old address request failed')));
    expect(screen.queryByText('Old address request failed')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('newer@example.com');
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps ordinary send failures visible and retryable', async () => {
    auth.sendOtp.mockRejectedValueOnce(new Error('Please try again'));
    await openEmailForm();
    expect(await screen.findByText('Please try again')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('first@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    expect(await screen.findByRole('textbox', { name: 'One-time code' })).toBeInTheDocument();
    expect(auth.sendOtp).toHaveBeenCalledTimes(2);
  });

  it('uses the accepted normalized email for delivery, display, resend and verification', async () => {
    __setLocalSearchParams({ auth: 'otp' });
    render(<LandingScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: ' Reader@Example.COM ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    });
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    expect(auth.sendOtp).toHaveBeenCalledExactlyOnceWith('reader@example.com');
    expect(screen.getByText('We sent a 6-digit code to reader@example.com')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resend code' })));
    expect(auth.sendOtp).toHaveBeenLastCalledWith('reader@example.com');
    fireEvent.change(code, { target: { value: '123456' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith('reader@example.com', '123456');
  });

  it('ignores a resend failure after returning to email and accepting a new address', async () => {
    await openEmailForm();
    await screen.findByRole('textbox', { name: 'One-time code' });
    const resend = deferred();
    auth.sendOtp.mockReturnValueOnce(resend.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(auth.sendOtp).toHaveBeenLastCalledWith('first@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Back to email' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'newer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    expect(await screen.findByRole('textbox', { name: 'One-time code' })).toBeInTheDocument();
    expect(screen.getByText('We sent a 6-digit code to newer@example.com')).toBeInTheDocument();

    await act(async () => resend.reject(new Error('Old resend failed')));
    expect(screen.queryByText('Old resend failed')).not.toBeInTheDocument();
  });

  it('admits one verification and preserves its accepted email and return path', async () => {
    await openEmailForm();
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    fireEvent.change(code, { target: { value: '123456' } });
    const verify = deferred();
    auth.verifyOtp.mockReturnValueOnce(verify.promise);
    act(() => {
      fireEvent.keyDown(code, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(code, { key: 'Enter', code: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith('first@example.com', '123456');
    await act(async () => verify.resolve());
    await waitFor(() => expect(router.replace).toHaveBeenCalledExactlyOnceWith('/post/otp-return'));
  });

  it('does not let an old verification error affect a newer email request', async () => {
    await openEmailForm();
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    fireEvent.change(code, { target: { value: '123456' } });
    const verify = deferred();
    auth.verifyOtp.mockReturnValueOnce(verify.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to email' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'newer@example.com' } });
    const request = deferred();
    auth.sendOtp.mockReturnValueOnce(request.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
    expect(auth.sendOtp).toHaveBeenCalledTimes(2);

    await act(async () => verify.reject(new Error('Old verification failed')));
    expect(screen.queryByText('Old verification failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send sign-in code' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('newer@example.com');
    await act(async () => request.resolve());
    expect(await screen.findByText('We sent a 6-digit code to newer@example.com')).toBeInTheDocument();
  });

  it('holds verification during resend and releases it for the accepted email afterwards', async () => {
    await openEmailForm();
    const code = await screen.findByRole('textbox', { name: 'One-time code' });
    fireEvent.change(code, { target: { value: '123456' } });
    const resend = deferred();
    auth.sendOtp.mockReturnValueOnce(resend.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    fireEvent.keyDown(code, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(auth.verifyOtp).not.toHaveBeenCalled();

    await act(async () => resend.resolve());
    expect(await screen.findByText('New code sent.')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith('first@example.com', '123456');
  });
});
