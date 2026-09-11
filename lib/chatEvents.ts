/**
 * Tiny in-process pub-sub for LOCAL, optimistic chat events.
 *
 * Why this exists: when you send a message, the sidebar inbox should update its
 * preview text, reorder the thread to the top, and (for a brand-new DM) show the
 * conversation IMMEDIATELY — not after the WebSocket echo round-trips back from
 * the server (~100-300ms). The chat screen already inserts the message
 * optimistically into the thread view; this channel lets it tell the sidebar
 * "I just sent X in convo Y" on the same tick, so the whole UI moves together
 * (iMessage/Signal feel). The WS echo + the conversations refetch then reconcile
 * against server truth — same message, no conflict, no duplicate.
 *
 * Deliberately decoupled from React context so any module (the chat send path)
 * can publish and any component (SideNav) can subscribe, without prop drilling
 * or a shared provider.
 */

export interface LocalChatEvent {
  conversationId: string;
  content: string;
  createdAt: string; // ISO
}

type Listener = (evt: LocalChatEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to local optimistic chat events. Returns an unsubscribe fn. */
export function subscribeLocalChat(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Publish a local optimistic chat event (called by the chat screen the instant
 * the user hits send, before the server confirms).
 */
export function publishLocalChat(evt: LocalChatEvent): void {
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch {
      /* a bad listener must never break the sender */
    }
  }
}
