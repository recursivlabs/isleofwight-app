export type EmailChangeUrlState = {
  token: string | null;
  cleanPath: string;
};

/**
 * Read an email-change capability from a fragment (preferred) or a legacy
 * query string, then return a browser-history path with that capability
 * removed. Verification still requires the signed-in account that requested
 * the change.
 */
export function parseEmailChangeUrl(rawUrl: string): EmailChangeUrlState | null {
  try {
    const url = new URL(rawUrl);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const token = fragment.get('token') || url.searchParams.get('token');

    url.searchParams.delete('token');
    fragment.delete('token');
    url.hash = fragment.toString();

    return {
      token,
      cleanPath: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}
