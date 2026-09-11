import { View, Pressable, Platform } from 'react-native';
import { showToast } from './Toast';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { ORG_ID } from '../lib/recursiv';
import { chatConversationHref } from '../lib/chatNavigation';

interface Props {
  agent: any;
  onChat?: () => void;
}

export function AgentCard({ agent, onChat }: Props) {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();
  const name = agent.name || 'AI Agent';
  const description = agent.description || agent.systemPrompt || '';
  const model = agent.model || agent.modelId || 'AI';
  const avatar = agent.image || agent.avatar || null;

  const modelLabel = model.includes('claude') ? 'Claude'
    : model.includes('gpt') ? 'GPT'
    : model.includes('gemini') ? 'Gemini'
    : 'AI';

  const handleChat = async () => {
    if (onChat) {
      onChat();
      return;
    }
    // Default: create DM with agent and navigate
    if (!sdk) return;
    try {
      const res = await sdk.chat.dm({ user_id: agent.id, organization_id: ORG_ID || undefined } as any);
      if (res.data?.id) {
        router.push(chatConversationHref(res.data.id) as any);
      }
    } catch {
      showToast('Could not start chat with this agent. Please try again.', 'error');
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.glass,
        borderRadius: radius.md,
        padding: spacing.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: '400' }}>{name}</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              marginTop: spacing.xs,
            }}
          >
            <View
              style={{
                backgroundColor: `${colors.accentHover}20`,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
              }}
            >
              <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
                {modelLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {description ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      <Pressable
        onPress={handleChat}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: pressed ? colors.accentHover : colors.accent,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          marginTop: spacing.xs,
        })}
      >
        <Ionicons name="chatbubble" size={16} color={colors.textOnAccent} />
        <Text variant="bodyMedium" color={colors.textOnAccent} style={{ fontSize: 14 }}>
          Chat
        </Text>
      </Pressable>
    </View>
  );
}
