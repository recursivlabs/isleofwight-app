import { Platform } from 'react-native';

type ShortcutHandler = () => void;

const handlers = new Map<string, ShortcutHandler>();

/**
 * Register a keyboard shortcut. Web only.
 * Key format: 'n', 'j', 'k', 'Escape', 'mod+k' (Cmd/Ctrl+K)
 */
export function registerShortcut(key: string, handler: ShortcutHandler): () => void {
  handlers.set(key, handler);
  return () => { handlers.delete(key); };
}

/**
 * Initialize keyboard listener. Call once on app start.
 */
export function initKeyboardShortcuts() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    const mod = e.metaKey || e.ctrlKey;
    let key = e.key.toLowerCase();
    if (mod) key = `mod+${key}`;

    // Non-mod shortcuts (j / k / n etc.) should NOT fire while the
    // user is typing into an input. Modified shortcuts (mod+k, etc.)
    // and Escape always fire so the user can open the command
    // palette or dismiss a modal from anywhere.
    if (inInput && !mod && key !== 'escape') return;

    const handler = handlers.get(key);
    if (handler) {
      e.preventDefault();
      handler();
    }
  });
}
