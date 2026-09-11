import { describe, expect, it } from 'vitest';
import { deletionRequest, deletionRequiresPassword } from '../accountDeletion';

describe('account deletion confirmation', () => {
  it('uses the supported text confirmation for OTP-only accounts', () => {
    expect(deletionRequest('confirm_text', 'DELETE')).toEqual({
      confirm_text: 'DELETE',
      reason: 'User requested',
    });
  });

  it('retries with a password only when the platform says one exists', () => {
    expect(deletionRequiresPassword({ code: 'password_required' })).toBe(true);
    expect(deletionRequest('password', 'known-password')).toEqual({
      password: 'known-password',
      reason: 'User requested',
    });
    expect(deletionRequiresPassword({ code: 'confirmation_required' })).toBe(false);
  });
});
