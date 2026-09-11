import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.hoisted(() => vi.fn());
const getPushDeviceKey = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('../monitoring', () => ({ captureException }));
vi.mock('../pushDeviceKey', () => ({ getPushDeviceKey }));

import { registerTokenWithServer } from '../notifications';

describe('push token server registration', () => {
  beforeEach(() => {
    captureException.mockReset();
    getPushDeviceKey.mockReset();
  });

  it('binds the token to this installation possession key', async () => {
    const registerToken = vi.fn().mockResolvedValue(undefined);
    getPushDeviceKey.mockResolvedValue('f'.repeat(64));

    await registerTokenWithServer({ notifications: { registerToken } }, 'ExponentPushToken[test]');

    expect(registerToken).toHaveBeenCalledWith({
      token: 'ExponentPushToken[test]',
      platform: 'web',
      device_key: 'f'.repeat(64),
    });
    expect(captureException).not.toHaveBeenCalled();
  });
});
