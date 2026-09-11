import * as React from 'react';
import { View, FlatList, Pressable, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Avatar, Skeleton, RightRailLayout } from '../components';
import { LinkPressable } from '../components/LinkPressable';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { SignedOutDiscover } from '../components/SignedOutDiscover';
import { useAuth } from '../lib/auth';
import { useCommunities } from '../lib/hooks';
import { formatCount } from '../lib/discover';
import { setCache } from '../lib/cache';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

const destinationProps = (href: string, onPress: () => void) => (
  Platform.OS === 'web' ? { href } : { onPress }
) as any;

// Dedicated "your communities" list — the communities equivalent of the full
// chat page. The sidebar "See all" links here (NOT Discover, which is every
// community on the network). Shows only the communities you've JOINED.
export default function CommunitiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  // memberOnly: the server returns exactly the caller's accepted communities.
  // At 96K network communities, "mine" can't be derived client-side anymore —
  // the caller's groups are almost never in page one of the directory.
  const { communities, loading, fetchedOnce } = useCommunities(100, { memberOnly: true });

  // Gate on fetchedOnce so a stale cached is_member=true can't flash a community
  // you've left (mirrors the sidebar's guard). is_member filter kept as belt —
  // server rows are already all-mine.
  const mine = (fetchedOnce ? (communities || []) : [])
    .filter((c: any) => c.is_member === true || c.isMember === true);

  // Client-side search over the caller's joined communities (the list is small
  // enough — the server returns exactly "mine", capped at 100).
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? mine.filter((c: any) => (c.name || '').toLowerCase().includes(q))
    : mine;

  const primeCommunity = React.useCallback((community: any) => {
    // The joined-groups response already contains the identity and membership
    // data the detail header needs. Seed the detail cache before navigation so
    // its post request can start immediately instead of waiting behind a
    // redundant communities.get round trip. The detail screen still refreshes
    // this record in the background.
    setCache(`community:${community.id}`, community);
  }, []);

  if (!user) {
    return (
      <Container safeTop padded={false}>
        <RightRailLayout context="communities">
          <ScreenHeader title="Groups" />
          {authLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <SignedOutDiscover returnTo="/groups" section="communities" />
          )}
        </RightRailLayout>
      </Container>
    );
  }

  const renderRow = ({ item }: { item: any }) => (
    <LinkPressable
      href={`/community/${item.id}`}
      onPress={() => primeCommunity(item)}
      accessibilityLabel={`Open group ${item.name || 'Group'}`}
      style={({ hovered, pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: hovered || pressed ? colors.glass : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Avatar uri={item.image || item.avatar} name={item.name} size="lg" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{item.name || 'Group'}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {formatCount(item.member_count || item.memberCount || 0)} members
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </LinkPressable>
  );

  // "+ New Group" header button — matches the discover/communities directory
  // button styling (accent pill, caption + add icon). Routes into the create flow.
  const newCommunityButton = (
    <Pressable
      {...destinationProps(
        '/create?mode=community',
        () => router.push('/(tabs)/create?mode=community' as any),
      )}
      accessibilityRole="link"
      accessibilityLabel="Create a new group"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingLeft: spacing.md, paddingRight: spacing.md, paddingVertical: 7,
        borderRadius: radius.full, backgroundColor: colors.accent,
        opacity: pressed ? 0.85 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name="add" size={16} color={colors.textOnAccent} />
      <Text variant="caption" color={colors.textOnAccent} style={{ fontFamily: 'Roboto-Medium' }}>New Group</Text>
    </Pressable>
  );

  const searchBar = mine.length > 0 && (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.glass, borderRadius: radius.full,
        paddingHorizontal: spacing.md, paddingVertical: 9,
        borderWidth: 0.5, borderColor: colors.glassBorder,
      }}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your groups"
          accessibilityLabel="Search your groups"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear group search"
            hitSlop={8}
            style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
          >
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Container safeTop padded={false}>
      <RightRailLayout context="communities">
      <ScreenHeader title="Groups" right={newCommunityButton} />

      {searchBar}

      {/* Show the skeleton until the FIRST fetch actually resolves (fetchedOnce),
         not just while `loading` — otherwise the empty state flashes for a frame
         before the joined list arrives. */}
      {(!fetchedOnce || loading) && mine.length === 0 ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width={160} height={15} />
                <Skeleton width={90} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : mine.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h3" color={colors.text}>No groups yet</Text>
          <Text variant="body" color={colors.textSecondary} style={{ maxWidth: 320, textAlign: 'center' }}>
            Groups you join show up here. Find ones to join in Discover.
          </Text>
          <Pressable
            {...destinationProps(
              '/discover/communities',
              () => router.push('/(tabs)/discover/communities' as any),
            )}
            accessibilityRole="link"
            accessibilityLabel="Discover groups"
            style={({ hovered }: any) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              backgroundColor: hovered ? colors.accentHover : colors.accent,
              paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="search" size={16} color={colors.bg} />
            <Text variant="bodyMedium" color={colors.bg}>Discover groups</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Ionicons name="search" size={28} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            No groups match “{query}”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          ListFooterComponent={
            <Pressable
              {...destinationProps(
                '/discover/communities',
                () => router.push('/(tabs)/discover/communities' as any),
              )}
              accessibilityRole="link"
              accessibilityLabel="Discover more communities"
              style={({ hovered }: any) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="search" size={16} color={colors.accent} />
              <Text variant="bodyMedium" color={colors.accent}>Discover more communities</Text>
            </Pressable>
          }
        />
      )}
      </RightRailLayout>
    </Container>
  );
}
