import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const communitiesMock = vi.hoisted(() => ({
  value: { communities: [] as any[], loading: false, fetchedOnce: true },
}));

const authMock = vi.hoisted(() => ({
  value: { user: { id: 'user-1' } as any, isLoading: false },
}));

const cacheMock = vi.hoisted(() => ({
  setCache: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  FlatList: ({ data, renderItem, ListFooterComponent }: any) => (
    <div>
      {data.map((item: any, index: number) => (
        <React.Fragment key={item.id}>{renderItem({ item, index })}</React.Fragment>
      ))}
      {ListFooterComponent}
    </div>
  ),
  Pressable: ({
    children,
    href,
    onPress,
    accessibilityRole,
    accessibilityLabel,
  }: any) => {
    const props = {
      href,
      role: accessibilityRole,
      'aria-label': accessibilityLabel,
    };
    return href
      // biome-ignore lint/a11y/useValidAnchor: the Pressable web mock preserves href while exercising its onPress cache callback.
      ? <a {...props} onClick={(event) => { event.preventDefault(); onPress?.(); }}>{typeof children === 'function' ? children({}) : children}</a>
      : <button type="button" {...props} onClick={onPress}>{typeof children === 'function' ? children({}) : children}</button>;
  },
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    placeholderTextColor: _placeholderTextColor,
    returnKeyType: _returnKeyType,
    autoCapitalize: _autoCapitalize,
    style: _style,
    ...props
  }: any) => (
    <input
      {...props}
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  ),
  ActivityIndicator: () => <span>Loading</span>,
  Platform: { OS: 'web' },
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Avatar: ({ name }: { name?: string }) => <span>{name}</span>,
  Skeleton: () => <span>Skeleton</span>,
  RightRailLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/Container', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <header><h1>{title}</h1>{right}</header>
  ),
}));

vi.mock('../../components/SignedOutDiscover', () => ({
  SignedOutDiscover: ({ returnTo, section }: { returnTo: string; section: string }) => (
    <section data-return-to={returnTo} data-section={section}>
      <h2>Discover public groups</h2>
      <a href="/community/technology-20034560">Technology community</a>
    </section>
  ),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock.value,
}));

vi.mock('../../lib/hooks', () => ({
  useCommunities: () => communitiesMock.value,
}));

vi.mock('../../lib/cache', () => ({
  setCache: cacheMock.setCache,
}));

vi.mock('../../lib/discover', () => ({
  formatCount: (value: number) => String(value),
}));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    accentHover: '#c39937',
    bg: '#111',
    glass: '#222',
    glassBorder: '#333',
    text: '#fff',
    textMuted: '#aaa',
    textOnAccent: '#111',
    textSecondary: '#ccc',
  }),
}));

import CommunitiesScreen from '../../app/groups';

describe('Groups navigation accessibility', () => {
  beforeEach(() => {
    communitiesMock.value = { communities: [], loading: false, fetchedOnce: true };
    authMock.value = { user: { id: 'user-1' }, isLoading: false };
    cacheMock.setCache.mockReset();
  });

  it('shows real public-group discovery instead of a personal empty state when signed out', () => {
    authMock.value = { user: null, isLoading: false };

    const { container } = render(<CommunitiesScreen />);

    expect(screen.getByRole('heading', { name: 'Discover public groups' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Technology community' }))
      .toHaveAttribute('href', '/community/technology-20034560');
    expect(screen.queryByRole('link', { name: 'Create a new group' })).not.toBeInTheDocument();
    expect(screen.queryByText('No groups yet')).not.toBeInTheDocument();
    expect(container.querySelector('[data-return-to="/groups"][data-section="communities"]'))
      .toBeInTheDocument();
  });

  it('exposes the empty-state destinations as real, named links', () => {
    render(<CommunitiesScreen />);

    expect(screen.getByRole('link', { name: 'Create a new group' }))
      .toHaveAttribute('href', '/create?mode=community');
    expect(screen.getByRole('link', { name: 'Discover groups' }))
      .toHaveAttribute('href', '/discover/communities');
  });

  it('names joined-group navigation, search, clear, and directory controls', async () => {
    communitiesMock.value = {
      communities: [{
        id: 'community-1',
        slug: 'technology-20034560',
        name: 'Technology',
        is_member: true,
        member_count: 20_241,
      }],
      loading: false,
      fetchedOnce: true,
    };

    render(<CommunitiesScreen />);

    const technology = screen.getByRole('link', { name: 'Open group Technology' });
    expect(technology).toHaveAttribute('href', '/community/community-1');
    await userEvent.click(technology);
    expect(cacheMock.setCache).toHaveBeenCalledWith(
      'community:community-1',
      expect.objectContaining({ id: 'community-1', name: 'Technology' }),
    );
    expect(screen.getByRole('link', { name: 'Discover more communities' }))
      .toHaveAttribute('href', '/discover/communities');

    const search = screen.getByRole('textbox', { name: 'Search your groups' });
    await userEvent.type(search, 'tech');
    await userEvent.click(screen.getByRole('button', { name: 'Clear group search' }));
    expect(search).toHaveValue('');
  });
});
