// Referral v1 — "Refer friends + earn".
// A user shares their invite link (?ref=<code>); when a friend signs up with it,
// we redeem the code so the referrer is credited (server sets the code's
// usedById = the new user; createdById = the referrer). Earning payouts on top
// of this attribution come in v2.
import { getItem, setItem } from './storage';
import { SITE_URL } from './recursiv';

const REF_KEY = 'minds:pendingRef';

// Capture ?ref=<code> from the landing URL (web) so we can attribute the signup.
export async function captureRefFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.location?.search) return false;
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref || !/^[A-Za-z0-9_-]{1,40}$/.test(ref)) return false;
    // Awaited now, and the result reported. This was fire-and-forget, so on
    // native (AsyncStorage) a fast signup could read the pending code before
    // the write landed — losing the attribution with nothing to show for it.
    // storage.setItem also reports failure now, and dropping that on the floor
    // here would reinstate exactly the silence it was changed to remove.
    return await setItem(REF_KEY, ref);
  } catch {
    return false;
  }
}

export async function getPendingRef(): Promise<string | null> {
  try { return (await getItem(REF_KEY)) || null; } catch { return null; }
}

/**
 * Clear the captured code after a SUCCESSFUL redemption. Returns whether the
 * clear actually persisted.
 *
 * `captureRefFromUrl` above was already changed from fire-and-forget to
 * awaited-and-reported. This one was left behind with the same shape it was
 * fixed from: the `setItem` was never awaited and its result discarded, so a
 * failed clear looked exactly like a successful one.
 *
 * Bounded consequence, stated honestly: redemption is server-side idempotent per
 * code, so a code that fails to clear is re-submitted on the next sign-in and
 * does nothing. What it does cost is a stale code lingering on the device and
 * being re-attempted by whoever signs up next — and, more to the point, nobody
 * being able to tell it happened.
 */
export async function clearPendingRef(): Promise<boolean> {
  try {
    return await setItem(REF_KEY, '');
  } catch {
    return false;
  }
}

// Normalize the various code shapes the SDK returns into a usable code string.
//   myCodes()  -> { data: { codes: InviteCode[] } }  (objects: {code, status, used_by, ...})
//   generate() -> { data: { codes: string[] } }      (plain code strings)
// Returns the best *shareable* code: an active, not-yet-redeemed one if present,
// otherwise the first code of any kind (still a valid link for new signups).
export function pickCode(res: any): string | null {
  const d = res?.data ?? res;
  const list = d?.codes ?? (Array.isArray(d) ? d : null);
  if (Array.isArray(list) && list.length) {
    // generate() shape: array of plain strings.
    if (typeof list[0] === 'string') {
      const firstString = list.find((c: any) => typeof c === 'string' && c.length > 0);
      return firstString ?? null;
    }
    // myCodes() shape: array of InviteCode objects. Only an active, unused,
    // unexpired code is a valid *shareable* link — returning a used/expired
    // code (e.g. for a user whose only codes are spent) yields a dead ?ref=
    // link, so fall through to generate() instead by returning null here.
    const now = Date.now();
    const active = list.find(
      (c: any) =>
        (c?.status ?? 'active') === 'active' &&
        !c?.used_by &&
        (!c?.expires_at || new Date(c.expires_at).getTime() > now),
    );
    return active?.code ?? null;
  }
  // Fallbacks for any single-object shape.
  return d?.code ?? null;
}

/** Build the URL a recipient can actually open to redeem an invite code. */
export function buildReferralLink(code: string, siteUrl = SITE_URL): string {
  return `${siteUrl.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;
}

// Get — or lazily generate — the current user's referral link.
export async function getReferralLink(sdk: any): Promise<string | null> {
  if (!sdk) return null;
  try {
    // 1. Reuse an existing code if the user already has one.
    let code = pickCode(await sdk.inviteCodes.myCodes().catch(() => null));
    // 2. Otherwise mint one. generate() returns a string[] under data.codes.
    if (!code) code = pickCode(await sdk.inviteCodes.generate(1).catch(() => null));
    if (!code) return null;
    return buildReferralLink(code);
  } catch {
    return null;
  }
}
