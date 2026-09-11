/**
 * The legacy Minds app (gitlab minds/mobile-native) kept its sessions in an
 * MMKV store with id `sessionStorage` under the key `SESSIONS_DATA`. Because
 * Minds 2.0 ships as an update of the same app, that file is still on the
 * device after the update. This module turns that JSON into the one token
 * the handoff needs. Pure, so it is unit tested without a device.
 */

export interface LegacySessionToken {
  token: string;
  guid: string | null;
  username: string | null;
  email: string | null;
  authType: 'oauth' | 'cookie';
}

function readEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.includes('@') && !/\s/.test(email) ? email : null;
}

/** Legacy `AuthType` enum: 0 = OAuth, 1 = Cookie (minds_sess JWT sent as a bearer). */
export function pickLegacyToken(raw: string | null | undefined): LegacySessionToken | null {
  if (!raw) return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const sessions: any[] = Array.isArray(data?.tokensData) ? data.tokensData : [];
  if (sessions.length === 0) return null;
  const index = Number.isInteger(data?.activeIndex) && data.activeIndex >= 0 && data.activeIndex < sessions.length ? data.activeIndex : 0;
  const session = sessions[index];
  if (!session || typeof session !== 'object') return null;

  const guid = typeof session.user?.guid === 'string' ? session.user.guid : null;
  const username = typeof session.user?.username === 'string' ? session.user.username : null;
  // The legacy store keeps the last rendered user alongside the credential.
  // This is only a sign-in-form hint when handoff fails; it never authenticates
  // the person or changes which account the server resolves.
  const email = readEmail(session.user?.email ?? session.email);

  if (session.authType === 1 && typeof session.sessionToken === 'string' && session.sessionToken.length > 16) {
    return { token: session.sessionToken, guid, username, email, authType: 'cookie' };
  }
  const access = session.accessToken?.access_token;
  if (typeof access === 'string' && access.length > 16) {
    return { token: access, guid, username, email, authType: 'oauth' };
  }
  return null;
}
