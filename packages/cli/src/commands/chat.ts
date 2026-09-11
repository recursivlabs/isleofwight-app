import type { Conversation, Message } from '@minds/sdk';

import { createClient } from '../lib/client.js';
import { exitWithError, log, printJson } from '../lib/output.js';

interface ListOptions {
  limit?: string;
  offset?: string;
  json?: boolean;
}

interface MessageOptions {
  limit?: string;
  cursor?: string;
  json?: boolean;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOffset(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function oneLine(value: string, maxLength = 100): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function conversationName(conversation: Conversation): string {
  if (conversation.name?.trim()) return conversation.name.trim();
  const names = conversation.members.map((member) => member.name || `@${member.username}`).filter(Boolean);
  return names.length > 0 ? names.join(', ') : conversation.type;
}

function messageBody(message: Message): string {
  const content = oneLine(message.content ?? '');
  if (content) return content;
  if (message.media.length > 0) return `[${message.media.length} media attachment${message.media.length === 1 ? '' : 's'}]`;
  return '[empty message]';
}

export async function chatListCommand(options: ListOptions): Promise<void> {
  const minds = createClient();
  const result = await minds.chat.conversations({
    limit: parseLimit(options.limit, 20),
    offset: parseOffset(options.offset),
  });

  if (options.json) return printJson(result);

  for (const conversation of result.data ?? []) {
    const requestStatus = conversation.request_status && conversation.request_status !== 'accepted'
      ? ` [${conversation.request_status}]`
      : '';
    log.info(`${conversation.id}  ${conversationName(conversation)}${requestStatus}`);
    if (conversation.last_message) {
      log.dim(`  ${conversation.last_message.sender_name}: ${oneLine(conversation.last_message.content)}`);
    }
  }
  log.dim(`${result.data?.length ?? 0} conversations`);
}

export async function chatMessagesCommand(conversationId: string, options: MessageOptions): Promise<void> {
  const minds = createClient();
  const result = await minds.chat.messages(conversationId, {
    limit: parseLimit(options.limit, 50),
    cursor: options.cursor,
  });

  if (options.json) return printJson(result);

  const messages = result.data ?? [];
  for (const message of [...messages].reverse()) {
    log.info(`${message.created_at}  ${message.sender.name}: ${messageBody(message)}`);
  }
  log.dim(`${messages.length} messages`);
}

export async function chatSendCommand(
  conversationId: string,
  options: { message: string; replyToId?: string; json?: boolean },
): Promise<void> {
  const content = options.message?.trim();
  if (!content) exitWithError('--message cannot be empty');

  const minds = createClient();
  const result = await minds.chat.send({
    conversation_id: conversationId,
    content,
    reply_to_id: options.replyToId,
  });

  if (options.json) return printJson(result);
  log.success(`Sent message ${result.data.id} to ${result.data.conversation_id}`);
}

export async function chatDmCommand(
  userId: string,
  options: { message?: string; json?: boolean },
): Promise<void> {
  const message = options.message?.trim();
  if (options.message !== undefined && !message) exitWithError('--message cannot be empty');

  const minds = createClient();
  const conversation = await minds.chat.dm({ user_id: userId });
  const sent = message
    ? await minds.chat.send({ conversation_id: conversation.data.id, content: message })
    : undefined;

  if (options.json) {
    return printJson(sent
      ? { conversation: conversation.data, message: sent.data }
      : conversation);
  }

  log.success(`${conversation.data.created ? 'Started' : 'Opened'} conversation ${conversation.data.id}`);
  if (sent) log.success(`Sent message ${sent.data.id}`);
}
