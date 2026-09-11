import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sdk: {
    agents: {
      ensurePersonal: vi.fn(async () => ({ data: { id: 'agent-1' } })),
    },
  },
  resolvePersonalAgent: vi.fn(async () => ({
    id: 'agent-1',
    agent_type: 'personal',
    model: 'anthropic/claude-sonnet-4.6',
  })),
  askAgent: vi.fn(async (..._args: any[]): Promise<'opened' | 'setup' | 'failed'> => 'opened'),
  toast: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: mocks.sdk, user: { id: 'viewer-1', pro: false } }),
}));

vi.mock('../../lib/resolvePersonalAgent', () => ({
  resolvePersonalAgent: mocks.resolvePersonalAgent,
  invalidatePersonalAgent: vi.fn(),
}));

vi.mock('../../lib/askAgent', () => ({ askAgent: mocks.askAgent }));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ show: mocks.toast }),
}));

vi.mock('../../components/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => children,
}));

import MindsAIScreen from '../../app/ai';

describe('Minds AI controls', () => {
  beforeEach(() => {
    mocks.askAgent.mockResolvedValue('opened');
    mocks.resolvePersonalAgent.mockResolvedValue({
      id: 'agent-1',
      agent_type: 'personal',
      model: 'anthropic/claude-sonnet-4.6',
    });
  });

  it('names and exposes state for every primary action and model choice', async () => {
    render(<MindsAIScreen />);

    const customize = screen.getByRole('button', { name: 'Customize your AI' });
    const model = await screen.findByRole('button', {
      name: 'Choose AI model, Claude Sonnet 4.6',
    });
    const send = screen.getByRole('button', { name: 'Send prompt to Minds AI' });
    const build = screen.getByRole('button', { name: 'Build with Minds AI' });
    expect(model).toHaveAttribute('aria-expanded', 'false');
    expect(send).toBeDisabled();
    expect(build).toBeInTheDocument();

    await userEvent.click(customize);
    expect(router.push).toHaveBeenCalledWith('/agent');

    await userEvent.click(model);
    expect(screen.getByRole('dialog', { name: 'Choose an AI model' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'AI models' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Claude Sonnet 4.6' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'GPT-5.5' }))
      .toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByRole('radio', { name: 'GPT-5.5' }));
    await waitFor(() => expect(mocks.sdk.agents.ensurePersonal).toHaveBeenCalledWith({
      overrides: { model: 'openai/gpt-5.5' },
    }));
    expect(screen.getByRole('button', { name: 'Choose AI model, GPT-5.5' }))
      .toHaveAttribute('aria-expanded', 'false');

    await userEvent.type(screen.getByRole('textbox', { name: 'Ask Minds AI' }), 'Summarize my feed');
    expect(send).toBeEnabled();
    await userEvent.click(send);
    await waitFor(() => expect(mocks.askAgent).toHaveBeenCalledWith(
      mocks.sdk,
      router,
      'Summarize my feed',
    ));
  });

  it('reports a failed launch and preserves the prompt for retry', async () => {
    mocks.askAgent.mockResolvedValueOnce('failed');
    render(<MindsAIScreen />);

    const prompt = screen.getByRole('textbox', { name: 'Ask Minds AI' });
    await userEvent.type(prompt, 'Help me understand this');
    await userEvent.click(screen.getByRole('button', { name: 'Send prompt to Minds AI' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      'Could not start Minds AI. Try again.',
      'error',
    ));
    expect(prompt).toHaveValue('Help me understand this');
    expect(screen.getByRole('button', { name: 'Send prompt to Minds AI' })).toBeEnabled();
  });
});
