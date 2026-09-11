import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Federation search tab must work against the rows GET /protocols/search
// actually serializes (recursiv packages/server/src/features/api-keys/rest/
// routes/protocols.ts): `author` is an OBJECT — { id, name, image, is_remote,
// remote_protocol, remote_handle, remote_profile_url } — and no `source` or
// bare-string author field exists. The screen rendered
// `{r.author || r.source || 'Unknown source'}` inside <Text>, so the first
// search that returned any result handed React an object child and threw
// ("Objects are not valid as a React child") — the tab crashed on success and
// only worked while empty. A failed search was also swallowed into
// setSearchResults([]), indistinguishable from zero matches. Same defect class
// as #766 / PR #791 / PR #792 / PR #793.

const protocolsApi = vi.hoisted(() => ({
  list: vi.fn(),
  getSettings: vi.fn(),
  search: vi.fn(),
  updateSettings: vi.fn(),
  listCandidates: vi.fn(),
  getCandidate: vi.fn(),
}));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => {
  // Match AuthProvider: the SDK stays stable across ordinary screen renders.
  const sdk = { protocols: protocolsApi };
  return { useAuth: () => ({ sdk }) };
});
vi.mock('../../components/Toast', () => ({ showToast }));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1', BASE_URL: 'https://api.example' }));

import ProtocolsScreen from '../../app/protocols';

// Contract-shaped payloads, exactly as the engine returns them.
const adapterMeta = {
  id: 'activitypub',
  name: 'ActivityPub',
  icon: 'globe-outline',
  color: '#563acc',
  maturity: 'beta',
  capabilities: { discover: 'supported' },
  limitations: [],
};

const settingsPayload = {
  data: {
    collection_enabled: false,
    project_id: 'proj-1',
    enabled_protocols: [],
    search_terms: [],
    available_protocols: [adapterMeta],
  },
};

const searchRow = {
  id: 'post-1',
  content: 'A federated post about relays and gardens.',
  content_format: null,
  title: 'Relays and gardens',
  protocol: 'activitypub',
  external_url: 'https://fedi.example/notes/1',
  like_count: 3,
  repost_count: 1,
  reply_count_external: 0,
  score: null,
  published_at: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  rank: 0.42,
  author: {
    id: 'user-1',
    name: 'Ada Fedi',
    image: null,
    is_remote: true,
    remote_protocol: 'activitypub',
    remote_handle: '@ada@fedi.example',
    remote_profile_url: 'https://fedi.example/@ada',
  },
};

async function openSearchTabAndSearch(query: string) {
  render(<ProtocolsScreen />);
  await userEvent.click(await screen.findByText('search'));
  await userEvent.type(screen.getByPlaceholderText('Search federated content...'), query);
  await userEvent.click(screen.getByText('Search'));
}

beforeEach(() => {
  vi.clearAllMocks();
  protocolsApi.list.mockResolvedValue({ data: [adapterMeta] });
  protocolsApi.getSettings.mockResolvedValue(settingsPayload);
  protocolsApi.listCandidates.mockResolvedValue({ data: [], meta: { has_more: false, next_cursor: null } });
});

describe('Federation search contract shape', () => {
  it('loads private candidates only when the admin selects the candidates tab', async () => {
    render(<ProtocolsScreen />);
    const tab = await screen.findByRole('button', { name: 'candidates' });
    expect(protocolsApi.listCandidates).not.toHaveBeenCalled();
    await userEvent.click(tab);
    expect(await screen.findByText('No candidates have been collected for this app.')).toBeInTheDocument();
    expect(protocolsApi.listCandidates).toHaveBeenCalledExactlyOnceWith({ limit: 20 });
    expect(protocolsApi.updateSettings).not.toHaveBeenCalled();
    expect(protocolsApi.search).not.toHaveBeenCalled();
  });
  it('renders a result with its author name, not a crashed tab', async () => {
    protocolsApi.search.mockResolvedValue({
      data: [searchRow],
      meta: { limit: 20, offset: 0, has_more: false },
    });

    await openSearchTabAndSearch('gardens');

    // `author` is an object; rendering it as a Text child threw. The row
    // must show the author's display name.
    expect(await screen.findByText('Relays and gardens')).toBeInTheDocument();
    expect(screen.getByText('Ada Fedi')).toBeInTheDocument();
    expect(screen.getByText('activitypub')).toBeInTheDocument();
  });

  it('falls back to the remote handle, then Unknown source, for authorless rows', async () => {
    protocolsApi.search.mockResolvedValue({
      data: [
        {
          ...searchRow,
          id: 'post-2',
          title: null,
          author: { ...searchRow.author, id: 'user-2', name: '' },
        },
        {
          ...searchRow,
          id: 'post-3',
          title: 'Orphaned import',
          author: {
            id: null,
            name: null,
            image: null,
            is_remote: null,
            remote_protocol: null,
            remote_handle: null,
            remote_profile_url: null,
          },
        },
      ],
      meta: { limit: 20, offset: 0, has_more: false },
    });

    await openSearchTabAndSearch('gardens');

    // Untitled row falls back to its content; empty name falls back to handle.
    expect(await screen.findByText('A federated post about relays and gardens.')).toBeInTheDocument();
    expect(screen.getByText('@ada@fedi.example')).toBeInTheDocument();
    // LEFT JOIN with no user row nulls every author field.
    expect(screen.getByText('Unknown source')).toBeInTheDocument();
  });

  it('says a failed search failed instead of impersonating zero matches', async () => {
    protocolsApi.search.mockRejectedValue(new Error('search unavailable'));

    await openSearchTabAndSearch('gardens');

    expect(
      await screen.findByText("Couldn't search federated content. Check your connection and try again."),
    ).toBeInTheDocument();
    // The idle caption is the zero-matches state; it must not show for a failure.
    expect(screen.queryByText('Search ActivityPub, RSS, and Nostr content')).not.toBeInTheDocument();
  });

  it('recovers: a search after a failure clears the error and shows results', async () => {
    protocolsApi.search.mockRejectedValueOnce(new Error('search unavailable'));
    protocolsApi.search.mockResolvedValue({
      data: [searchRow],
      meta: { limit: 20, offset: 0, has_more: false },
    });

    await openSearchTabAndSearch('gardens');
    expect(
      await screen.findByText("Couldn't search federated content. Check your connection and try again."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('Relays and gardens')).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't search federated content. Check your connection and try again."),
    ).not.toBeInTheDocument();
  });
});
