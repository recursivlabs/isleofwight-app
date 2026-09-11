import { describe, expect, it } from 'vitest';
import { isLegacyMembership, periodLabel, portalErrorMessage, statusLabel } from '../lib/billingLabels';

describe('billing labels for a legacy membership', () => {
  const legacy = { status: 'legacy', active: true, tier: 'plus', currentPeriodEnd: '2125-02-05T18:14:52.000Z', source: 'legacy' };

  it('reads Active like any other membership, with no history', () => {
    expect(isLegacyMembership(legacy)).toBe(true);
    expect(statusLabel(legacy, 'plus')).toBe('Active');
    expect(statusLabel({ status: 'active', active: true, tier: 'plus' }, 'plus')).toBe('Active');
    expect(statusLabel(null, 'free')).toBe('Free plan');
  });

  it('calls a far-future legacy expiry Lifetime and a near one Active through', () => {
    expect(periodLabel(legacy)).toBe('Lifetime');
    expect(periodLabel({ ...legacy, currentPeriodEnd: '2027-03-01T00:00:00.000Z' })).toMatch(/^Active through /);
    expect(periodLabel({ status: 'active', currentPeriodEnd: '2027-03-01T00:00:00.000Z' })).toMatch(/^Current period ends /);
    expect(periodLabel({ status: 'active', currentPeriodEnd: null })).toBeNull();
  });

  it('turns the portal 409 into a plain state and keeps the generic message otherwise', () => {
    expect(portalErrorMessage({ code: 'legacy_membership', message: 'anything the server says' })).toBe('Nothing to change here yet.');
    expect(portalErrorMessage({ status: 409, message: 'Conflict' })).toBe('Nothing to change here yet.');
    expect(portalErrorMessage(new Error('boom'))).toBe('Could not open subscription management. Please try again.');
  });
});
