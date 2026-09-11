import * as React from 'react';
import { Platform } from 'react-native';

/**
 * Set the browser tab title for the current screen (web only; no-op native).
 *
 * The web build is a single-page bundle, so without this every route shows the
 * stock "Minds" title — bad for tab hunting, history, and JS-executing
 * crawlers. Crawler-facing titles for the initial HTML are injected
 * server-side by scripts/meta-server.mjs; this keeps the tab in sync once the
 * app is interactive. Restores the previous title on unmount so popping a
 * stacked screen (post → back to feed) reverts naturally.
 */
export function usePageTitle(title: string | null | undefined) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !title) return;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
