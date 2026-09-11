import { describe, expect, it } from 'vitest';

import { MINDS_API_ENDPOINTS } from './index';

describe('Minds REST contract', () => {
  it('matches the current Recursiv route verbs and paths that previously drifted', () => {
    expect(MINDS_API_ENDPOINTS.communities.update).toBe('PUT /api/v1/communities/:id');
    expect(MINDS_API_ENDPOINTS.profiles.update).toBe('PUT /api/v1/profiles/me');
    expect(MINDS_API_ENDPOINTS.chat.createGroup).toBe('POST /api/v1/chat/conversations/group');
    expect(MINDS_API_ENDPOINTS.chat.react).toBe('POST /api/v1/chat/messages/:id/react');
    expect(MINDS_API_ENDPOINTS.agents.update).toBe('PUT /api/v1/agents/:id');
  });
});
