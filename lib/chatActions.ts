type ReportsClient = {
  reports?: {
    create?: (input: {
      target_type: 'user';
      target_id: string;
      reason: 'spam';
      details: string;
    }) => Promise<unknown>;
  };
};

type ChatReaction = {
  type?: string;
  emoji?: string;
  user_id?: string;
  userId?: string;
  user_name?: string;
  [key: string]: unknown;
};

type ChatReactionClient = {
  chat?: {
    reactToMessage?: (messageId: string, input: { type: string }) => Promise<unknown>;
  };
};

type ChatConversationClient = {
  chat?: {
    deleteConversation?: (conversationId: string) => Promise<unknown>;
  };
};

export function setOwnChatReactionPresence({
  reactions,
  emoji,
  userId,
  userName,
  present,
  reaction,
}: {
  reactions: ChatReaction[];
  emoji: string;
  userId: string;
  userName?: string;
  present: boolean;
  reaction?: ChatReaction;
}): ChatReaction[] {
  const withoutOwnEmoji = reactions.filter(
    item => !(
      (item.type || item.emoji) === emoji &&
      (item.user_id ?? item.userId) === userId
    ),
  );
  if (!present) return withoutOwnEmoji;
  return [
    ...withoutOwnEmoji,
    reaction || { type: emoji, user_id: userId, user_name: userName },
  ];
}

export async function persistChatReaction({
  sdk,
  messageId,
  emoji,
}: {
  sdk: ChatReactionClient | null | undefined;
  messageId: string;
  emoji: string;
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (typeof sdk?.chat?.reactToMessage !== 'function') {
    return { ok: false, error: new Error('Chat reactions are unavailable') };
  }
  try {
    // Keep the resource binding: the real SDK method reads its client from `this`.
    await sdk.chat.reactToMessage(messageId, { type: emoji });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function persistConversationDeletion({
  sdk,
  conversationId,
}: {
  sdk: ChatConversationClient | null | undefined;
  conversationId: string;
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (typeof sdk?.chat?.deleteConversation !== 'function') {
    return { ok: false, error: new Error('Conversation deletion is unavailable') };
  }
  try {
    // Keep the resource binding: the real SDK method reads its client from `this`.
    await sdk.chat.deleteConversation(conversationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function reportConversationSpam({
  sdk,
  conversation,
  currentUserId,
}: {
  sdk: ReportsClient | null | undefined;
  conversation: any;
  currentUserId?: string;
}): Promise<boolean> {
  const members = conversation?.participants || conversation?.members || [];
  const other = members.find(
    (participant: any) =>
      (participant?.user?.id ?? participant?.id ?? participant?.userId) !== currentUserId,
  );
  const otherId = other?.user?.id ?? other?.id ?? other?.userId;
  if (!otherId || !sdk?.reports?.create) return false;

  try {
    // Call through the resource object: the real SDK method reads `this.client`.
    // Detaching it into a local function would turn every real report into a
    // TypeError even though simple function mocks still pass.
    await sdk.reports.create({
      target_type: 'user',
      target_id: otherId,
      reason: 'spam',
      details: `Reported from chat list (conversation ${conversation.id})`,
    });
    return true;
  } catch {
    return false;
  }
}
