import * as React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../../components';
import { useAgents } from '../../../lib/hooks';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { timestampOf } from '../../../lib/models';
import { FilterMenu, FilterBar, AgentRow, ListSkeleton, agentPopularity } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Agents tab — leaderboard by popularity. The agent payload carries no
// engagement signal yet, so "popularity" falls back to native discoverable
// order, lifted by any usage/chat-count field when one exists. A query
// client-filters the loaded list (there's no agent search endpoint).
// ──────────────────────────────────────────────────────────────────────────

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

type AgentSort = 'popular' | 'newest' | 'az';
const CHIPS: { key: AgentSort; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'newest', label: 'Newest' },
  { key: 'az', label: 'A–Z' },
];

export default function DiscoverAgents() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string }>();
  const colors = useColors();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Sort lives in the URL so it deep-links + survives back/forward.
  const sort: AgentSort = (params.sort === 'newest' || params.sort === 'az') ? params.sort : 'popular';
  const setSort = React.useCallback((k: AgentSort) => router.setParams({ sort: k === 'popular' ? undefined : k } as any), [router]);
  // 100 is the server's max for /agents/discoverable — fetch the whole set.
  const { agents, loading } = useAgents(100);

  const ranked = React.useMemo(() => {
    let list = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));
    if (isSearching) {
      const q = query.toLowerCase();
      list = list.filter((a: any) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.bio || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q));
    }
    if (sort === 'newest') {
      return [...list].sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    if (sort === 'az') {
      return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    // popular — native featured order, lifted by any real usage signal.
    return [...list].sort((a, b) => agentPopularity(b) - agentPopularity(a));
  }, [agents, isSearching, query, sort]);

  const toAgent = (a: any) => router.push(`/${a.username || a.id}` as any);

  if (loading && (agents || []).length === 0) return <ListSkeleton />;

  return (
    <FlatList
      data={ranked}
      keyExtractor={(item: any, i) => `a-${item.id || i}`}
      renderItem={({ item }) => <AgentRow agent={item} onPress={() => toAgent(item)} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {!isSearching && (
            <FilterBar>
              <FilterMenu options={CHIPS} value={sort} icon="swap-vertical" onChange={setSort} />
            </FilterBar>
          )}
          {ranked.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching ? `${ranked.length} result${ranked.length !== 1 ? 's' : ''}` : `${ranked.length} agents you can chat with`}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        // Intentional empty state. This network has no project-scoped agents yet
        // (and we deliberately do NOT surface cross-tenant / global agents), so
        // the tab should read as "nothing here yet" — calm and finished — rather
        // than looking like a failed load.
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.glass,
              marginBottom: spacing.sm,
            }}
          >
            <Ionicons name="hardware-chip-outline" size={34} color={colors.textMuted} />
          </View>
          <Text variant="h2" color={colors.text} align="center">
            {isSearching ? 'No agents found' : 'No agents here yet'}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320, lineHeight: 24 }}>
            {isSearching
              ? 'No agents match that search. Try a different term.'
              : 'AI agents you can chat with will appear here once they join this community.'}
          </Text>
        </View>
      }
    />
  );
}
