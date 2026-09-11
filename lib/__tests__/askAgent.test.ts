import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolvePersonalAgent: vi.fn(),
}));

vi.mock('../resolvePersonalAgent', () => ({
  resolvePersonalAgent: mocks.resolvePersonalAgent,
}));

vi.mock('../chatNavigation', () => ({
  chatConversationHref: (id: string, params: Record<string, string>) => ({
    pathname: '/(tabs)/chat',
    params: { ...params, id },
  }),
}));

import { askAgent } from '../askAgent';

const makeRouter = () => ({ push: vi.fn() });

describe('askAgent', () => {
  beforeEach(() => {
    mocks.resolvePersonalAgent.mockResolvedValue({ id: 'agent-1' });
  });

  it('reports a missing signed-in SDK as a failure', async () => {
    const router = makeRouter();
    await expect(askAgent(null, router, 'hello')).resolves.toBe('failed');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('routes a user without a personal agent to setup', async () => {
    mocks.resolvePersonalAgent.mockResolvedValueOnce(null);
    const router = makeRouter();

    await expect(askAgent({ agents: {} }, router, 'hello')).resolves.toBe('setup');
    expect(router.push).toHaveBeenCalledWith('/agent');
  });

  it('reports a missing conversation id as a failure', async () => {
    const router = makeRouter();
    const sdk = { chat: { dm: vi.fn(async () => ({ data: {} })) } };

    await expect(askAgent(sdk, router, 'hello')).resolves.toBe('failed');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('reports lookup and network errors as failures', async () => {
    mocks.resolvePersonalAgent.mockRejectedValueOnce(new Error('offline'));
    const router = makeRouter();

    await expect(askAgent({ agents: {} }, router, 'hello')).resolves.toBe('failed');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the personal-agent conversation with the prompt', async () => {
    const router = makeRouter();
    const dm = vi.fn(async () => ({ data: { id: 'conversation-1' } }));

    await expect(askAgent({ chat: { dm } }, router, 'Summarize my feed')).resolves.toBe('opened');
    expect(dm).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'agent-1' }));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/(tabs)/chat',
      params: expect.objectContaining({
        id: 'conversation-1',
        prompt: 'Summarize my feed',
      }),
    }));
  });
});
