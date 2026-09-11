import { describe, expect, it, vi } from 'vitest';
import { accountExportFilename, saveAccountExportForWeb } from '../accountExport';

describe('account export downloads', () => {
  it('uses regular and encoded server filenames', () => {
    expect(accountExportFilename('attachment; filename="minds-export-2026-08-23.zip"'))
      .toBe('minds-export-2026-08-23.zip');
    expect(accountExportFilename("attachment; filename*=UTF-8''Minds%20archive.zip"))
      .toBe('Minds archive.zip');
  });

  it('prevents Content-Disposition from creating a path', () => {
    expect(accountExportFilename('attachment; filename="../../private-data"'))
      .toBe('private-data.zip');
    expect(accountExportFilename(null)).toBe('minds-account-export.zip');
  });

  it('downloads the ZIP on web and revokes its object URL after the click', async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendAnchor = vi.fn();
    const revokeObjectURL = vi.fn();
    let deferred: (() => void) | undefined;
    const anchor = { href: '', download: '', style: {}, click, remove };
    const response = new Response(new Blob(['zip bytes']), {
      headers: { 'Content-Disposition': 'attachment; filename="my-minds.zip"' },
    });

    const filename = await saveAccountExportForWeb(response, {
      createObjectURL: vi.fn(() => 'blob:account-export'),
      revokeObjectURL,
      createAnchor: () => anchor,
      appendAnchor,
      defer: callback => { deferred = callback; },
    });

    expect(filename).toBe('my-minds.zip');
    expect(anchor).toMatchObject({ href: 'blob:account-export', download: 'my-minds.zip' });
    expect(appendAnchor).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    deferred?.();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:account-export');
  });
});
