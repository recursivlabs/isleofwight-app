import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginChatVoiceAttempt,
  beginChatVoiceStart,
  endChatVoiceAttempt,
  endChatVoiceStart,
  getChatDraft,
  getChatComposerSessionEpoch,
  getChatComposerSessionVersion,
  getPendingChatVoiceNote,
  removePendingChatVoiceNote,
  clearChatComposerSession,
  savePendingChatVoiceNote,
  subscribeChatComposerSession,
  updateChatDraft,
  updatePendingChatVoiceNote,
  type PendingChatVoiceNote,
} from '../chatComposerSession';

function note(overrides: Partial<PendingChatVoiceNote> = {}): PendingChatVoiceNote {
  return {
    id: 'voice-1',
    userId: 'user-1',
    conversationId: 'conversation-a',
    sessionEpoch: getChatComposerSessionEpoch(),
    recording: {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      mime: 'audio/webm',
      durationMs: 1200,
    },
    ...overrides,
  };
}

describe('chat composer session ownership', () => {
  beforeEach(() => clearChatComposerSession());

  it('keeps text drafts isolated by account and conversation', () => {
    updateChatDraft('user-1', 'conversation-a', 'private A draft');

    expect(getChatDraft('user-1', 'conversation-a')).toBe('private A draft');
    expect(getChatDraft('user-1', 'conversation-b')).toBe('');
    expect(getChatDraft('user-2', 'conversation-a')).toBe('');

    updateChatDraft('user-1', 'conversation-a', current => `${current}!`);
    expect(getChatDraft('user-1', 'conversation-a')).toBe('private A draft!');
  });

  it('retains a stopped note across view unmounts without exposing it in another thread', () => {
    const saved = note();
    savePendingChatVoiceNote(saved);

    expect(getPendingChatVoiceNote('user-1', 'conversation-a')).toBe(saved);
    expect(getPendingChatVoiceNote('user-1', 'conversation-b')).toBeNull();
    expect(getPendingChatVoiceNote('user-2', 'conversation-a')).toBeNull();
  });

  it('rejects an interrupted recording that finishes after sign-out clearing', () => {
    const interrupted = note();
    clearChatComposerSession();

    expect(savePendingChatVoiceNote(interrupted)).toBe(false);
    expect(getPendingChatVoiceNote('user-1', 'conversation-a')).toBeNull();
  });

  it('updates and removes only the exact saved note', () => {
    const original = note();
    savePendingChatVoiceNote(original);

    const updated = updatePendingChatVoiceNote(original, current => ({
      ...current,
      publicUrl: 'https://media.example/voice.webm',
    }));
    expect(updated?.publicUrl).toContain('voice.webm');
    expect(removePendingChatVoiceNote('user-1', 'conversation-a', 'other-note')).toBe(false);
    expect(getPendingChatVoiceNote('user-1', 'conversation-a')).not.toBeNull();
    expect(removePendingChatVoiceNote('user-1', 'conversation-a', original.id)).toBe(true);
    expect(getPendingChatVoiceNote('user-1', 'conversation-a')).toBeNull();
  });

  it('allows exactly one concurrent upload/send attempt for a note', () => {
    const saved = note();
    const first = beginChatVoiceAttempt(saved);
    const second = beginChatVoiceAttempt(saved);

    expect(typeof first).toBe('symbol');
    expect(second).toBeNull();
    if (!first) throw new Error('expected the first attempt token');
    endChatVoiceAttempt(saved, first);
    expect(typeof beginChatVoiceAttempt(saved)).toBe('symbol');
  });

  it('allows exactly one microphone start while permission is pending', () => {
    const first = beginChatVoiceStart('user-1');
    const rapidSecondTap = beginChatVoiceStart('user-1');

    expect(typeof first).toBe('symbol');
    expect(rapidSecondTap).toBeNull();
    if (!first) throw new Error('expected the first start token');

    // A stale completion cannot release a newer owner.
    endChatVoiceStart('user-1', Symbol('stale-start'));
    expect(beginChatVoiceStart('user-1')).toBeNull();
    endChatVoiceStart('user-1', first);
    expect(typeof beginChatVoiceStart('user-1')).toBe('symbol');
  });

  it('publishes changes to mounted composer views', () => {
    const listener = vi.fn();
    const before = getChatComposerSessionVersion();
    const unsubscribe = subscribeChatComposerSession(listener);

    updateChatDraft('user-1', 'conversation-a', 'hello');
    savePendingChatVoiceNote(note());

    expect(getChatComposerSessionVersion()).toBe(before + 2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
