export type CredentialKind = 'api_key' | 'better_auth_session';

interface RevokeStoredCredentialsInput {
  apiKey: string | null;
  sessionToken: string | null;
  revokeApiKey: (apiKey: string) => Promise<unknown>;
  revokeSession: (sessionToken: string) => Promise<unknown>;
}

/**
 * Revoke every server credential this app persists for the account being left.
 * Each attempt is isolated so one unavailable auth surface cannot skip the
 * other. Local erasure remains the caller's responsibility and always runs.
 */
export async function revokeStoredCredentials({
  apiKey,
  sessionToken,
  revokeApiKey,
  revokeSession,
}: RevokeStoredCredentialsInput): Promise<CredentialKind[]> {
  const attempts: Array<{ kind: CredentialKind; run: () => Promise<unknown> }> = [];
  if (apiKey) attempts.push({ kind: 'api_key', run: () => revokeApiKey(apiKey) });
  if (sessionToken) {
    attempts.push({
      kind: 'better_auth_session',
      run: () => revokeSession(sessionToken),
    });
  }

  const results = await Promise.allSettled(
    attempts.map(({ run }) => Promise.resolve().then(run)),
  );
  return results.flatMap((result, index) =>
    result.status === 'rejected' ? [attempts[index].kind] : []);
}
