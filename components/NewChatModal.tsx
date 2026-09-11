import * as React from 'react';
import { View, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { invalidate } from '../lib/cache';
import { useProfiles, useAgents } from '../lib/hooks';
import { spacing, radius, shadows } from '../constants/theme';
import { useColors, useInputKeyboardProps } from '../lib/theme';
import { chatConversationHref } from '../lib/chatNavigation';
import {
  buildChatRecipientSuggestions,
  chatRecipientSearchTerm,
  rankChatRecipientSearchResults,
  type ChatRecipientTarget as Target,
} from '../lib/chatRecipientTargets';

const norm = (s: string) => (s || '').toLowerCase().trim();

const profileTarget = (profile: any): Target => ({
  id: profile.id ?? profile.userId,
  name: profile.name || profile.username || 'User',
  username: profile.username,
  avatar: profile.image || profile.avatar || null,
  kind: 'person',
});

const agentTarget = (agent: any): Target => ({
  id: agent.id,
  name: agent.name || agent.username || 'Agent',
  username: agent.username,
  avatar: agent.image || agent.avatar || null,
  kind: 'agent',
});

/**
 * Start-a-new-DM compose, modeled on Signal/iMessage: a search field that
 * matches BOTH people and agents, shows auto-suggested results when empty
 * (recent/active/followed surface first via the existing list hooks), and
 * opens a thread on a single tap. Reuses useProfiles/useAgents for the
 * suggested list and profiles.search + agents.listDiscoverable for live query.
 */
export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Target[]>([]);
  const [followingPeople, setFollowingPeople] = React.useState<Target[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchFailure, setSearchFailure] = React.useState<'all' | 'partial' | null>(null);
  const [searchAttempt, setSearchAttempt] = React.useState(0);
  const [opening, setOpening] = React.useState<string | null>(null);

  // Suggested defaults: followed people are the strongest available social
  // signal, followed by the project directory and a short agent section.
  const { profiles } = useProfiles(visible ? 20 : 0);
  const { agents } = useAgents(visible ? 20 : 0);

  React.useEffect(() => {
    if (!visible || !sdk || !user?.id) {
      setFollowingPeople([]);
      return;
    }
    let cancelled = false;
    sdk.profiles.following(user.id, { limit: 20 })
      .then((response: any) => {
        if (!cancelled) setFollowingPeople((response.data || []).map(profileTarget));
      })
      .catch(() => {
        if (!cancelled) setFollowingPeople([]);
      });
    return () => { cancelled = true; };
  }, [sdk, user?.id, visible]);

  const suggested = React.useMemo<Target[]>(() => {
    const people: Target[] = (profiles || [])
      .filter((p: any) => (p.id ?? p.userId) && (p.id ?? p.userId) !== user?.id)
      .map(profileTarget);
    const agentTargets: Target[] = (agents || []).map(agentTarget);
    return buildChatRecipientSuggestions({
      followingPeople,
      people,
      agents: agentTargets,
      currentUserId: user?.id,
    });
  }, [profiles, agents, followingPeople, user?.id]);

  // Reset transient state each time the modal opens.
  React.useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSearchFailure(null);
      setSearchAttempt(0);
      setOpening(null);
    }
  }, [visible]);

  // Live search: people via profiles.search, agents via the discoverable list
  // (no dedicated agent-search endpoint) filtered client-side. Debounced so
  // typing doesn't fan out a request per keystroke.
  // Retrying intentionally restarts the same settled search.
  // biome-ignore lint/correctness/useExhaustiveDependencies: searchAttempt is the retry generation.
  React.useEffect(() => {
    if (!visible) return;
    const q = chatRecipientSearchTerm(query);
    if (!q) {
      setResults([]);
      setSearching(false);
      setSearchFailure(null);
      return;
    }
    if (!sdk) {
      setSearching(false);
      setSearchFailure('all');
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchFailure(null);
    const t = setTimeout(async () => {
      try {
        const [profRes, agentRes] = await Promise.allSettled([
          sdk.profiles.search
            ? sdk.profiles.search({ q, limit: 15, organization_id: ORG_ID || undefined } as any)
            : Promise.reject(new Error('Profile search is unavailable')),
          sdk.agents.listDiscoverable({ limit: 50 }),
        ]);
        if (cancelled) return;
        const failedSources = [profRes, agentRes].filter((result) => result.status === 'rejected').length;
        setSearchFailure(failedSources === 2 ? 'all' : failedSources === 1 ? 'partial' : null);
        const peopleData = profRes.status === 'fulfilled' ? profRes.value.data || [] : [];
        const agentData = agentRes.status === 'fulfilled' ? agentRes.value.data || [] : [];
        const people: Target[] = peopleData
          .filter((p: any) => (p.id ?? p.userId) && (p.id ?? p.userId) !== user?.id && !p.isAi && !p.is_ai && p.type !== 'agent')
          .map(profileTarget);
        const ql = norm(q);
        const agentMatches: Target[] = agentData
          .filter((a: any) => norm(a.name).includes(ql) || norm(a.username).includes(ql))
          .map(agentTarget);
        setResults(rankChatRecipientSearchResults({
          people,
          agents: agentMatches,
          query: q,
          currentUserId: user?.id,
        }));
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearchFailure('all');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, sdk, visible, user?.id, searchAttempt]);

  const openChat = React.useCallback(async (target: Target) => {
    if (!sdk || opening) return;
    setOpening(target.id);
    try {
      const res = await sdk.chat.dm({ user_id: target.id, organization_id: ORG_ID || undefined } as any);
      const convoId = res.data?.id;
      if (!convoId) { showToast('Could not start conversation', 'error'); setOpening(null); return; }
      // Force the sidebar/list to pick up the new thread without waiting on the
      // WS round-trip.
      invalidate('conversations');
      onClose();
      router.push(chatConversationHref(convoId) as any);
    } catch {
      showToast('Could not start conversation', 'error');
    } finally {
      setOpening(null);
    }
  }, [sdk, opening, onClose, router]);

  const list = query.trim() ? results : suggested;
  const showEmpty = !searching && !searchFailure && query.trim().length > 0 && results.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            width: '100%',
            maxWidth: 460,
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...shadows.lg(colors.shadow),
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Text variant="h3">New message</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close new message"
              style={({ hovered }: any) => ({ padding: spacing.xs, borderRadius: radius.full, backgroundColor: hovered ? colors.glass : 'transparent', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Search field */}
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Search people…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                autoFocus
                accessibilityLabel="Search people or agents"
                {...kbProps}
                {...(Platform.OS === 'web' ? { 'data-form-type': 'other', 'data-lpignore': 'true', name: 'new-chat-search' } as any : {})}
                style={{ flex: 1, paddingVertical: 10, color: colors.text, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />
              {searching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
            </View>
          </View>

          {/* Results / suggestions */}
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!searching && searchFailure && query.trim() && (
              <View
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginHorizontal: spacing.xl,
                  marginBottom: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.errorMuted,
                }}
              >
                <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
                <Text variant="caption" color={colors.error} style={{ flex: 1 }}>
                  {searchFailure === 'all'
                    ? 'Search is unavailable right now.'
                    : 'Some search results could not be loaded.'}
                </Text>
                <Pressable
                  onPress={() => setSearchAttempt((attempt) => attempt + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry search"
                  style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
                >
                  <Text variant="bodyMedium" color={colors.error}>Retry</Text>
                </Pressable>
              </View>
            )}
            {!query.trim() && list.length > 0 && (
              <Text variant="caption" color={colors.textMuted} style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xs, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Suggested
              </Text>
            )}
            {list.map((target) => (
              <Pressable
                key={`${target.kind}-${target.id}`}
                onPress={() => openChat(target)}
                disabled={!!opening}
                accessibilityRole="button"
                accessibilityLabel={`Message ${target.name}${target.username ? `, @${target.username}` : ''}`}
                style={({ pressed, hovered }: any) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: pressed ? colors.surfaceHover : hovered ? colors.glass : 'transparent',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Avatar uri={target.avatar} name={target.name} size="sm" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text variant="bodyMedium" numberOfLines={1}>{target.name}</Text>
                    {target.kind === 'agent' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
                        <Ionicons name="sparkles" size={9} color={colors.accent} />
                        <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>Agent</Text>
                      </View>
                    )}
                  </View>
                  {target.username ? (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 12 }}>@{target.username}</Text>
                  ) : null}
                </View>
                {opening === target.id ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                )}
              </Pressable>
            ))}

            {showEmpty && (
              <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm }}>
                <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted}>No people match “{query.trim()}”.</Text>
              </View>
            )}
            <View style={{ height: spacing.md }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
