import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Linking } from 'react-native';
import { ProtocolCandidates, type CandidatePreview } from '../../components/ProtocolCandidates';

const item: CandidatePreview = {
  id: 'candidate-1', provider: 'hackernews', external_id: '12345', state: 'quarantined',
  title: 'A garden sensor', content: 'An attributed source preview.', content_format: 'plain',
  content_truncated: false, source_url: 'https://news.ycombinator.com/item?id=12345',
  author: { display_name: 'Ada', handle: 'ada', native_id: 'hn:ada', profile_url: null },
  published_at: '2026-09-09T10:00:00Z', observed_at: '2026-09-09T10:05:00Z',
  created_at: '2026-09-09T10:05:01Z',
};
const page = (items = [item], cursor: string | null = null) => ({
  data: items, meta: { limit: 20, has_more: !!cursor, next_cursor: cursor },
});
const reader = () => ({ listCandidates: vi.fn().mockResolvedValue(page()),
  getCandidate: vi.fn().mockResolvedValue({ data: item }) });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('private protocol candidate review', () => {
  it('fetches only the private SDK page and fresh detail, retaining native provenance', async () => {
    const api = reader();
    api.getCandidate.mockResolvedValue({ data: { ...item, content: 'Fresh detail from the reader.' } });
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    render(<ProtocolCandidates resource={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review A garden sensor' }));
    expect(await screen.findByText('Fresh detail from the reader.')).toBeInTheDocument();
    expect(screen.getByText('Native author ID: hn:ada')).toBeInTheDocument();
    expect(screen.getByText('Native content ID: 12345')).toBeInTheDocument();
    expect(screen.getByText('Quarantined · Not published')).toBeInTheDocument();
    expect(api.listCandidates).toHaveBeenCalledExactlyOnceWith({ limit: 20 });
    expect(api.getCandidate).toHaveBeenCalledExactlyOnceWith('candidate-1');
    expect(open).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Open original source' }));
    expect(open).toHaveBeenCalledExactlyOnceWith(item.source_url);
  });

  it('renders remote text literally and withholds non-web links', async () => {
    const api = reader();
    api.getCandidate.mockResolvedValue({ data: { ...item, content: '<img src=x onerror=alert(1)>',
      source_url: 'javascript:alert(1)' } });
    render(<ProtocolCandidates resource={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review A garden sensor' }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open original source' })).not.toBeInTheDocument();
  });

  it('shows signed-out, failed-read and empty states distinctly', async () => {
    const api = reader();
    api.listCandidates.mockRejectedValue({ status: 404 });
    const view = render(<ProtocolCandidates />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in again');
    view.rerender(<ProtocolCandidates resource={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('not available on this service');
    expect(screen.queryByText('No candidates have been collected for this app.')).not.toBeInTheDocument();
    api.listCandidates.mockResolvedValue(page([]));
    await userEvent.click(screen.getByRole('button', { name: 'Retry candidates' }));
    expect(await screen.findByText('No candidates have been collected for this app.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('passes only the opaque continuation cursor and deduplicates overlapping pages', async () => {
    const api = reader();
    api.listCandidates.mockResolvedValueOnce(page([item], 'opaque-cursor'))
      .mockResolvedValueOnce(page([item, { ...item, id: 'candidate-2', title: 'Another sensor' }]));
    render(<ProtocolCandidates resource={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more candidates' }));
    expect(await screen.findByRole('button', { name: 'Review Another sensor' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Review A garden sensor' })).toHaveLength(1);
    expect(api.listCandidates).toHaveBeenLastCalledWith({ limit: 20, cursor: 'opaque-cursor' });
    expect(screen.queryByRole('button', { name: 'Load more candidates' })).not.toBeInTheDocument();
  });

  it('clears already-visible data when current detail authority is denied', async () => {
    const api = reader();
    api.getCandidate.mockRejectedValue({ status: 403 });
    render(<ProtocolCandidates resource={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review A garden sensor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('current app-admin access');
    expect(screen.queryByText('A garden sensor')).not.toBeInTheDocument();
    expect(screen.queryByText(item.content)).not.toBeInTheDocument();
  });

  it('hides the previous account immediately and ignores its late detail response', async () => {
    const first = reader();
    const second = reader();
    const detail = deferred<{ data: CandidatePreview }>();
    const nextPage = deferred<ReturnType<typeof page>>();
    first.getCandidate.mockReturnValue(detail.promise);
    second.listCandidates.mockReturnValue(nextPage.promise);
    const view = render(<ProtocolCandidates resource={first} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review A garden sensor' }));
    view.rerender(<ProtocolCandidates resource={second} />);
    await act(async () => { detail.resolve({ data: { ...item, content: 'Previous account private detail' } }); });
    expect(screen.queryByText('Previous account private detail')).not.toBeInTheDocument();
    await act(async () => { nextPage.resolve(page([])); });
    expect(await screen.findByText('No candidates have been collected for this app.')).toBeInTheDocument();
  });

  it('ignores a late list response after sign-out', async () => {
    const api = reader();
    const pending = deferred<ReturnType<typeof page>>();
    api.listCandidates.mockReturnValue(pending.promise);
    const view = render(<ProtocolCandidates resource={api} />);
    await waitFor(() => expect(api.listCandidates).toHaveBeenCalledTimes(1));
    view.rerender(<ProtocolCandidates resource={undefined} />);
    await act(async () => { pending.resolve(page()); });
    expect(screen.queryByText('A garden sensor')).not.toBeInTheDocument();
  });

  it('rejects a non-quarantined representation instead of exposing it as a candidate', async () => {
    const api = reader();
    api.listCandidates.mockResolvedValue(page([{ ...item, state: 'approved' } as unknown as CandidatePreview]));
    render(<ProtocolCandidates resource={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load candidates');
    expect(screen.queryByText('A garden sensor')).not.toBeInTheDocument();
  });
});
