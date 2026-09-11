import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Avatar, Button, Input, Skeleton } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import { getMutedUsers, unmuteUser, type MutedUser } from '../lib/moderation';

const PAGE = 30;

// One muted account: avatar + name/@username + an Unmute button. Tapping the
// row opens the profile; unmute removes the row optimistically.
function MutedRow({
  user,
  busy,
  onOpen,
  onUnmute,
}: {
  user: MutedUser;
  busy: boolean;
  onOpen: () => void;
  onUnmute: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 60,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Pressable
        onPress={onOpen}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <Avatar uri={user.image} name={user.name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{user.name || 'Unknown'}</Text>
          {user.username ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{user.username}</Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onUnmute}
        disabled={busy}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.glass,
          opacity: busy ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        {busy
          ? <ActivityIndicator size="small" color={colors.textMuted} />
          : <Text variant="bodyMedium" color={colors.text}>Unmute</Text>}
      </Pressable>
    </View>
  );
}

export default function MutedScreen() {
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();

  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<MutedUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Distinguishes a failed load from a genuinely empty list (#moderation).
  const [loadError, setLoadError] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());

  // Guards against a stale response overwriting a newer search.
  const activeQuery = React.useRef('');

  const loadFirst = React.useCallback(async (search: string) => {
    activeQuery.current = search;
    setLoading(true);
    const { data, hasMore, error } = await getMutedUsers({ search, limit: PAGE, offset: 0 });
    if (activeQuery.current !== search) return; // superseded by a newer query
    // A failed load returns an empty list, which renders identically to the
    // genuine empty state. Show the failure instead of implying the list is
    // empty — on this screen that difference matters.
    setLoadError(!!error);
    if (activeQuery.current !== search) return;
    setItems(data);
    setHasMore(hasMore);
    setLoading(false);
  }, []);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    const search = activeQuery.current;
    const { data, hasMore: more } = await getMutedUsers({ search, limit: PAGE, offset: items.length });
    if (activeQuery.current !== search) { setLoadingMore(false); return; }
    setItems((prev) => {
      const seen = new Set(prev.map((u) => u.id));
      return [...prev, ...data.filter((u) => !seen.has(u.id))];
    });
    setHasMore(more);
    setLoadingMore(false);
  }, [loadingMore, loading, hasMore, items.length]);

  // Debounced search — refetch page 0 whenever the query settles.
  React.useEffect(() => {
    const t = setTimeout(() => { loadFirst(query); }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, loadFirst]);

  const handleUnmute = React.useCallback(async (user: MutedUser) => {
    setBusyIds((prev) => new Set(prev).add(user.id));
    setItems((prev) => prev.filter((u) => u.id !== user.id));
    try {
      await unmuteUser(user.id);
      toast.show(`Unmuted ${user.name || user.username || 'user'}`);
    } catch {
      toast.show('Could not unmute', 'error');
      setItems((prev) => [user, ...prev]); // revert
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(user.id); return next; });
    }
  }, [toast]);

  const openUser = (u: MutedUser) => router.push(`/${u.username || u.id}` as any);

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Muted accounts" />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search muted accounts"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={60} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MutedRow
              user={item}
              busy={busyIds.has(item.id)}
              onOpen={() => openUser(item)}
              onUnmute={() => handleUnmute(item)}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.xl }}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg, marginTop: spacing['2xl'] }}>
              <Ionicons name={loadError ? 'cloud-offline-outline' : query ? 'search-outline' : 'volume-mute-outline'} size={40} color={loadError ? colors.error : colors.accent} />
              <Text variant="h3" color={colors.text} align="center">
                {loadError ? "Couldn't load" : query ? 'No matches' : 'No muted accounts'}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 22 }}>
                {loadError
                  ? "We couldn't reach the server, so this list may be incomplete. It does NOT mean you have no muted accounts."
                  : query
                  ? 'No muted account matches that search.'
                  : "Muting hides an account's posts and notifications from you. They aren't told, and you can unmute anytime."}
              </Text>
              {loadError ? (
                <Button onPress={() => loadFirst(activeQuery.current)} variant="secondary" size="sm">
                  Retry
                </Button>
              ) : null}
            </View>
          }
        />
      )}
    </Container>
  );
}
