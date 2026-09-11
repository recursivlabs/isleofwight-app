/**
 * Global command palette — Cmd+K opens a modal overlay that doubles
 * as search-anywhere and a slash-command runner. Inspired by Linear /
 * Raycast / Slack / VSCode quick-open. Stays mounted at root so it's
 * available from any screen.
 *
 * What lives in it:
 *   - Plain text → unified search (posts + people + communities + agents)
 *   - @user      → user autocomplete
 *   - /find <q>  → jump to Discover filtered to that query
 *   - /post      → open compose
 *   - /dm <user> → open or create a DM with <user>
 *   - /ask <q>   → open personal-agent DM with prompt prefilled
 *   - /switch <community> → community jump
 *
 * Recent searches persist via lib/cache so the empty state shows
 * something useful on next open.
 */
import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useProfiles } from '../lib/hooks';
import { registerShortcut } from '../lib/keyboard';
import { getCached, setCache } from '../lib/cache';
import { ORG_ID } from '../lib/recursiv';
import { communityDescription, profileFollowerCount, profilePostCount } from '../lib/models';
import { filterJunkCreators } from '../lib/quality';
import { spacing, radius, typography } from '../constants/theme';
import { useColors } from '../lib/theme';

type ResultKind = 'post' | 'user' | 'community' | 'agent' | 'command' | 'recent' | 'search';
interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  onPress: () => void;
}

const RECENT_KEY = 'minds:command-palette:recent';
const RECENT_LIMIT = 5;

function loadRecent(): string[] {
  try {
    const cached = getCached(RECENT_KEY);
    if (Array.isArray(cached)) return cached.slice(0, RECENT_LIMIT);
  } catch {}
  return [];
}

function pushRecent(query: string) {
  if (!query.trim()) return;
  const current = loadRecent();
  const deduped = [query, ...current.filter((q) => q !== query)].slice(0, RECENT_LIMIT);
  setCache(RECENT_KEY, deduped);
}

