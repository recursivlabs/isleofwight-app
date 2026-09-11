// Consumer Plus/Pro subscriptions. The project-scoped SDK resource always acts
// for the signed-in app user; callers cannot choose a user, organization, or
// Stripe customer. The billing webhook flips app_subscription, which the video
// primitive (and other gates) read for tier.
import { Platform, Linking } from 'react-native';
import type { Minds } from '@minds/sdk';
import { SITE_URL } from './recursiv';

export type PaidTier = 'plus' | 'pro';

/**
 * Begin a checkout for a paid tier. Returns the Stripe Checkout URL on success.
 * The server appends its success/cancel parameters, so the return URL must be
 * the bare Billing route rather than an already-parameterized URL.
 */
export async function startCheckout(sdk: Minds, tier: PaidTier): Promise<string> {
  try {
    const result = await sdk.appSubscriptions.checkout({
      tier,
      return_url: `${SITE_URL}/billing`,
    });
    const url = result?.data?.url;
    if (!url) throw new Error('missing checkout url');
    return url;
  } catch {
    throw new Error('Subscriptions are unavailable right now. Please try again shortly.');
  }
}

/** Start checkout and send the user to Stripe in the current web/native flow. */
export async function openCheckout(sdk: Minds, tier: PaidTier): Promise<void> {
  const url = await startCheckout(sdk, tier);
  if (Platform.OS === 'web') {
    // Same-tab redirect keeps the Stripe return flow simple.
    window.location.href = url;
  } else {
    await Linking.openURL(url);
  }
}
