/**
 * Exchange a legacy Minds session token for a session on the new stack.
 * Server side: POST /api/auth/legacy-handoff (recursivlabs/recursiv#3021).
 * Every failure is a thrown error the caller turns into "show sign-in".
 */
export interface LegacySessionExchangeResult {
  sessionToken: string;
  user: { id: string; email?: string | null; name?: string | null; username?: string | null; image?: string | null };
}

export async function legacySessionExchange(
  baseOrigin: string,
  projectId: string,
  legacyToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LegacySessionExchangeResult> {
  const res = await fetchImpl(`${baseOrigin}/api/auth/legacy-handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-recursiv-app-project': projectId },
    body: JSON.stringify({ legacy_token: legacyToken }),
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err: any = new Error(body?.error || `legacy handoff failed: HTTP ${res.status}`);
    err.code = body?.code || 'legacy_handoff_failed';
    err.status = res.status;
    throw err;
  }
  const token = body?.session?.token || body?.token;
  if (typeof token !== 'string' || !body?.user?.id) {
    const err: any = new Error('legacy handoff returned no session');
    err.code = 'legacy_handoff_failed';
    throw err;
  }
  return { sessionToken: token, user: body.user };
}
