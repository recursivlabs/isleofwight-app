import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PUSH_DEVICE_KEY_STORAGE_KEY = 'minds_push_device_key';
const PUSH_DEVICE_KEY_BYTES = 32;
const PUSH_DEVICE_KEY_PATTERN = /^[0-9a-f]{64}$/;

let deviceKeyPromise: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function loadOrCreateDeviceKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(PUSH_DEVICE_KEY_STORAGE_KEY);
  if (stored && PUSH_DEVICE_KEY_PATTERN.test(stored)) return stored;

  const generated = bytesToHex(await Crypto.getRandomBytesAsync(PUSH_DEVICE_KEY_BYTES));
  await SecureStore.setItemAsync(PUSH_DEVICE_KEY_STORAGE_KEY, generated);

  // Notification ownership must not depend on a key that only survived in
  // memory. Verify the native secure-store write before sending it to the API.
  const readBack = await SecureStore.getItemAsync(PUSH_DEVICE_KEY_STORAGE_KEY);
  if (readBack !== generated) {
    throw new Error('Push notification device key did not persist');
  }

  return generated;
}

/** Stable possession proof held by this installation, shared across accounts. */
export function getPushDeviceKey(): Promise<string> {
  if (!deviceKeyPromise) {
    deviceKeyPromise = loadOrCreateDeviceKey().catch(error => {
      deviceKeyPromise = null;
      throw error;
    });
  }
  return deviceKeyPromise;
}
