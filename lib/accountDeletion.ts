export type DeletionChallenge = 'confirm_text' | 'password';

/**
 * Minds is OTP-first, so most people have no password to enter. The platform
 * accepts an explicit DELETE confirmation for those accounts and asks for a
 * password only when the account actually has one.
 */
export function deletionRequest(challenge: DeletionChallenge, value: string) {
  return challenge === 'password'
    ? { password: value, reason: 'User requested' }
    : { confirm_text: value, reason: 'User requested' };
}

export function deletionRequiresPassword(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'password_required';
}
