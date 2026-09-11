// Multi-account support. Legacy Minds users often have MANY accounts under one
// real email (one user has 125). After OTP login the app lists every account on
// the email and lets the user switch between them, X-style.
//
// The switch itself lives in lib/auth.tsx (it has to swap the active identity via
// persistSession). This module owns the read-only sibling listing plus the
// CLIENT-SIDE archive state (v1: hidden ids stored locally, no server writes).

import type { Minds, SiblingAccount } from '@minds/sdk';
import * as storage from './storage';

const KEYS = {
  archived: 'minds:archived_accounts',
};

export type { SiblingAccount } from '@minds/sdk';

/**
 * Fetch every account that shares the current user's real email. The server
 * returns them already sorted real-accounts-first with test-looking accounts
 * flagged (`looks_like_test`).
 */
export async function getSiblingAccounts(sdk: Minds | null): Promise<SiblingAccount[]> {
  if (!sdk) return [];
  const response = await sdk.accounts.listSiblings();
  return response.data;
}

// --- Client-side archive (v1) ---------------------------------------------
// Archiving is purely local for now: we keep a JSON array of user ids the user
// has chosen to hide from their switcher. Nothing is written to the server.

export async function getArchivedIds(): Promise<string[]> {
  const raw = await storage.getItem(KEYS.archived);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Both return whether the change was actually persisted.
//
// The archive list is the ONLY record of this decision — v1 writes nothing to
// the server — so a failed write is the whole feature failing. The switcher used
// to move the row into Archived regardless, which looks identical to success
// until a reload brings the account back with no explanation. That matters more
// here than it sounds: this module exists because legacy users have many accounts
// on one email (one has 125), so archiving is bulk work, and silently losing some
// of it means doing it again without knowing which ones took.
export async function archiveAccount(id: string): Promise<boolean> {
  const ids = await getArchivedIds();
  if (ids.includes(id)) return true; // already archived — nothing to write
  return storage.setItem(KEYS.archived, JSON.stringify([...ids, id]));
}

export async function unarchiveAccount(id: string): Promise<boolean> {
  const ids = await getArchivedIds();
  if (!ids.includes(id)) return true; // already absent — nothing to write
  return storage.setItem(KEYS.archived, JSON.stringify(ids.filter(x => x !== id)));
}
