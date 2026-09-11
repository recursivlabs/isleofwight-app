import type { UploadMediaInput } from '@recursiv/sdk';

interface MediaUploadSdk {
  uploads: {
    uploadMedia(input: UploadMediaInput): Promise<string>;
  };
}

export interface MediaUploadResult {
  /** Public URLs for the media that uploaded, in input order. */
  urls: string[];
  /** True when any item failed. Callers must not publish a partial post. */
  failed: boolean;
}

export interface MediaUploadOptions {
  uris: string[];
  sdk: MediaUploadSdk;
  /** Resolve the exact MIME type after reading local bytes. */
  contentTypeFor: (blob: Blob) => string;
  /** Shown to the user once per failed item. */
  onError: (message: string) => void;
  fetchImpl?: typeof fetch;
}

export interface BlobUploadOptions {
  blob: Blob;
  contentType: string;
  sdk: MediaUploadSdk;
  /** Shown to the user exactly once when the upload fails. */
  onError: (message: string) => void;
  fetchImpl?: typeof fetch;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/** Upload one caller-held blob while keeping presentation concerns in Minds. */
export async function uploadMediaBlob(opts: BlobUploadOptions): Promise<string | null> {
  try {
    return await opts.sdk.uploads.uploadMedia({
      blob: opts.blob,
      contentType: opts.contentType,
      fetchImpl: opts.fetchImpl,
    });
  } catch (error) {
    console.error('Media upload error:', error);
    opts.onError(errorMessage(error, 'The upload failed.'));
    return null;
  }
}

/**
 * Upload media in order. A partial result still sets `failed`, so the composer
 * can retain its draft instead of publishing a post with missing attachments.
 */
export async function uploadMediaBatch(opts: MediaUploadOptions): Promise<MediaUploadResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const urls: string[] = [];
  let failed = false;

  for (const uri of opts.uris) {
    try {
      const response = await doFetch(uri);
      if (response.ok === false) {
        throw new Error(`An image could not be read (${response.status}).`);
      }
      const blob = await response.blob();
      const url = await opts.sdk.uploads.uploadMedia({
        blob,
        contentType: opts.contentTypeFor(blob),
        fetchImpl: doFetch,
      });
      urls.push(url);
    } catch (error) {
      console.error('Media upload error:', error);
      opts.onError(errorMessage(error, 'An image could not be uploaded.'));
      failed = true;
    }
  }

  return { urls, failed };
}
