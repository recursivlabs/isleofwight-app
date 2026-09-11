import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Search must match what the user sees on screen. Legacy imports store
// entity-encoded text ("We&#039;re…") that communityDescription() decodes for
// display, so the screen's filter has to run over the decoded text too — a
// query typed from the rendered description ("we're") must find the group.

const communitiesMock = vi.hoisted(() => ({
  value: { communities: [] as any[], loading: false },
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
        <React.Fragment key={item.id}>{renderItem({ item, index })}</React.Fragment>
      ))}
    </div>
  ),
  Pressable: ({ children, onPress }: any) => (
    <button type="button" onClick={onPress}>
      {typeof children === 'function' ? children({}) : children}
    </button>
  ),
  Platform: { OS: 'web' },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), setParams: vi.fn() }),
  useLocalSearchParams: () => paramsMock.value,
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: () => <span />,
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../../lib/hooks', () => ({
  useCommunities: () => communitiesMock.value,
}));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844', bg: '#111', glass: '#222', glassBorder: '#333',
    text: '#fff', textMuted: '#aaa', textSecondary: '#ccc',
  }),
}));

vi.mock('../../lib/discover', () => ({
  FilterMenu: () => <nav />,
  FilterBar: () => <nav />,
  ListSkeleton: () => <span>Loading</span>,
  CommunityRow: ({ community }: any) => <article>{community.name}</article>,
  communityMemberCount: (c: any) => c.member_count || 0,
  communityActivity: (c: any) => c.member_count || 0,
}));

import DiscoverCommunities from '../../app/(tabs)/discover/communities';

const LEGACY = {
  id: 'community-legacy',
  name: 'Meme Supreme',
  description: 'We&#039;re here &amp; ready.',
  member_count: 8_023,
};
const PLAIN = {
  id: 'community-plain',
  name: 'Gardening',
  description: 'Grow things together.',
  member_count: 12,
};

describe('Discover communities search over legacy descriptions', () => {
  beforeEach(() => {
    communitiesMock.value = { communities: [LEGACY, PLAIN], loading: false };
    paramsMock.value = {};
  });

  it('matches a query typed from the decoded description the user sees', () => {
    paramsMock.value = { q: "we're" };

    render(<DiscoverCommunities />);

    expect(screen.getByText('Meme Supreme')).toBeInTheDocument();
    expect(screen.queryByText('Gardening')).not.toBeInTheDocument();
  });

  it('still matches plain descriptions and names (positive control)', () => {
    paramsMock.value = { q: 'grow' };

    render(<DiscoverCommunities />);

    expect(screen.getByText('Gardening')).toBeInTheDocument();
    expect(screen.queryByText('Meme Supreme')).not.toBeInTheDocument();
  });
});
