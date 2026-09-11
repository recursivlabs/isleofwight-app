import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The People tab's search path calls GET /profiles/search directly through the
// SDK. The engine (recursiv packages/server/src/features/api-keys/rest/routes/
// profiles.ts, formatUser) serializes each row as { id, name, username, image,
// bio, … } inside a { data, meta } envelope. Two honesty rules under test:
//
//  1. Rows the engine actually sends must reach the list (through the real
//     filterJunkCreators quality gate — the fixtures are shaped like real
//     accounts, with a bio, so the gate must pass them).
//  2. A FAILED request must never wear the empty state's clothes. The screen
//     used to swallow a rejected search into setSearchedPeople([]), rendering
//     "No Results · Try a different search term" — wrong advice when the truth
//     is the request never came back. Same defect class as protocols (#794)
//     and org-settings (#765). Browse mode had the same hole: a directory
//     outage rendered "As creators join, they show up here".

const profilesApi = vi.hoisted(() => ({
  search: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}));

// Every mocked hook below returns IDENTITY-STABLE values (module-level
// constants), matching production where sdk/router/following-set identities
// come from context or state and do not change render-to-render. A mock that
// returns a fresh object per call puts unstable identities into the screen's
// effect deps and manufactures render loops the real app does not have.
const authValue = vi.hoisted(() => ({
  sdk: { profiles: profilesApi },
  user: { id: 'viewer-1' },
}));
const routerValue = vi.hoisted(() => ({ push: vi.fn(), setParams: vi.fn() }));
const followingValue = vi.hoisted(() => ({ followingIds: new Set<string>(), loading: false }));

const profilesMock = vi.hoisted(() => ({
  value: { profiles: [] as any[], loading: false, error: null as string | null },
}));
const leaderboardMock = vi.hoisted(() => ({
  value: { entries: [] as any[], byId: new Map(), orderedIds: [] as string[], loading: false },
}));
const paramsMock = vi.hoisted(() => ({
  value: {} as Record<string, string>,
}));

vi.mock('react-native', () => ({
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
    <div>
      {ListHeaderComponent}
      {data.length === 0 && ListEmptyComponent}
      {data.map((item: any, index: number) => (
        <React.Fragment key={item.id || index}>{renderItem({ item, index })}</React.Fragment>
      ))}
    </div>
  ),
  Pressable: ({ children, onPress, accessibilityLabel }: any) => (
    <button type="button" onClick={onPress} aria-label={accessibilityLabel}>
      {typeof children === 'function' ? children({}) : children}
    </button>
  ),
  Platform: { OS: 'web' },
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerValue,
  useLocalSearchParams: () => paramsMock.value,
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: () => <span />,
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844', bg: '#111', text: '#fff', textMuted: '#aaa',
    textSecondary: '#ccc', textOnAccent: '#111', borderSubtle: '#333',
    surfaceHover: '#222',
  }),
}));

vi.mock('../../lib/hooks', () => ({
  useProfiles: () => profilesMock.value,
  useProfileLeaderboard: () => leaderboardMock.value,
  useFollowingIds: () => followingValue,
}));

vi.mock('../../lib/discover', () => ({
  FilterMenu: () => <nav />,
  FilterBar: ({ children }: any) => <nav>{children}</nav>,
  ListSkeleton: () => <span>Loading</span>,
  PersonRow: ({ person }: any) => (
    <article>
      {person.name}
      {person.username ? ` @${person.username}` : ''}
    </article>
  ),
}));

vi.mock('../../lib/follows', () => ({ afterFollowChange: vi.fn() }));

import DiscoverPeople from '../../app/(tabs)/discover/people';

// Contract-shaped rows, exactly as formatUser serializes them (bio non-empty so
// the real filterJunkCreators gate — deliberately NOT mocked — passes them).
const SEARCH_ROWS = [
  {
    id: 'user-1', name: 'Ada Lovelace', username: 'ada', image: null, banner: null,
    bio: 'Analytical engines', location: null, website: null, is_ai: false,
    plus: false, pro: false, founder: false, created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2', name: 'Grace Hopper', username: 'grace', image: null, banner: null,
    bio: 'Compilers', location: null, website: null, is_ai: false,
    plus: false, pro: false, founder: false, created_at: '2026-01-02T00:00:00.000Z',
  },
];

beforeEach(() => {
  profilesMock.value = { profiles: [], loading: false, error: null };
  leaderboardMock.value = { entries: [], byId: new Map(), orderedIds: [], loading: false };
  paramsMock.value = {};
});

describe('Discover People — search contract', () => {
  it('renders the rows GET /profiles/search actually serializes', async () => {
    paramsMock.value = { q: 'a' };
    profilesApi.search.mockResolvedValue({ data: SEARCH_ROWS, meta: { limit: 20, offset: 0, has_more: false } });

    render(<DiscoverPeople />);

    expect(await screen.findByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/@grace/)).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(profilesApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'a', limit: 20, organization_id: 'org-1' }),
    );
  });

  it('still shows the real empty state when the server answers with zero matches', async () => {
    paramsMock.value = { q: 'zzz' };
    profilesApi.search.mockResolvedValue({ data: [], meta: { limit: 20, offset: 0, has_more: false } });

    render(<DiscoverPeople />);

    expect(await screen.findByText('No Results')).toBeInTheDocument();
    expect(screen.getByText('Try a different search term.')).toBeInTheDocument();
  });
});

describe('Discover People — outage honesty', () => {
  it('reports a failed search instead of presenting it as no results, and retries in place', async () => {
    paramsMock.value = { q: 'ada' };
    profilesApi.search.mockRejectedValue(new Error('search offline'));

    render(<DiscoverPeople />);

    expect(await screen.findByText('Search Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Couldn't search people/)).toBeInTheDocument();
    // The failure must NOT render the zero-matches empty state.
    expect(screen.queryByText('No Results')).not.toBeInTheDocument();
    expect(screen.queryByText('Try a different search term.')).not.toBeInTheDocument();

    profilesApi.search.mockResolvedValue({ data: SEARCH_ROWS, meta: { limit: 20, offset: 0, has_more: false } });
    await userEvent.click(screen.getByRole('button', { name: 'Retry people search' }));

    expect(await screen.findByText(/Ada Lovelace/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Search Unavailable')).not.toBeInTheDocument(),
    );
  });

  it('reports a directory outage in browse mode instead of an empty network', async () => {
    profilesMock.value = { profiles: [], loading: false, error: 'Failed to load profiles' };

    render(<DiscoverPeople />);

    expect(await screen.findByText("Couldn't Load Creators")).toBeInTheDocument();
    expect(screen.queryByText('As creators join, they show up here.')).not.toBeInTheDocument();
    expect(screen.queryByText('Discover Channels')).not.toBeInTheDocument();
  });

  it('keeps the genuine browse empty state when the directory is truly empty', async () => {
    render(<DiscoverPeople />);

    expect(await screen.findByText('Discover Channels')).toBeInTheDocument();
    expect(screen.getByText('As creators join, they show up here.')).toBeInTheDocument();
  });
});
