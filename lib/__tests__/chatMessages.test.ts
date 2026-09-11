import { describe, expect, it } from 'vitest';
import {
  normalizeChatMessage,
  normalizeChatMessagePage,
  resolveChatMessageQuote,
} from '../chatMessages';

describe('normalizeChatMessage', () => {
  it('preserves reply, reaction, media, and forward-compatible metadata', () => {
    const raw = {
      id: 'message-2',
      content: '  Reply with a photo  ',
      sender: { id: 'user-2', name: 'Bob' },
      created_at: '2026-08-27T12:01:00.000Z',
      reply_to_id: 'message-1',
      reply_to: { content: 'Original', sender_name: 'Alice' },
      media: [{ url: 'https://media.example/photo.jpg', type: 'image' }],
      reactions: [{ type: '❤️', user_id: 'user-1' }],
      future_server_field: { retained: true },
    };

    const normalized = normalizeChatMessage(raw);

    expect(normalized).toMatchObject({
      id: 'message-2',
      content: 'Reply with a photo',
      createdAt: '2026-08-27T12:01:00.000Z',
      reply_to_id: 'message-1',
      reply_to: { content: 'Original', sender_name: 'Alice' },
      media: raw.media,
      reactions: raw.reactions,
      future_server_field: { retained: true },
    });
  });

  it('keeps structured media-only messages', () => {
    expect(normalizeChatMessage({
      id: 'media-only',
      content: '   ',
      media: [{ url: 'https://media.example/audio.m4a', type: 'audio' }],
      sender_id: 'user-2',
      sender_name: 'Bob',
      created_at: '2026-08-27T12:00:00.000Z',
    })).toMatchObject({
      id: 'media-only',
      content: '',
      sender: { id: 'user-2', name: 'Bob' },
      createdAt: '2026-08-27T12:00:00.000Z',
    });
  });

  it('drops only messages with no visible text or structured media', () => {
    expect(normalizeChatMessage({ id: 'tool-turn', content: '  ', media: [] })).toBeNull();
    expect(normalizeChatMessage(null)).toBeNull();
  });

  it('canonicalizes text, sender, and timestamp aliases', () => {
    expect(normalizeChatMessage({
      id: 'aliased',
      text: '  hello  ',
      senderId: 'user-1',
      senderName: 'Alice',
      created_at: '2026-08-27T11:00:00.000Z',
    })).toMatchObject({
      content: 'hello',
      sender: { id: 'user-1', name: 'Alice' },
      createdAt: '2026-08-27T11:00:00.000Z',
    });
  });

  it('canonicalizes and resolves a WebSocket-shaped embedded reply', () => {
    const normalized = normalizeChatMessage({
      id: 'message-2',
      text: 'Live reply',
      sender: { id: 'user-2', name: 'Bob' },
      replyTo: {
        id: 'message-1',
        content: 'Original question',
        sender: { id: 'user-1', name: 'Alice' },
      },
      createdAt: '2026-08-27T12:01:00.000Z',
    });

    expect(normalized.replyToId).toBe('message-1');
    expect(resolveChatMessageQuote(normalized, [], 'user-3')).toEqual({
      name: 'Alice',
      text: 'Original question',
    });
  });
});

describe('resolveChatMessageQuote', () => {
  it('falls back to an already-loaded message and labels the current user', () => {
    expect(resolveChatMessageQuote(
      { id: 'message-2', content: 'Reply', reply_to_id: 'message-1' },
      [{ id: 'message-1', content: 'Earlier message', sender: { id: 'user-1', name: 'Alice' } }],
      'user-1',
    )).toEqual({ name: 'You', text: 'Earlier message' });
  });
});

describe('normalizeChatMessagePage', () => {
  it('returns chronological messages without mutating the newest-first response', () => {
    const newestFirst = [
      { id: 'new', content: 'Second', created_at: '2026-08-27T12:01:00.000Z' },
      { id: 'old', content: 'First', created_at: '2026-08-27T12:00:00.000Z' },
    ];
    const before = structuredClone(newestFirst);

    const normalized = normalizeChatMessagePage(newestFirst);

    expect(normalized.map((message) => message.id)).toEqual(['old', 'new']);
    expect(newestFirst).toEqual(before);
  });
});
