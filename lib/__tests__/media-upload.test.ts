import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadMediaBatch, uploadMediaBlob } from '../mediaUpload';

const PUBLIC = 'https://cdn.example.com/img.jpg';

function sdkWith(...results: Array<string | Error>) {
  const uploadMedia = vi.fn();
  for (const result of results) {
    if (result instanceof Error) uploadMedia.mockRejectedValueOnce(result);
    else uploadMedia.mockResolvedValueOnce(result);
  }
  return { sdk: { uploads: { uploadMedia } }, uploadMedia };
}

function sourceFetch(type = 'image/jpeg') {
  return vi.fn().mockImplementation(() => new Response('media bytes', {
    status: 200,
    headers: { 'Content-Type': type },
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadMediaBlob', () => {
  it('delegates the complete transfer to the SDK', async () => {
    const { sdk, uploadMedia } = sdkWith(PUBLIC);
    const blob = new Blob(['voice'], { type: 'audio/webm' });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const onError = vi.fn();

    await expect(uploadMediaBlob({
      blob,
      contentType: 'audio/webm',
      sdk,
      fetchImpl,
      onError,
    })).resolves.toBe(PUBLIC);

    expect(uploadMedia).toHaveBeenCalledExactlyOnceWith({
      blob,
      contentType: 'audio/webm',
      fetchImpl,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns null and reports an SDK failure exactly once', async () => {
    const { sdk } = sdkWith(new Error('Media upload failed (HTTP 503).'));
    const onError = vi.fn();

    await expect(uploadMediaBlob({
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      contentType: 'audio/webm',
      sdk,
      onError,
    })).resolves.toBeNull();

    expect(onError).toHaveBeenCalledExactlyOnceWith('Media upload failed (HTTP 503).');
  });
});

describe('uploadMediaBatch', () => {
  it('reads local media, preserves its MIME type, and delegates the transfer', async () => {
    const { sdk, uploadMedia } = sdkWith(PUBLIC);
    const fetchImpl = sourceFetch('image/png');
    const onError = vi.fn();

    await expect(uploadMediaBatch({
      uris: ['file:///photo.png'],
      sdk,
      contentTypeFor: (blob) => blob.type || 'image/jpeg',
      fetchImpl,
      onError,
    })).resolves.toEqual({ urls: [PUBLIC], failed: false });

    expect(uploadMedia).toHaveBeenCalledExactlyOnceWith({
      blob: expect.objectContaining({ size: 11, type: 'image/png' }),
      contentType: 'image/png',
      fetchImpl,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('marks a partial upload as failed so the post is not published', async () => {
    const { sdk } = sdkWith(PUBLIC, new Error('second image failed'));
    const fetchImpl = sourceFetch();
    const onError = vi.fn();

    await expect(uploadMediaBatch({
      uris: ['file:///one.jpg', 'file:///two.jpg'],
      sdk,
      contentTypeFor: (blob) => blob.type || 'image/jpeg',
      fetchImpl,
      onError,
    })).resolves.toEqual({ urls: [PUBLIC], failed: true });

    expect(onError).toHaveBeenCalledExactlyOnceWith('second image failed');
  });

  it('reports every failed item rather than hiding later failures', async () => {
    const { sdk } = sdkWith(new Error('first failed'), new Error('second failed'));
    const onError = vi.fn();

    const result = await uploadMediaBatch({
      uris: ['file:///one.jpg', 'file:///two.jpg'],
      sdk,
      contentTypeFor: (blob) => blob.type || 'image/jpeg',
      fetchImpl: sourceFetch(),
      onError,
    });

    expect(result).toEqual({ urls: [], failed: true });
    expect(onError).toHaveBeenNthCalledWith(1, 'first failed');
    expect(onError).toHaveBeenNthCalledWith(2, 'second failed');
  });

  it('does not invoke the SDK when local media cannot be read', async () => {
    const { sdk, uploadMedia } = sdkWith(PUBLIC);
    const onError = vi.fn();

    const result = await uploadMediaBatch({
      uris: ['https://files.example/missing.jpg'],
      sdk,
      contentTypeFor: (blob) => blob.type || 'image/jpeg',
      fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch,
      onError,
    });

    expect(result).toEqual({ urls: [], failed: true });
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith('An image could not be read (404).');
  });
});
