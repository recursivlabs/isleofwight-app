import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
const crypto = vi.hoisted(() => ({ getRandomBytesAsync: vi.fn() }));

vi.mock('expo-secure-store', () => secureStore);
vi.mock('expo-crypto', () => crypto);

async function loadSubject() {
  return import('../pushDeviceKey');
}

describe('push device possession key', () => {
  beforeEach(() => {
    vi.resetModules();
    secureStore.getItemAsync.mockReset();
    secureStore.setItemAsync.mockReset();
    crypto.getRandomBytesAsync.mockReset();
  });

  it('reuses the key already held by this installation', async () => {
    const stored = 'a'.repeat(64);
    secureStore.getItemAsync.mockResolvedValue(stored);

    const { getPushDeviceKey } = await loadSubject();

    await expect(getPushDeviceKey()).resolves.toBe(stored);
    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('creates 256 bits of randomness and verifies secure persistence', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const expected = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    secureStore.getItemAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(expected);
    crypto.getRandomBytesAsync.mockResolvedValue(bytes);

    const { getPushDeviceKey } = await loadSubject();

    await expect(getPushDeviceKey()).resolves.toBe(expected);
    expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('minds_push_device_key', expected);
  });

  it('refuses an in-memory-only key when secure storage drops the write', async () => {
    secureStore.getItemAsync.mockResolvedValue(null);
    crypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(7));

    const { getPushDeviceKey } = await loadSubject();

    await expect(getPushDeviceKey()).rejects.toThrow('did not persist');
  });
});
