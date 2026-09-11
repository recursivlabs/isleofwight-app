import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  onPost?: (data: { content: string; title?: string; tags: string[] }) => Promise<void>;
  placeholder?: string;
  showTitle?: boolean;
  communityId?: string;
}

export function ComposePost({ placeholder = "What's on your mind?" }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useColors();

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/create')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.xl,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Avatar uri={user?.image} name={user?.name} size="sm" />
      <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
        {placeholder}
      </Text>
    </Pressable>
  );
}
