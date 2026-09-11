import type { VoiceRecording } from './useVoiceRecorder';

/**
 * Conversation-owned composer state that survives ConversationView navigation.
 *
 * The thread screen is intentionally reused on wide web and unmounted on
 * native. Keeping this state in either component produces two bad outcomes:
 * text can cross from thread A into B, while a stopped voice note disappears
 * when native navigation unmounts A. This session store keys both by account
 * and conversation and notifies every mounted view of changes.
 *
 * Voice Blobs are deliberately session-local: they are never serialized into
 * localStorage/AsyncStorage, where another account or a storage quota failure
 * could expose or silently truncate private audio.
 */

export type PendingChatVoiceNote = {
  id: string;
  conversationId: string;
  userId: string;
  sessionEpoch: number;
  recording: VoiceRecording;
  publicUrl?: string;
  /** Set immediately before a transport whose outcome may become ambiguous. */
  deliveryAttemptedAt?: string;
};

type DraftUpdate = string | ((current: string) => string);

const drafts = new Map<string, string>();
const voiceNotes = new Map<string, PendingChatVoiceNote>();
const voiceAttempts = new Map<string, { noteId: string; token: symbol }>();
const voiceStarts = new Map<string, symbol>();
const listeners = new Set<() => void>();
let version = 0;
let sessionEpoch = 0;

function composerKey(userId: string, conversationId: string): string {
  return `${userId}\n${conversationId}`;
}

function scopedKey(
  userId: string | null | undefined,
  conversationId: string | null | undefined,
): string | null {
  if (typeof userId !== 'string' || !userId.length) return null;
  if (typeof conversationId !== 'string' || !conversationId.length) return null;
  return composerKey(userId, conversationId);
}

function publish() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeChatComposerSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getChatComposerSessionVersion(): number {
  return version;
}

export function getChatComposerSessionEpoch(): number {
  return sessionEpoch;
}

export function getChatDraft(
  userId: string | null | undefined,
  conversationId: string | null | undefined,
): string {
  const key = scopedKey(userId, conversationId);
  return key ? drafts.get(key) || '' : '';
}

export function updateChatDraft(
  userId: string | null | undefined,
  conversationId: string | null | undefined,
  update: DraftUpdate,
): string {
  const key = scopedKey(userId, conversationId);
  if (!key) return '';
  const current = drafts.get(key) || '';
  const next = typeof update === 'function' ? update(current) : update;
  if (next === current) return current;
  if (next) drafts.set(key, next);
  else drafts.delete(key);
  publish();
  return next;
}

export function getPendingChatVoiceNote(
  userId: string | null | undefined,
  conversationId: string | null | undefined,
): PendingChatVoiceNote | null {
  const key = scopedKey(userId, conversationId);
  return key ? voiceNotes.get(key) || null : null;
}

export function savePendingChatVoiceNote(note: PendingChatVoiceNote): boolean {
  const key = scopedKey(note.userId, note.conversationId);
  if (!key || note.sessionEpoch !== sessionEpoch) return false;
  voiceNotes.set(key, note);
  publish();
  return true;
}

export function updatePendingChatVoiceNote(
  note: PendingChatVoiceNote,
  update: (current: PendingChatVoiceNote) => PendingChatVoiceNote,
): PendingChatVoiceNote | null {
  const key = composerKey(note.userId, note.conversationId);
  const current = voiceNotes.get(key);
  if (!current || current.id !== note.id) return current || null;
  const next = update(current);
  voiceNotes.set(key, next);
  publish();
  return next;
}

export function removePendingChatVoiceNote(
  userId: string,
  conversationId: string,
  expectedNoteId?: string,
): boolean {
  const key = composerKey(userId, conversationId);
  const current = voiceNotes.get(key);
  if (!current || (expectedNoteId && current.id !== expectedNoteId)) return false;
  voiceNotes.delete(key);
  publish();
  return true;
}

/** Atomically reserve one upload/send attempt for this note across remounts. */
export function beginChatVoiceAttempt(note: PendingChatVoiceNote): symbol | null {
  const key = composerKey(note.userId, note.conversationId);
  if (voiceAttempts.has(key)) return null;
  const token = Symbol('chat-voice-attempt');
  voiceAttempts.set(key, { noteId: note.id, token });
  return token;
}

export function endChatVoiceAttempt(note: PendingChatVoiceNote, token: symbol): void {
  const key = composerKey(note.userId, note.conversationId);
  const current = voiceAttempts.get(key);
  if (current?.noteId === note.id && current.token === token) voiceAttempts.delete(key);
}

/** Atomically reserve microphone startup for one account across rapid taps. */
export function beginChatVoiceStart(userId: string): symbol | null {
  if (voiceStarts.has(userId)) return null;
  const token = Symbol('chat-voice-start');
  voiceStarts.set(userId, token);
  return token;
}

export function endChatVoiceStart(userId: string, token: symbol): void {
  if (voiceStarts.get(userId) === token) voiceStarts.delete(userId);
}

/** Drop private drafts/audio on sign-out; also useful for deterministic tests. */
export function clearChatComposerSession(): void {
  drafts.clear();
  voiceNotes.clear();
  voiceAttempts.clear();
  voiceStarts.clear();
  sessionEpoch += 1;
  publish();
}
