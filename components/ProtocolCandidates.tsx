import * as React from 'react';
import type { ProtocolQuarantinedCandidate, ProtocolsResource } from '@recursiv/sdk';
import { Linking, Pressable, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { Skeleton } from './Skeleton';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

export type CandidatePreview = ProtocolQuarantinedCandidate;
type CandidateReader = Pick<ProtocolsResource, 'listCandidates' | 'getCandidate'>;

function readError(error: unknown): string {
  const status = error && typeof error === 'object'
    ? (error as { status?: number; statusCode?: number }).status
      ?? (error as { statusCode?: number }).statusCode : undefined;
  if (status === 401 || status === 403) return 'Your account cannot review these candidates. Sign in with current app-admin access.';
  if (status === 404 || status === 501) return 'Candidate review is not available on this service yet.';
  return 'Could not load candidates. Check your connection and try again.';
}

function safeSource(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString();
}

function assertQuarantined(candidate: CandidatePreview) {
  if (candidate.state !== 'quarantined' || candidate.content_format !== 'plain') {
    throw new Error('Unexpected candidate representation');
  }
}

type QueueState = {
  owner: unknown;
  items: CandidatePreview[];
  cursor: string | null;
  loading: boolean;
  error: string | null;
  detail: CandidatePreview | null;
  detailLoading: boolean;
};

function emptyQueue(owner: unknown): QueueState {
  return { owner, items: [], cursor: null, loading: true, error: null, detail: null, detailLoading: false };
}

export function ProtocolCandidates({ resource }: { resource?: CandidateReader }) {
  const colors = useColors();
  const reader = resource;
  const [queue, setQueue] = React.useState<QueueState>(() => emptyQueue(resource));
  const generation = React.useRef(0);
  const pending = React.useRef(false);
  const detailGeneration = React.useRef(0);
  const source = React.useRef(resource);
  source.current = resource;

  const load = React.useCallback(async (cursor?: string) => {
    if (!reader || pending.current) return;
    pending.current = true;
    const request = ++generation.current;
    detailGeneration.current++;
    setQueue(current => cursor
      ? { ...current, loading: true, error: null, detail: null, detailLoading: false }
      : emptyQueue(resource));
    try {
      const page = await reader.listCandidates({ limit: 20, ...(cursor ? { cursor } : {}) });
      page.data.forEach(assertQuarantined);
      if (page.meta.has_more && (!page.meta.next_cursor || page.meta.next_cursor === cursor)) {
        throw new Error('Invalid continuation cursor');
      }
      if (request !== generation.current || source.current !== resource) return;
      setQueue(current => {
        const items = cursor ? [...current.items] : [];
        const ids = new Set(items.map(item => item.id));
        for (const item of page.data) if (!ids.has(item.id)) { items.push(item); ids.add(item.id); }
        return { ...current, owner: resource, items, loading: false, error: null,
          cursor: page.meta.has_more ? page.meta.next_cursor : null };
      });
    } catch (error) {
      if (request !== generation.current || source.current !== resource) return;
      // Never keep privileged content visible after a denied read. A retry
      // reloads the whole queue, so failure cannot strand an opaque cursor.
      setQueue({ ...emptyQueue(resource), loading: false, error: readError(error) });
    } finally {
      if (request === generation.current) pending.current = false;
    }
  }, [reader, resource]);

  React.useEffect(() => {
    pending.current = false;
    setQueue(emptyQueue(resource));
    if (reader) void load();
    return () => { generation.current++; detailGeneration.current++; pending.current = false; };
  }, [load, reader, resource]);

  const openDetail = async (id: string) => {
    if (!reader) return;
    const request = ++detailGeneration.current;
    setQueue(current => ({ ...current, detail: null, detailLoading: true, error: null }));
    try {
      const response = await reader.getCandidate(id);
      assertQuarantined(response.data);
      if (response.data.id !== id) throw new Error('Candidate identity mismatch');
      if (request !== detailGeneration.current || source.current !== resource) return;
      setQueue(current => ({ ...current, detail: response.data, detailLoading: false }));
    } catch (error) {
      if (request !== detailGeneration.current || source.current !== resource) return;
      setQueue({ ...emptyQueue(resource), loading: false, error: readError(error) });
    }
  };

  if (!reader) return <Text accessibilityRole="alert">Sign in again to review candidates.</Text>;
  // Auth/resource changes hide old content synchronously, before effect cleanup.
  const visible = queue.owner === resource ? queue : emptyQueue(resource);
  const detail = visible.detail;
  const sourceUrl = safeSource(detail?.source_url ?? null);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="h3">Candidate review</Text>
        <Text color={colors.textMuted}>Private source material awaiting review. These items are not published to Minds.</Text>
      </View>
      {visible.error && (
        <View style={{ gap: spacing.md }}>
          <Text accessibilityRole="alert">{visible.error}</Text>
          <Button onPress={() => void load()} size="sm" variant="secondary">Retry candidates</Button>
        </View>
      )}
      {(visible.loading || visible.detailLoading) && (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading candidates" style={{ gap: spacing.sm }}>
          <Skeleton height={70} /><Skeleton height={70} />
        </View>
      )}
      {detail ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Button variant="ghost" size="sm" onPress={() => {
              detailGeneration.current++;
              setQueue(current => ({ ...current, detail: null, detailLoading: false }));
            }}>Back to candidates</Button>
            <Text variant="caption" color={colors.accent}>Quarantined · Not published</Text>
            <Text variant="h3">{detail.title || 'Untitled source item'}</Text>
            <Text selectable>{detail.content || 'No text preview was provided.'}</Text>
            {detail.content_truncated && <Text variant="caption">Preview shortened. Open the original source for the full item.</Text>}
            <Text>{detail.author.display_name || detail.author.handle || 'Author not provided'}</Text>
            <Text variant="caption" selectable>Source: {detail.provider}</Text>
            <Text variant="caption" selectable>Native author ID: {detail.author.native_id || 'Not provided'}</Text>
            <Text variant="caption" selectable>Native content ID: {detail.external_id || 'Not provided'}</Text>
            <Text variant="caption">Published at source: {dateLabel(detail.published_at)}</Text>
            <Text variant="caption">Observed: {dateLabel(detail.observed_at)}</Text>
            {sourceUrl ? (
              <Button variant="secondary" size="sm" onPress={() => {
                void Linking.openURL(sourceUrl).catch(() => setQueue(current => ({ ...current,
                  error: 'Could not open the source. Try again.' })));
              }}>Open original source</Button>
            ) : <Text variant="caption">No verified source link is available.</Text>}
          </View>
        </Card>
      ) : !visible.detailLoading && (
        <>
          {!visible.loading && !visible.error && visible.items.length === 0 && (
            <Text>No candidates have been collected for this app.</Text>
          )}
          {visible.items.map(item => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Review ${item.title || 'untitled source item'}`}
              onPress={() => void openDetail(item.id)} disabled={visible.loading}>
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="caption" color={colors.accent}>{item.provider} · Quarantined</Text>
                  <Text variant="bodyMedium">{item.title || 'Untitled source item'}</Text>
                  <Text numberOfLines={3}>{item.content}</Text>
                  <Text variant="caption">{item.author.display_name || item.author.handle || 'Author not provided'}</Text>
                  <Text variant="caption">Observed {dateLabel(item.observed_at)}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
          {!!visible.cursor && !visible.error && (
            <Button variant="secondary" size="sm" loading={visible.loading}
              onPress={() => { if (visible.cursor) void load(visible.cursor); }}>Load more candidates</Button>
          )}
          {!visible.loading && !visible.error && (
            <Button variant="ghost" size="sm" onPress={() => void load()}>Reload candidates</Button>
          )}
        </>
      )}
    </View>
  );
}
