import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { formatCount } from '../lib/discover';
import { communityDescription } from '../lib/models';

interface Props {
  community: any;
  variant?: 'card' | 'row';
}

export function CommunityCard({ community, variant = 'card' }: Props) {
  const router = useRouter();
  const colors = useColors();
  const name = community.name || 'Group';
  const description = communityDescription(community);
  const memberCount = community.memberCount || community.member_count || 0;
  const image = community.image || community.avatar || null;

  if (variant === 'row') {
    return (
      <Pressable
        onPress={() => router.push(`/community/${community.id}` as any)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: pressed ? colors.surfaceHover : 'transparent',
          borderRadius: radius.md,
        })}
      >
        <Avatar uri={image} name={name} size="md" />
        {/* minWidth:0 — a flex child defaults to min-width:auto on web, so a long
            group name refuses to shrink and pushes the chevron out of the row. */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {formatCount(memberCount)} member{memberCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/community/${community.id}` as any)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        width: 200,
        marginRight: spacing.md,
      })}
    >
      <Avatar uri={image} name={name} size="md" />
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.md }}>
        {name}
      </Text>
      {description ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          numberOfLines={2}
          style={{ marginTop: spacing.xs }}
        >
          {description}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.md,
        }}
      >
        <Ionicons name="people-outline" size={14} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>
          {formatCount(memberCount)}
        </Text>
      </View>
    </Pressable>
  );
}
