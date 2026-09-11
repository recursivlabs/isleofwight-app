/**
 * Preserve the complete server message DTO while normalizing the handful of
 * aliases the chat UI consumes directly. Replies, reactions, and structured
 * media are deliberately carried through unchanged.
 */
export function normalizeChatMessage(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;

  const content = String(raw.content ?? raw.text ?? '').trim();
  const hasStructuredMedia = Array.isArray(raw.media) && raw.media.length > 0;
  const replyToId = raw.replyToId
    ?? raw.reply_to_id
    ?? raw.replyTo?.id
    ?? raw.reply_to?.id;

  // Agent tool calls can create rows with neither visible text nor media.
  // Keep valid media-only messages, but continue hiding those tool-only rows.
  if (!content && !hasStructuredMedia) return null;

  return {
    ...raw,
    content,
    sender: raw.sender || {
      id: raw.senderId ?? raw.sender_id,
      name: raw.senderName ?? raw.sender_name,
    },
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    ...(replyToId ? { replyToId } : {}),
  };
}

export function resolveChatMessageQuote(
  message: any,
  loadedMessages: any[],
  currentUserId?: string,
): { name: string; text: string } | null {
  const replyToId = message?.reply_to_id || message?.replyToId;
  if (!replyToId) return null;

  const embedded = message?.reply_to || message?.replyTo;
  if (embedded) {
    return {
      name: embedded.sender_name
        || embedded.senderName
        || embedded.sender?.name
        || '',
      text: String(embedded.content || embedded.text || '').slice(0, 90),
    };
  }

  const quoted = loadedMessages.find((candidate) => candidate.id === replyToId);
  if (!quoted) return null;
  const quotedSenderId = quoted.sender?.id || quoted.senderId || quoted.sender_id;
  return {
    name: quotedSenderId === currentUserId
      ? 'You'
      : (quoted.sender?.name || quoted.senderName || quoted.sender_name || ''),
    text: String(quoted.content || quoted.text || '').slice(0, 90),
  };
}

/**
 * The messages endpoint returns newest-first. Build the chronological display
 * page from a copy so cache writes retain the server response order.
 */
export function normalizeChatMessagePage(rawMessages: any[] | null | undefined): any[] {
  if (!Array.isArray(rawMessages)) return [];

  return [...rawMessages]
    .reverse()
    .map(normalizeChatMessage)
    .filter((message): message is any => message !== null);
}
