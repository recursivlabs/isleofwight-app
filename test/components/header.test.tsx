import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';

const headerMocks = vi.hoisted(() => ({
  dimensions: { width: 1200, height: 800, scale: 1, fontScale: 1 },
  drawer: null as { open: ReturnType<typeof vi.fn> } | null,
  goBack: vi.fn(),
  user: { id: 'viewer-1', username: 'viewer', name: 'Viewer' } as {
    id: string;
    username: string;
    name: string;
  } | null,
}));

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return { ...actual, useWindowDimensions: () => headerMocks.dimensions };
});

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: headerMocks.user }),
}));

vi.mock('../../lib/navigation', () => ({
  useSmartBack: () => headerMocks.goBack,
}));

vi.mock('../../components/MobileDrawer', () => ({
  useMobileDrawer: () => headerMocks.drawer,
}));

import { Header } from '../../components/Header';
import { ScreenHeader } from '../../components/ScreenHeader';

describe('Header accessibility', () => {
  beforeEach(() => {
    headerMocks.dimensions.width = 1200;
    headerMocks.drawer = null;
    headerMocks.user = { id: 'viewer-1', username: 'viewer', name: 'Viewer' };
  });

  it('names and activates the desktop back button', async () => {
    render(<Header showBack title="Post" />);

    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(headerMocks.goBack).toHaveBeenCalledTimes(1);
  });

  it('names and activates the shared screen back button', async () => {
    render(<ScreenHeader title="Post" />);

    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(headerMocks.goBack).toHaveBeenCalledTimes(1);
  });

  it('names the mobile home and drawer controls', async () => {
    headerMocks.dimensions.width = 390;
    const open = vi.fn();
    headerMocks.drawer = { open };
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Minds home' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('names the mobile profile fallback as a link', async () => {
    headerMocks.dimensions.width = 390;
    render(<Header showBack title="Settings" />);

    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'View your profile' }));
    expect(router.push).toHaveBeenCalledWith('/viewer');
  });
});
