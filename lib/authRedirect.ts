const DEFAULT_RETURN_TO = '/(tabs)';

/**
 * Accept only in-app absolute paths. Besides preventing an OAuth-style open
 * redirect, this keeps web and native on the same Expo Router destination.
 */
export function safeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate.length > 2_048) return DEFAULT_RETURN_TO;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return DEFAULT_RETURN_TO;
  if (candidate.includes('\\') || /[\u0000-\u001f\u007f]/.test(candidate)) return DEFAULT_RETURN_TO;

  try {
    const parsed = new URL(candidate, 'https://minds.local');
    if (parsed.origin !== 'https://minds.local') return DEFAULT_RETURN_TO;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

/**
 * Keep the root feed's public query state when an authenticated session passes
 * through app/index.tsx. `/` is shared by the landing and tabs index routes, so
 * the landing redirect otherwise turns `/?tab=following` back into For You.
 */
export function rootPostAuthDestination({
  returnTo,
  tab,
  posted,
}: {
  returnTo?: string | string[];
  tab?: string | string[];
  posted?: string | string[];
}): string {
  const explicitReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (explicitReturnTo) return safeReturnTo(returnTo);

  const feedTab = Array.isArray(tab) ? tab[0] : tab;
  const postedMarker = Array.isArray(posted) ? posted[0] : posted;
  const query: string[] = [];
  if (feedTab === 'following' || feedTab === 'foryou') query.push(`tab=${feedTab}`);
  if (postedMarker && /^\d{10,16}$/.test(postedMarker)) query.push(`posted=${postedMarker}`);
  return query.length > 0 ? `${DEFAULT_RETURN_TO}?${query.join('&')}` : DEFAULT_RETURN_TO;
}

export function signInPath(auth: 'otp' | 'login', returnTo: string): string {
  // `/` is represented by both app/index.tsx and app/(tabs)/index.tsx. A
  // client-side redirect from inside the tabs group can therefore resolve
  // back to the signed-out feed route instead of the landing screen, leaving
  // private deep links on an inert page with no sign-in controls. A unique
  // root-stack route makes the handoff deterministic on web and native.
  return `/auth/sign-in?auth=${auth}&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

export function otpSignInPath(returnTo: string): string {
  return signInPath('otp', returnTo);
}