export function CommandPalette() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const [open, setOpen] = React.useState(false);
  // Cached directory (shared with discover/sidebar) — powers INSTANT local
  // prefix matches so people results appear at keystroke speed instead of
  // waiting on the seconds-long full-corpus server search. Keep the hook
  // mounted so it can adopt an already-warm cache, but do not launch a 200-row
  // directory request until the user actually opens the palette.
  const { profiles: directory } = useProfiles(200, open);
  const colors = useColors();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<TextInput>(null);

  // Bind Cmd+K / Ctrl+K globally.
  React.useEffect(() => {
    const unsub = registerShortcut('mod+k', () => {
      setOpen((o) => !o);
    });
    const unsubEsc = registerShortcut('escape', () => {
      setOpen(false);
    });
    return () => {
      unsub();
      unsubEsc();
    };
  }, []);

  // Reset state when opening; auto-focus the input on web.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setActiveIdx(0);
    // RN doesn't always autofocus in modals; force it.
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  const close = React.useCallback(() => {
    setOpen(false);
  }, []);

  const runFind = React.useCallback((q: string) => {
    pushRecent(q);
    close();
    // A bare name or handle (one token, no #) is almost always a person search —
    // send it to People, not Posts, so the channel the user wants is the result.
    // Hashtags and multi-word/phrase queries go to Posts.
    const nameLike = /^[a-z0-9_.]+$/i.test(q);
    const dest = nameLike ? 'people' : 'posts';
    router.push(`/(tabs)/discover/${dest}?q=${encodeURIComponent(q)}` as any);
  }, [router, close]);

  // Debounced unified search — auto-suggests creators, communities, and agents
  // (plus a few post hits), or Enter jumps to Discover. Runs when query changes.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();

    if (!q) {
      // Empty state: surface recent searches + a few suggested commands
      // so the palette feels alive on open.
      const recents: Result[] = loadRecent().map((r) => ({
        kind: 'recent' as const,
        id: `recent:${r}`,
        title: r,
        subtitle: 'Recent search',
        onPress: () => runFind(r),
      }));
      setResults(recents);
      setActiveIdx(0);
      return;
    }

    // Slash commands fire on Enter (handled in onSubmitEditing).
    // Live result preview also honors @-handles and just-text search.
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      if (!sdk) { setLoading(false); return; }

      // @ prefix = user-only search.
      if (q.startsWith('@')) {
        const handle = q.slice(1);
        sdk.profiles.search({ q: handle || 'a', limit: 8 })
          .then((res: any) => {
            if (cancelled) return;
            setResults((res.data || []).map((p: any) => ({
              kind: 'user' as const,
              id: p.id,
              title: p.name || p.username || 'Unknown',
              subtitle: p.username ? `@${p.username}` : undefined,
              avatar: p.image || p.avatar,
              onPress: () => { close(); router.push(`/${p.username || p.id}` as any); },
            })));
            setActiveIdx(0);
          })
          .catch(() => { if (!cancelled) setResults([]); })
          .finally(() => { if (!cancelled) setLoading(false); });
        return;
      }

      const qLower = q.toLowerCase();

      // Each lane races a soft timeout. Posts full-text search on a rare name
      // (e.g. "ottman") can run to the SDK's 300s ceiling; without this the whole
      // palette sat on "Searching…" until that one lane returned. A timed-out
      // lane degrades to empty instead of freezing everything.
      const lane = (p: Promise<any>, ms = 3500): Promise<any> => Promise.race([
        p.catch(() => ({ data: [], _failed: true })),
        new Promise<any>((res) => setTimeout(() => res({ data: [], _timedOut: true }), ms)),
      ]);

      // The default action leads the list and is pre-selected, so Enter works
      // immediately — even before any lane resolves.
      const searchRow: Result = {
        kind: 'search',
        id: 'search',
        title: `Search Minds for "${q}"`,
        subtitle: 'Enter',
        onPress: () => runFind(q),
      };
      let profileRows: Result[] = [];
      let communityRows: Result[] = [];
      let agentRows: Result[] = [];
      let postRows: Result[] = [];
      const render = () => {
        if (cancelled) return;
        setResults([searchRow, ...profileRows, ...communityRows, ...agentRows, ...postRows]);
        setActiveIdx(0);
      };
      render(); // show the search row instantly

      // INSTANT: match the already-cached directory synchronously so people
      // results paint at keystroke speed. The server lane below refines/replaces
      // these once it returns (it searches the full 3M-user corpus).
      {
        const bucket = (p: any) => {
          const un = (p.username || '').toLowerCase();
          const nm = (p.name || '').toLowerCase();
          if (un === qLower || nm === qLower) return 0;
          if (un.startsWith(qLower) || nm.startsWith(qLower)) return 1;
          return 2;
        };
        const local = filterJunkCreators((directory || []).filter((p: any) =>
          (p.username || '').toLowerCase().includes(qLower) || (p.name || '').toLowerCase().includes(qLower)))
          .sort((a: any, b: any) => bucket(a) - bucket(b) || profileFollowerCount(b) - profileFollowerCount(a))
          .slice(0, 6)
          .map((p: any): Result => ({
            kind: 'user',
            id: p.id,
            title: p.name || p.username || 'Unknown',
            subtitle: p.username ? `@${p.username}` : 'Channel',
            avatar: p.image || p.avatar,
            onPress: () => { pushRecent(q); close(); router.push(`/${p.username || p.id}` as any); },
          }));
        if (local.length) { profileRows = local; render(); setLoading(false); }
      }

      // PEOPLE lane first, and progressively: render + clear "Searching…" the
      // moment profiles land, so a name search feels instant instead of blocking
      // on the slower posts/communities lanes. People search is the high-value
      // lane, so give it a generous window and retry ONCE if it times out or
      // fails transiently — that's the "search only works sometimes" fix.
      const runProfiles = (attempt: number) => {
      lane(sdk.profiles.search({ q, limit: 40, organization_id: ORG_ID || undefined } as any), 7000).then((profilesRes: any) => {
        if (cancelled) return;
        // Transient failure/timeout with nothing yet: retry once before giving up.
        if ((profilesRes._timedOut || profilesRes._failed) && attempt === 0) { runProfiles(1); return; }
        // Relevance bucket: exact handle/name, then prefix, then contains.
        const matchBucket = (p: any) => {
          const un = (p.username || '').toLowerCase();
          const nm = (p.name || '').toLowerCase();
          if (un === qLower) return 0;
          if (nm === qLower) return 1;
          if (un.startsWith(qLower)) return 2;
          if (nm.startsWith(qLower)) return 3;
          if (un.includes(qLower)) return 4;
          if (nm.includes(qLower)) return 5;
          return 6;
        };
        // Popularity — followers first, posts as fallback — so recognizable
        // accounts surface and empty spam (no avatar/followers/posts) sinks.
        const popularity = (p: any) => profileFollowerCount(p) * 3 + profilePostCount(p);
        const hasAvatar = (p: any) => !!(p.image || p.avatar);
        profileRows = filterJunkCreators([...(profilesRes.data || [])]).sort((a: any, b: any) =>
          matchBucket(a) - matchBucket(b)
          || (hasAvatar(b) ? 1 : 0) - (hasAvatar(a) ? 1 : 0)
          || popularity(b) - popularity(a)
          || (a.username || '').length - (b.username || '').length
          || String(a.id).localeCompare(String(b.id))
        ).slice(0, 6).map((p: any) => ({
          kind: 'user' as const,
          id: p.id,
          title: p.name || p.username || 'Unknown',
          subtitle: p.username ? `@${p.username}` : 'Channel',
          avatar: p.image || p.avatar,
          onPress: () => { pushRecent(q); close(); router.push(`/${p.username || p.id}` as any); },
        }));
        render();
        setLoading(false);
      });
      };
      runProfiles(0);

      // The remaining lanes fold in as they arrive — no barrier.
      lane(sdk.communities.list({ limit: 50, organization_id: ORG_ID || undefined })).then((commRes: any) => {
        if (cancelled) return;
        communityRows = (commRes.data || [])
          .filter((c: any) => (c.name || '').toLowerCase().includes(qLower) || communityDescription(c).toLowerCase().includes(qLower))
          .slice(0, 4)
          .map((c: any) => ({
            kind: 'community' as const,
            id: `community:${c.id}`,
            title: c.name || 'Group',
            subtitle: 'Group',
            avatar: c.image || c.avatar,
            onPress: () => { pushRecent(q); close(); router.push(`/community/${c.id}` as any); },
          }));
        render();
      });
      lane((sdk as any).agents.listDiscoverable({ limit: 50 })).then((agentsRes: any) => {
        if (cancelled) return;
        agentRows = (agentsRes.data || [])
          .filter((a: any) => (a.name || '').toLowerCase().includes(qLower) || (a.username || '').toLowerCase().includes(qLower))
          .slice(0, 4)
          .map((a: any) => ({
            kind: 'agent' as const,
            id: `agent:${a.id}`,
            title: a.name || a.username || 'Agent',
            subtitle: 'Agent',
            avatar: a.image || a.avatar,
            onPress: () => { pushRecent(q); close(); router.push(`/${a.username || a.id}` as any); },
          }));
        render();
      });
      lane(sdk.posts.search({ q, limit: 4, organization_id: ORG_ID || undefined })).then((postsRes: any) => {
        if (cancelled) return;
        postRows = (postsRes.data || []).map((p: any) => ({
          kind: 'post' as const,
          id: `post:${p.id}`,
          title: (p.title || p.content || '').slice(0, 100),
          subtitle: p.author?.name ? `Post by ${p.author.name}` : 'Post',
          onPress: () => { pushRecent(q); close(); router.push(`/post/${p.id}` as any); },
        }));
        render();
      });
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, sdk, router, close, runFind]);

  const onKeyDown = React.useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
  }, [results.length]);

  const onSubmit = React.useCallback(() => {
    const q = query.trim();
    const r = results[activeIdx];
    // If the user is actively pointing at a live suggestion (a creator,
    // community, agent, post, or recent), open it. Otherwise Enter always jumps
    // to Discover for the typed query — including while results are still
    // resolving during the debounce, so a fast typist never lands on a stale row.
    if (r && !loading && r.kind !== 'command') {
      r.onPress();
      return;
    }
    if (q) runFind(q);
  }, [results, activeIdx, query, loading, runFind]);

  if (Platform.OS !== 'web') {
    // Native gets a different palette UX (bottom sheet) — kept simple
    // for now so this PR doesn't grow. Cmd+K is a desktop affordance
    // anyway; mobile relies on the per-screen search bars.
    return null;
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          paddingTop: 80,
        }}
      >
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%', alignItems: 'center' }}>
          <Pressable
            onPress={() => { /* swallow */ }}
            style={{
              width: '92%',
              maxWidth: 640,
              backgroundColor: colors.bg,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.borderSubtle,
              overflow: 'hidden',
            } as any}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
                gap: spacing.sm,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                ref={inputRef}
                placeholder="Search people, groups, posts…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={onSubmit}
                onKeyPress={onKeyDown}
                style={{
                  flex: 1,
                  color: colors.text,
                  ...typography.input,
                  paddingVertical: 6,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
                autoFocus
              />
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  borderWidth: 0.5,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>esc</Text>
              </View>
            </View>
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: 420 }}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Text variant="body" color={colors.textMuted}>
                    {loading ? 'Searching…' : query ? 'No matches' : 'Type to search'}
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const isActive = index === activeIdx;
                return (
                  <Pressable
                    onPress={item.onPress}
                    onHoverIn={() => setActiveIdx(index)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: isActive ? colors.surfaceHover : 'transparent',
                      gap: spacing.md,
                    }}
                  >
                    {item.avatar ? (
                      <Avatar uri={item.avatar} name={item.title} size="sm" />
                    ) : (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.surfaceRaised,
                        }}
                      >
                        <Ionicons
                          name={
                            item.kind === 'search' ? 'search'
                              : item.kind === 'command' ? 'flash-outline'
                                : item.kind === 'recent' ? 'time-outline'
                                  : item.kind === 'post' ? 'document-text-outline'
                                    : item.kind === 'community' ? 'people-outline'
                                      : item.kind === 'agent' ? 'sparkles-outline'
                                        : 'person-outline'
                          }
                          size={14}
                          color={colors.textMuted}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{item.title}</Text>
                      {item.subtitle ? (
                        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                    {isActive ? (
                      <Text variant="caption" color={colors.textMuted}>↵</Text>
                    ) : null}
                  </Pressable>
                );
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderTopWidth: 0.5,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>↑ ↓ navigate</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>↵ open</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>esc close</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10, marginLeft: 'auto' as any }}>
                {user?.name || ''}
              </Text>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
