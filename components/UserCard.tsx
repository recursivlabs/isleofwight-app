import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  user: any;
  onFollow?: (userId: string) => void;
  compact?: boolean;
}

export function UserCard({ user, onFollow, compact = false }: Props) {
  const router = useRouter();
  const colors = useColors();
  const name = user.name || user.username || 'User';
  const username = user.username || user.name || 'user';
  const avatar = user.image || user.avatar || null;
  const bio = user.bio || '';

  if (compact) {
    return (
      <Pressable
        onPress={() => router.push(`/${username}` as any)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          width: 160,
          marginRight: spacing.md,
          alignItems: 'center',
        })}
      >
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {name}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
          @{username}
        </Text>
        {onFollow && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onFollow(user.id);
            }}
            style={({ pressed }) => ({
              marginTop: spacing.md,
              paddingVertical: 6,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.accentHover : colors.accent,
            })}
          >
            <Text variant="label" color={colors.textInverse} style={{ fontSize: 12 }}>
              Follow
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/${username}` as any)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderRadius: radius.md,
      })}
    >
      <Avatar uri={avatar} name={name} size="md" />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          @{username}
        </Text>
        {bio ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
            {bio}
          </Text>
        ) : null}
      </View>
      {onFollow && (
        <Button onPress={() => onFollow(user.id)} size="sm" variant="secondary">
          Follow
        </Button>
      )}
    </Pressable>
  );
}
