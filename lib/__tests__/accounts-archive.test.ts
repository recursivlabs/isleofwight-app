import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveAccount, getArchivedIds, unarchiveAccount } from '../accounts';

// The archive list is the ONLY record of this decision — v1 writes nothing to
// the server. So a failed write is the feature failing, and it used to fail
// invisibly: `archiveAccount` returned void, and the switcher moved the row into
// Archived regardless. That looks exactly like success until a reload brings the
// account back with no explanation.
//
// It matters more than a cosmetic slip because of who uses it: legacy users with
// many accounts on one email (one has 125). Archiving is bulk work, and silently
// losing part of it means redoing it without knowing which ones took.

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

const failWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('QuotaExceededError');
  });

describe('archiving reports whether it persisted', () => {
  it('archives and reads back', async () => {
    expect(await archiveAccount('u1')).toBe(true);
    expect(await getArchivedIds()).toEqual(['u1']);
  });

  it('unarchives and reads back', async () => {
    await archiveAccount('u1');
    expect(await unarchiveAccount('u1')).toBe(true);
    expect(await getArchivedIds()).toEqual([]);
  });

  it('reports FALSE when the archive write fails', async () => {
    failWrites();
    expect(await archiveAccount('u1')).toBe(false);
  });

  it('reports FALSE when the unarchive write fails', async () => {
    await archiveAccount('u1');
    failWrites();
    expect(await unarchiveAccount('u1')).toBe(false);
  });

  it('a failed archive really did not persist — the caller is not being told a lie', async () => {
    // The return value is only worth anything if it matches what is on disk.
    failWrites();
    expect(await archiveAccount('u1')).toBe(false);
    vi.restoreAllMocks();
    expect(await getArchivedIds()).toEqual([]);
  });

  it('a redundant archive reports TRUE without writing — it is already in the state asked for', async () => {
    await archiveAccount('u1');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect(await archiveAccount('u1')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a redundant unarchive reports TRUE without writing', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect(await unarchiveAccount('never-archived')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('POSITIVE CONTROL: writes succeed normally, so FALSE means something', async () => {
    // Without this, every assertion above would pass against functions that
    // always returned false, which is a different bug with the same green.
    expect(await archiveAccount('a')).toBe(true);
    expect(await archiveAccount('b')).toBe(true);
    expect(await getArchivedIds()).toEqual(['a', 'b']);
  });
});
