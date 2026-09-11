import { describe, expect, it } from 'vitest';
import { chatConversationHref, usesWideChatPane } from '../chatNavigation';

describe('chat conversation navigation', () => {
  it('uses the full-screen root stack on iOS and Android at every width', () => {
    for (const platform of ['ios', 'android']) {
      expect(usesWideChatPane({ platform, width: 1400 })).toBe(false);
      expect(chatConversationHref('conversation-1', {}, { platform, width: 1400 })).toEqual({
        pathname: '/chat/[id]',
        params: { id: 'conversation-1' },
      });
    }
  });

  it('uses the full-screen root stack on narrow web', () => {
    expect(chatConversationHref('conversation-2', {}, { platform: 'web', width: 999 })).toEqual({
      pathname: '/chat/[id]',
      params: { id: 'conversation-2' },
    });
  });

  it('keeps wide web in the two-pane inbox and preserves route params', () => {
    expect(chatConversationHref(
      'conversation-3',
      { focused: '1', prompt: 'hello' },
      { platform: 'web', width: 1000 },
    )).toEqual({
      pathname: '/(tabs)/chat',
      params: { focused: '1', prompt: 'hello', id: 'conversation-3' },
    });
  });
});
