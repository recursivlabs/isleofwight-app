export type ChatRequestStatus = 'accepted' | 'pending' | 'declined';

/**
 * The chat APIs have returned both flat members and participant wrappers over
 * time. Normalize that drift once so routing never guesses from a partially
 * loaded screen state.
 */
export type ConversationRecipient = {
  id: string;
  name: string;
  isAgent: boolean;
  raw: any;
};

export function conversationParticipantId(participant: any): string | null {
  const id = participant?.user?.id
    ?? participant?.userId
    ?? participant?.user_id
    ?? participant?.id;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Routing must distinguish an explicit human from an as-yet-unhydrated actor.
 * Treating a missing `is_ai` as false is the original first-send defect.
 */
export function conversationParticipantIsAgent(participant: any): boolean | null {
  const explicit = participant?.user?.isAi
    ?? participant?.user?.is_ai
    ?? participant?.isAi
    ?? participant?.is_ai;
  if (typeof explicit === 'boolean') return explicit;

  const type = participant?.user?.type ?? participant?.type;
  if (type === 'agent') return true;
  if (type === 'user' || type === 'human') return false;
  return null;
}

export function normalizeConversationRecipient(participant: any): ConversationRecipient | null {
  const id = conversationParticipantId(participant);
  const isAgent = conversationParticipantIsAgent(participant);
  if (!id || isAgent === null) return null;

  const rawName = participant?.user?.name
    ?? participant?.name
    ?? participant?.user?.username
    ?? participant?.username;

  return {
    id,
    name: typeof rawName === 'string' && rawName.trim() ? rawName : 'Conversation',
    isAgent,
    raw: participant,
  };
}

function conversationRecipientFromParticipants(
  conversation: any,
  participants: any[],
  currentUserId: string,
): ConversationRecipient | null {
  const others = participants.filter(
    (participant: any) => conversationParticipantId(participant) !== currentUserId,
  );
  const declaredType = conversation?.type ?? conversation?.conversation_type;
  if (declaredType && declaredType !== 'one_on_one' && declaredType !== 'group') {
    return null;
  }
  const isOneOnOne = declaredType
    ? declaredType === 'one_on_one'
    : others.length === 1;

  // Agent chat is a one-to-one transport. A group containing an agent remains
  // a normal conversation and must use chat.send, never the agent stream.
  if (!isOneOnOne) {
    const participant = others.find((other: any) => conversationParticipantId(other));
    const id = conversationParticipantId(participant);
    if (!participant || !id) return null;
    const rawName = conversation?.name
      ?? participant?.user?.name
      ?? participant?.name
      ?? participant?.user?.username
      ?? participant?.username;
    return {
      id,
      name: typeof rawName === 'string' && rawName.trim() ? rawName : 'Conversation',
      isAgent: false,
      raw: participant,
    };
  }

  // A malformed one-to-one with zero or multiple counterparties is not safe
  // to route. Likewise, an unhydrated participant with no explicit actor kind
  // remains unresolved rather than silently becoming human.
  if (others.length !== 1) return null;
  return normalizeConversationRecipient(others[0]);
}

/** Resolve the other participant without ever falling back to the current user. */
export function conversationRecipient(
  conversation: any,
  currentUserId: string | null | undefined,
): ConversationRecipient | null {
  if (!currentUserId) return null;
  const lists = [conversation?.participants, conversation?.members]
    .filter((value): value is any[] => Array.isArray(value) && value.length > 0);
  for (const participants of lists) {
    const recipient = conversationRecipientFromParticipants(
      conversation,
      participants,
      currentUserId,
    );
    if (recipient) return recipient;
  }
  return null;
}

export function conversationRecipientRoute(
  recipient: ConversationRecipient,
): 'agent' | 'human' {
  return recipient.isAgent ? 'agent' : 'human';
}

export type PreparedChatDelivery = { recipient: ConversationRecipient };
export type ChatDeliveryResult = 'unresolved' | 'stale' | 'unconfirmed' | 'agent' | 'human';

/**
 * Enforce the send transaction boundary in one testable place: resolve and
 * validate first, commit local state second, then invoke exactly one transport.
 */
export async function runPreparedChatDelivery<
  TPrepared extends PreparedChatDelivery,
  TReady,
>(options: {
  prepare: () => Promise<TPrepared | null>;
  validate: (prepared: TPrepared) => boolean;
  onReady: (prepared: TPrepared) => TReady | Promise<TReady>;
  sendAgent: (prepared: TPrepared, ready: TReady) => boolean | Promise<boolean>;
  sendHuman: (prepared: TPrepared, ready: TReady) => boolean | Promise<boolean>;
}): Promise<ChatDeliveryResult> {
  const prepared = await options.prepare();
  if (!prepared) return 'unresolved';
  if (!options.validate(prepared)) return 'stale';

  const ready = await options.onReady(prepared);
  const route = conversationRecipientRoute(prepared.recipient);
  if (route === 'agent') {
    if (!await options.sendAgent(prepared, ready)) return 'unconfirmed';
  } else {
    if (!await options.sendHuman(prepared, ready)) return 'unconfirmed';
  }
  return route;
}

/**
 * A no-content agent stream is accepted only when the exact user turn appears
 * under a message id that did not exist before the request. Recent replies or
 * an older same-text message are not causal proof of this delivery.
 */
export function hasNewPersistedUserTurn(options: {
  messages: any[];
  baselineMessageIds: ReadonlySet<string> | null;
  userId: string;
  content: string;
}): boolean {
  if (!options.baselineMessageIds) return false;
  const expected = options.content.trim();
  return options.messages.some((message) => {
    const id = message?.id;
    if (typeof id !== 'string' || !id || options.baselineMessageIds?.has(id)) return false;
    const senderId = message?.sender?.id ?? message?.senderId ?? message?.sender_id;
    const content = String(message?.content ?? message?.text ?? '').trim();
    return senderId === options.userId && content === expected;
  });
}

/**
 * Correlate a transport result by content only when the caller owns a unique
 * value (the media service gives each voice upload its own public URL).
 */
export function hasPersistedUniqueUserContent(options: {
  messages: any[];
  userId: string;
  uniqueContent: string;
}): boolean {
  const expected = options.uniqueContent.trim();
  return options.messages.some((message) => {
    const senderId = message?.sender?.id ?? message?.senderId ?? message?.sender_id;
    const content = String(message?.content ?? message?.text ?? '').trim();
    return senderId === options.userId && content === expected;
  });
}

export type UniqueContentPersistence = 'found' | 'absent' | 'unknown';
export type UniqueContentRetryDecision = 'confirmed' | 'send' | 'hold';

/**
 * An attempted transport may commit after the client gives up. Without a
 * platform idempotency key, only exact persistence proof can retire it; neither
 * a current absence nor a failed lookup authorizes another send.
 */
export function uniqueContentRetryDecision(
  priorTransportAttempted: boolean,
  persistence: UniqueContentPersistence,
): UniqueContentRetryDecision {
  if (!priorTransportAttempted) return 'send';
  return persistence === 'found' ? 'confirmed' : 'hold';
}

/**
 * Search the largest single chat-history page for a caller-owned unique value.
 * A truncated page is deliberately `unknown`: exhausting older pages here can
 * amplify requests, still cannot provide true idempotency, and risks reviving
 * chat's prior rate-limit storm. Callers fail closed until the platform offers
 * an exact idempotency key / lookup.
 */
export async function resolveUniqueUserContentPersistence(options: {
  fetchPage: (params: { limit: number; offset: number }) => Promise<{
    data?: any[];
    meta?: { has_more?: boolean };
  }>;
  userId: string;
  uniqueContent: string;
  pageSize?: number;
}): Promise<UniqueContentPersistence> {
  const pageSize = options.pageSize ?? 100;
  try {
    const page = await options.fetchPage({ limit: pageSize, offset: 0 });
    if (!Array.isArray(page?.data) || typeof page?.meta?.has_more !== 'boolean') {
      return 'unknown';
    }
    if (hasPersistedUniqueUserContent({
      messages: page.data,
      userId: options.userId,
      uniqueContent: options.uniqueContent,
    })) return 'found';
    return page.meta.has_more ? 'unknown' : 'absent';
  } catch {
    return 'unknown';
  }
}

export function conversationRequestStatus(conversation: any): ChatRequestStatus {
  return conversation?.request_status ?? conversation?.requestStatus ?? 'accepted';
}

export function belongsInChatInbox(
  conversation: any,
  view: 'primary' | 'requests',
): boolean {
  const status = conversationRequestStatus(conversation);
  return view === 'requests' ? status === 'pending' : status === 'accepted';
}
