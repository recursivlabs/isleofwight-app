export const PASSWORD_RESET_FRAGMENT_KEY = 'recursiv-password-reset';
export const PASSWORD_RESET_FRAGMENT_VALUE = 'fragment-v1';

export type PasswordResetUrlState = {
  token: string | null;
  error: string | null;
  cleanPath: string;
};

/**
 * Opt into Recursiv's fragment handoff. An older API ignores the marker and
 * follows Better Auth's legacy query redirect, so deploying the app first is
 * backward compatible.
 */
export function passwordResetRedirectUrl(siteUrl: string): string {
  const url = new URL(`${siteUrl.replace(/\/+$/, '')}/reset-password`);
  const fragment = new URLSearchParams();
  fragment.set(PASSWORD_RESET_FRAGMENT_KEY, PASSWORD_RESET_FRAGMENT_VALUE);
  url.hash = fragment.toString();
  return url.toString();
}

/**
 * Read the new fragment token or an already-issued query token and return a
 * safe replacement path that keeps unrelated state but removes capabilities.
 */
export function parsePasswordResetUrl(rawUrl: string): PasswordResetUrlState | null {
  try {
    const url = new URL(rawUrl);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const token = fragment.get('token') || url.searchParams.get('token');
    const error = fragment.get('error') || url.searchParams.get('error');

    url.searchParams.delete('token');
    url.searchParams.delete('error');
    fragment.delete('token');
    fragment.delete('error');
    fragment.delete(PASSWORD_RESET_FRAGMENT_KEY);
    url.hash = fragment.toString();

    return {
      token,
      error,
      cleanPath: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}
