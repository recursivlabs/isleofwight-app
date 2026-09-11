import * as React from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublicCommunity, PublicPost } from '@minds/sdk';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { radius, spacing } from '../constants/theme';
import { signInPath } from '../lib/authRedirect';
import { articleExcerpt, communityDescription, postTitle } from '../lib/models';
import { publicMinds } from '../lib/recursiv';
import { useColors } from '../lib/theme';

type PublicPostPreview = {
  id: string;
  preview: string;
};

export type SignedOutDiscoverSection =
  | 'landing'
  | 'posts'
  | 'people'
  | 'communities'
  | 'agents';

const PUBLIC_POST_WINDOW = 12;
const PUBLIC_POST_PREVIEW_LENGTH = 140;
const PUBLIC_COMMUNITY_WINDOW = 12;
const PUBLIC_COMMUNITY_PREVIEW_COUNT = 3;

function readablePublicPostPreview(post: PublicPost): PublicPostPreview | null {
  if (!post?.id) return null;

  const textWithoutLinks = articleExcerpt(post, 1_000)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const readableText = postTitle(post) || textWithoutLinks;

  // URL-only and ultra-short posts make the signed-out page look like a link
  // directory. Keep them available in the community, but preview posts that
  // give a new visitor enough context to decide whether to open one.
  if (readableText.split(/\s+/).filter(Boolean).length < 5) return null;

  return {
    id: post.id,
    preview: readableText.length > PUBLIC_POST_PREVIEW_LENGTH
      ? `${readableText.slice(0, PUBLIC_POST_PREVIEW_LENGTH).trimEnd()}…`
      : readableText,
  };
}

function publicCommunityScore(community: PublicCommunity): number {
  const members = typeof community.memberCount === 'number' ? community.memberCount : 0;
  const posts = typeof community.postCount === 'number' ? community.postCount : 0;
  return (members * 10) + posts;
}

function usefulPublicCommunities(communities: PublicCommunity[]): PublicCommunity[] {
  const seen = new Set<string>();
  return communities
    .filter((community) => {
      if (!community?.id || community.privacy === 'private' || community.importHidden === true) return false;
      const name = community.name?.trim();
      if (!name || seen.has(community.id)) return false;
      seen.add(community.id);
      return true;
    })
    .sort((left, right) => publicCommunityScore(right) - publicCommunityScore(left))
    .slice(0, PUBLIC_COMMUNITY_PREVIEW_COUNT);
}

