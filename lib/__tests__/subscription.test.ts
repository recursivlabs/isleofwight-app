import { describe, expect, it, vi } from 'vitest';
import { SITE_URL } from '../recursiv';
import { startCheckout } from '../subscription';

describe('consumer subscription checkout', () => {
  it('uses the signed-in project-scoped SDK and a bare return route', async () => {
    const checkout = vi.fn(async () => ({
      data: { url: 'https://checkout.stripe.test/session' },
    }));
    const sdk = { appSubscriptions: { checkout } } as any;

    await expect(startCheckout(sdk, 'pro')).resolves.toBe(
      'https://checkout.stripe.test/session',
    );
    expect(checkout).toHaveBeenCalledWith({
      tier: 'pro',
      return_url: `${SITE_URL}/billing`,
    });
  });

  it('does not expose server or Stripe failures directly to the member', async () => {
    const sdk = {
      appSubscriptions: {
        checkout: vi.fn(async () => {
          throw new Error('no Stripe price configured for tier pro');
        }),
      },
    } as any;

    await expect(startCheckout(sdk, 'pro')).rejects.toThrow(
      'Subscriptions are unavailable right now. Please try again shortly.',
    );
  });
});
