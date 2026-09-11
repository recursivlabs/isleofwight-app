import * as React from 'react';
import { Pressable, View } from 'react-native';

import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import { Avatar } from './Avatar';
import { Text } from './Text';

interface ProfileUserRowUser {
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  image?: string | null;
}

interface Props {
  user: ProfileUserRowUser;
  onPress: () => void;
}

export function ProfileUserRow({ user, onPress }: Props) {
  const colors = useColors();
  const displayName = user.name || user.username || 'Unnamed user';
  const handle = user.username ? `@${user.username}` : '';
  const accessibilityLabel = user.name && handle
    ? `View profile for ${displayName}, ${handle}`
    : `View profile for ${displayName}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={user.image} name={displayName} size="sm" />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{displayName}</Text>
        {user.bio ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{user.bio}</Text>
        ) : handle ? (
          <Text variant="caption" color={colors.textMuted}>{handle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
