import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the welcome-DM poster + cache so we test bootstrap's branding logic.
const ensureIntroDM = vi.fn(async (..._a: any[]) => 'conv-1');
vi.mock('../agentIntro', () => ({ ensureIntroDM: (...a: any[]) => ensureIntroDM(...a) }));
vi.mock('../cache', () => ({ invalidate: vi.fn() }));

import { bootstrapMindsAI } from '../mindsAI';

function makeSdk(created: boolean) {
  const ensurePersonal = vi.fn(async (_arg: any) => ({ data: { agent_id: 'agent-9', created } }));
  return { sdk: { agents: { ensurePersonal } }, ensurePersonal };
}

describe('bootstrapMindsAI', () => {
  beforeEach(() => ensureIntroDM.mockClear());

  it('brands a NEWLY created agent as Minds AI on Gemini, then greets', async () => {
    const { sdk, ensurePersonal } = makeSdk(true);
    await bootstrapMindsAI(sdk, { id: 'u1', name: 'Kit' });
    // first call: find-or-create with no overrides; second: brand it
    expect(ensurePersonal).toHaveBeenCalledTimes(2);
    const brand = ensurePersonal.mock.calls[1][0];
    expect(brand.overrides.name).toBe('Minds AI');
    expect(brand.overrides.model).toBe('google/gemini-3.1-pro-preview');
    expect(brand.overrides.system_prompt).toMatch(/Minds AI/);
    expect(ensureIntroDM).toHaveBeenCalledWith(sdk, 'agent-9', 'Kit');
  });

  it('does NOT re-brand an existing (user-customized) agent, but still greets', async () => {
    const { sdk, ensurePersonal } = makeSdk(false);
    await bootstrapMindsAI(sdk, { id: 'u2', name: 'Bill' });
    // only the find-or-create call; no branding overrides applied
    expect(ensurePersonal).toHaveBeenCalledTimes(1);
    expect(ensureIntroDM).toHaveBeenCalledWith(sdk, 'agent-9', 'Bill');
  });

  it('never throws into the caller (sign-in must not break)', async () => {
    const sdk = { agents: { ensurePersonal: vi.fn(async () => { throw new Error('boom'); }) } };
    await expect(bootstrapMindsAI(sdk as any, { id: 'u3' })).resolves.toBeUndefined();
    expect(ensureIntroDM).not.toHaveBeenCalled();
  });

  it('no-ops without an sdk', async () => {
    await expect(bootstrapMindsAI(null, { id: 'u4' })).resolves.toBeUndefined();
    expect(ensureIntroDM).not.toHaveBeenCalled();
  });
});
