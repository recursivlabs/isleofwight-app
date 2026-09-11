import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMock = vi.hoisted(() => ({
  useProfiles: vi.fn(() => ({ profiles: [], loading: false, error: null })),
}));

const keyboardMock = vi.hoisted(() => ({
  handlers: new Map<string, () => void>(),
}));

vi.mock('../../lib/hooks', () => hookMock);
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: null, user: null }),
}));
vi.mock('../../lib/keyboard', () => ({
  registerShortcut: (key: string, handler: () => void) => {
    keyboardMock.handlers.set(key, handler);
    return () => keyboardMock.handlers.delete(key);
  },
}));

import { CommandPalette } from '../../components/CommandPalette';

beforeEach(() => {
  keyboardMock.handlers.clear();
});

describe('CommandPalette', () => {
  it('waits to load the people directory until the palette opens', async () => {
    render(<CommandPalette />);

    expect(hookMock.useProfiles).toHaveBeenLastCalledWith(200, false);

    await act(async () => {
      keyboardMock.handlers.get('mod+k')?.();
    });

    await waitFor(() => expect(hookMock.useProfiles).toHaveBeenLastCalledWith(200, true));
  });
});
