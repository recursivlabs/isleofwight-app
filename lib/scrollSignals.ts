// Tiny pub/sub so the header wordmark can scroll the home feed to top
// (X behavior: tap the logo while on home → jump back to the top).
type Listener = () => void;
const listeners = new Set<Listener>();

export function onHomeScrollToTop(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitHomeScrollToTop(): void {
  for (const fn of listeners) { try { fn(); } catch {} }
}
