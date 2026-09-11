/**
 * Read the legacy app's MMKV session store (id `sessionStorage`, key
 * `SESSIONS_DATA`). Any failure (module missing, no file, unreadable) is a
 * null, never a throw: the caller falls back to the sign-in screen.
 */
export async function readLegacySessionData(): Promise<string | null> {
  try {
    const mmkv = await import('react-native-mmkv');
    const store = mmkv.createMMKV({ id: 'sessionStorage' });
    const raw = store.getString('SESSIONS_DATA');
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}
