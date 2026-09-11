import { Platform } from 'react-native';

const DEFAULT_EXPORT_FILENAME = 'minds-account-export.zip';

type ExportPlatform = typeof Platform.OS | 'web' | 'ios' | 'android';

type WebDownloadEnvironment = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): {
    href: string;
    download: string;
    style: { display?: string };
    click(): void;
    remove(): void;
  };
  appendAnchor(anchor: ReturnType<WebDownloadEnvironment['createAnchor']>): void;
  defer(callback: () => void): void;
};

function decodeFilename(value: string): string {
  const unquoted = value.trim().replace(/^"|"$/g, '');
  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
}

function safeZipFilename(value: string): string {
  // Content-Disposition is server-controlled today, but treating it as an
  // untrusted filename prevents a future proxy or API change from creating a
  // path on native or a misleading browser download name.
  const leaf = value.split(/[\\/]/).pop() || '';
  const withoutControls = Array.from(leaf, character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? '-' : character;
  }).join('');
  const safe = withoutControls
    .replace(/[<>:"|?*]/g, '-')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim();

  if (!safe) return DEFAULT_EXPORT_FILENAME;
  const withExtension = safe.toLowerCase().endsWith('.zip') ? safe : `${safe}.zip`;
  return withExtension.slice(-160);
}

/** Resolve RFC 5987 and regular Content-Disposition filenames safely. */
export function accountExportFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return DEFAULT_EXPORT_FILENAME;

  const encoded = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1];
  if (encoded) return safeZipFilename(decodeFilename(encoded));

  const regular = contentDisposition.match(/filename\s*=\s*("[^"]*"|[^;]+)/i)?.[1];
  return regular ? safeZipFilename(decodeFilename(regular)) : DEFAULT_EXPORT_FILENAME;
}

function browserEnvironment(): WebDownloadEnvironment {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Browser downloads are unavailable on this device.');
  }

  return {
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: url => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    appendAnchor: anchor => document.body.appendChild(anchor as HTMLAnchorElement),
    defer: callback => setTimeout(callback, 0),
  };
}

export async function saveAccountExportForWeb(
  response: Response,
  environment: WebDownloadEnvironment = browserEnvironment(),
): Promise<string> {
  const filename = accountExportFilename(response.headers.get('content-disposition'));
  const url = environment.createObjectURL(await response.blob());
  const anchor = environment.createAnchor();
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  environment.appendAnchor(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  environment.defer(() => environment.revokeObjectURL(url));
  return filename;
}

async function saveAccountExportForNative(response: Response): Promise<string> {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Saving files is unavailable on this device.');
  }

  const filename = accountExportFilename(response.headers.get('content-disposition'));
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true, intermediates: true });

  try {
    // Expo's modern file API and fetch both expose web streams. Keep the
    // fallback for older native runtimes so this also works in an installed
    // build that has not picked up the newest runtime implementation yet.
    if (response.body && typeof response.body.pipeTo === 'function') {
      await response.body.pipeTo(file.writableStream());
    } else {
      file.write(new Uint8Array(await response.arrayBuffer()));
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/zip',
      UTI: 'com.pkware.zip-archive',
      dialogTitle: 'Save your Minds account export',
    });
    return filename;
  } catch (error) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Preserve the download/share error; cache cleanup is best-effort.
    }
    throw error;
  }
}

/** Download on web or open the native save/share sheet for a streamed ZIP. */
export function saveAccountExport(
  response: Response,
  platform: ExportPlatform = Platform.OS,
): Promise<string> {
  return platform === 'web'
    ? saveAccountExportForWeb(response)
    : saveAccountExportForNative(response);
}