export function SignedOutDiscover({
  returnTo,
  section = 'landing',
}: {
  returnTo: string;
  section?: SignedOutDiscoverSection;
}) {
  const router = useRouter();
  const colors = useColors();
  const [recentPosts, setRecentPosts] = React.useState<PublicPostPreview[]>([]);
  const [publicCommunities, setPublicCommunities] = React.useState<PublicCommunity[]>([]);
  const [featuredCommunity, setFeaturedCommunity] = React.useState<PublicCommunity | null>(null);
  const isCommunityDirectory = section === 'communities';
  const heading = isCommunityDirectory ? 'Discover public groups' : 'Discover what’s happening';
  const description = isCommunityDirectory
    ? 'Explore a public group now. Sign in to search, join, and create groups across Minds.'
    : 'Explore active public groups now. Sign in to search, follow, post, and discover people and agents.';
  const openAuth = (auth: 'otp' | 'login') => {
    router.push(signInPath(auth, returnTo) as any);
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await publicMinds.publicCommunities.list({
          limit: PUBLIC_COMMUNITY_WINDOW,
          privacy: 'public',
        });
        const communities = usefulPublicCommunities(response.data || []);
        const featured = communities[0];
        if (cancelled) return;
        // The landing page promises that a visitor can look around first.
        // Keep the same real, tenant-scoped group previews visible there too;
        // hiding them made Explore Minds another sign-in wall.
        setPublicCommunities(communities);
        setFeaturedCommunity(featured || null);
        if (!featured?.id) {
          setRecentPosts([]);
          return;
        }
        const posts = await publicMinds.publicPosts.list({
          communityId: featured.id,
          limit: PUBLIC_POST_WINDOW,
        });
        if (cancelled) return;
        setRecentPosts(
          (posts.data || [])
            .map(readablePublicPostPreview)
            .filter((post): post is PublicPostPreview => post !== null)
            .slice(0, 3),
        );
      } catch {
        if (!cancelled) {
          setPublicCommunities([]);
          setFeaturedCommunity(null);
          setRecentPosts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const featuredName = featuredCommunity?.name?.trim() || 'this group';
  const featuredHref = featuredCommunity?.id ? `/community/${featuredCommunity.id}` : null;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing['3xl'],
      }}
    >
      <View style={{ width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.lg }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="compass-outline" size={30} color={colors.accent} />
        </View>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h2" align="center" accessibilityRole="header" aria-level={1}>
            {heading}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ lineHeight: 23 }}>
            {description}
          </Text>
        </View>
        <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button size="lg" fullWidth onPress={() => openAuth('otp')}>
            Continue with email
          </Button>
          <Button size="lg" fullWidth variant="secondary" onPress={() => openAuth('login')}>
            Log in with password
          </Button>
        </View>

        <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.sm }}>
          <Text variant="caption" color={colors.textSecondary} align="center">
            Explore without signing in
          </Text>
          {publicCommunities.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">Popular public groups</Text>
              {publicCommunities.map((community) => {
                // UUIDs are stable and globally unique. Legacy slugs are only
                // unique per owner, so a slug can resolve a different app's
                // row (or a private duplicate) on an anonymous request.
                const href = `/community/${community.id}`;
                const members = typeof community.memberCount === 'number' ? community.memberCount : 0;
                const posts = typeof community.postCount === 'number' ? community.postCount : 0;
                const stats = [
                  members > 0 ? `${members.toLocaleString()} members` : '',
                  posts > 0 ? `${posts.toLocaleString()} posts` : '',
                ].filter(Boolean).join(' · ');
                return (
                  <Pressable
                    key={community.id}
                    {...(Platform.OS === 'web'
                      ? { href }
                      : { onPress: () => router.push(href as any) }) as any}
                    accessibilityRole="link"
                    accessibilityLabel={`Open public group ${community.name}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm + 2,
                      borderRadius: radius.lg,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                    })}
                  >
                    <Ionicons name="people-outline" size={20} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{community.name?.trim()}</Text>
                      <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                        {stats || communityDescription(community) || 'Open public group'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          )}
          {recentPosts.length > 0 && featuredHref ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">
                {isCommunityDirectory ? `Latest in the ${featuredName} group` : `Latest in ${featuredName}`}
              </Text>
              {recentPosts.map((post) => {
                const href = `/post/${post.id}`;
                return (
                  <Pressable
                    key={post.id}
                    {...(Platform.OS === 'web'
                      ? { href }
                      : { onPress: () => router.push(href as any) }) as any}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${featuredName} post: ${post.preview}`}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      borderRadius: radius.lg,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                    })}
                  >
                    <Text variant="body" numberOfLines={2}>{post.preview}</Text>
                    <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                      Read post
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                {...(Platform.OS === 'web'
                  ? { href: featuredHref }
                  : { onPress: () => router.push(featuredHref as any) }) as any}
                accessibilityRole="link"
                accessibilityLabel={`See all posts in ${featuredName}`}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  opacity: pressed ? 0.65 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Text variant="caption" color={colors.accent}>{`See all in ${featuredName}`}</Text>
              </Pressable>
            </View>
          ) : null}
          {!isCommunityDirectory && ([
            {
              href: '/groups',
              icon: 'people-outline',
              title: 'Browse all public groups',
              description: 'See the full public community directory',
            },
            {
              href: '/live',
              icon: 'radio-outline',
              title: 'Live',
              description: 'Watch the live stream inside Minds',
            },
            {
              href: '/moderation',
              icon: 'shield-checkmark-outline',
              title: 'Public moderation log',
              description: 'Review decisions and the appeals process',
            },
          ] as const).map((item) => (
            <PublicPreviewLink
              key={item.href}
              {...item}
              onPress={() => router.push(item.href as any)}
              colors={colors}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function PublicPreviewLink({ href, icon, title, description, onPress, colors }: {
  href: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      {...(Platform.OS === 'web' ? { href } : { onPress }) as any}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.75 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="caption" color={colors.textSecondary}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}
