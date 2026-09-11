import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystem = vi.hoisted(() => ({
  documentDirectory: '/documents/',
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  downloadAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));
const monitoring = vi.hoisted(() => ({ captureMessage: vi.fn() }));

vi.mock('expo-file-system/legacy', () => fileSystem);
vi.mock('../../monitoring', () => monitoring);

async function loadDownloads() {
  vi.resetModules();
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  await storage.clear();
  return {
    storage,
    downloads: await import('../downloads.native'),
  };
}

beforeEach(() => {
  fileSystem.getInfoAsync.mockReset().mockResolvedValue({ exists: true });
  fileSystem.makeDirectoryAsync.mockReset().mockResolvedValue(undefined);
  fileSystem.downloadAsync.mockReset();
  fileSystem.deleteAsync.mockReset().mockResolvedValue(undefined);
  monitoring.captureMessage.mockReset();
});

describe('native offline download account isolation', () => {
  it('clears the persisted index, files, and hydrated in-memory map', async () => {
    vi.resetModules();
    const storage = (await import('@react-native-async-storage/async-storage')).default;
    await storage.clear();
    await storage.setItem(
      'minds.audio.downloads.v1',
      JSON.stringify({ track1: '/documents/audio-downloads/track1.audio' }),
    );
    const downloads = await import('../downloads.native');

    expect(await downloads.getLocalUri('track1'))
      .toBe('/documents/audio-downloads/track1.audio');

    await downloads.clearAllDownloads();

    expect(await downloads.getLocalUri('track1')).toBeNull();
    expect(downloads.downloadStatus('track1')).toBe('none');
    expect(await storage.getItem('minds.audio.downloads.v1')).toBeNull();
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      '/documents/audio-downloads/',
      { idempotent: true },
    );
  });

  it('does not let a download finishing after sign-out repopulate the next account', async () => {
    const { storage, downloads } = await loadDownloads();
    let finishDownload!: (value: { status: number; uri: string }) => void;
    fileSystem.downloadAsync.mockReturnValue(new Promise(resolve => {
      finishDownload = resolve;
    }));

    const pending = downloads.downloadTrack({
      id: 'private-track',
      title: 'Private track',
      artist: 'Previous account',
      url: 'https://legacy.example/private.mp3',
    });
    await vi.waitFor(() => expect(fileSystem.downloadAsync).toHaveBeenCalledOnce());

    await downloads.clearAllDownloads();
    finishDownload({
      status: 200,
      uri: '/documents/audio-downloads/private-track.audio',
    });
    await pending;

    expect(await downloads.getLocalUri('private-track')).toBeNull();
    expect(await storage.getItem('minds.audio.downloads.v1')).toBeNull();
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      '/documents/audio-downloads/private-track.audio',
      { idempotent: true },
    );
  });

  it('surfaces a failed disk clear while still dropping the in-memory map', async () => {
    vi.resetModules();
    const storage = (await import('@react-native-async-storage/async-storage')).default;
    await storage.clear();
    await storage.setItem(
      'minds.audio.downloads.v1',
      JSON.stringify({ track1: '/documents/audio-downloads/track1.audio' }),
    );
    const downloads = await import('../downloads.native');
    expect(await downloads.getLocalUri('track1')).not.toBeNull();
    vi.spyOn(storage, 'removeItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(downloads.clearAllDownloads())
      .rejects.toThrow('Failed to clear 1 offline download surface(s)');
    expect(await downloads.getLocalUri('track1')).toBeNull();
  });
});
