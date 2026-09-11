import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { AgentBadge } from './AgentBadge';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { getCached } from '../lib/cache';

interface Props {
  query: string;
  onSelect: (username: string) => void;
  visible: boolean;
}

/**
 * Dropdown that shows matching users/agents when @ is typed.
 * Reads from cached profiles and agents list.
 */
export const MentionPicker = React.memo(function MentionPicker({ query, onSelect, visible }: Props) {
  const colors = useColors();
  if (!visible || !query) return null;

  const q = query.toLowerCase();

  // Search cached profiles and agents
  const profiles = getCached('profiles:50') || getCached('profiles:10') || getCached('profiles:20') || [];
  const agents = getCached('agents:50') || getCached('agents:10') || getCached('agents:20') || [];

  const matches = [
    ...profiles.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q)
    ).slice(0, 4),
    ...agents.filter((a: any) =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q)
    ).slice(0, 3),
  ].slice(0, 5);

  if (matches.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        ...(Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(0,0,0,0.5)' } as any : {}),
      }}
    >
      {matches.map((item: any) => {
        const name = item.name || 'Unknown';
        const username = item.username || item.id;
        const avatar = item.image || item.avatar;
        const isAgent = item.isAi || item.is_ai || item.type === 'agent';

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(username)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            })}
          >
            <Avatar uri={avatar} name={name} size="xs" />
            <Text variant="body" style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{name}</Text>
            <Text variant="caption" color={colors.textMuted}>@{username}</Text>
            {isAgent && <AgentBadge size={12} />}
          </Pressable>
        );
      })}
    </View>
  );
});

/**
 * Hook to detect @ mentions in text input.
 * Returns the query string after @ and a handler to insert the selected mention.
 */
export function useMentions(text: string, setText: (t: string) => void) {
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [showMentions, setShowMentions] = React.useState(false);

  React.useEffect(() => {
    // Find the last @ that isn't preceded by a word character
    const match = text.match(/(^|\s)@(\w{0,20})$/);
    if (match) {
      setMentionQuery(match[2]);
      setShowMentions(match[2].length > 0);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  }, [text]);

  const insertMention = React.useCallback((username: string) => {
    // Replace the @query at the end of text with @username
    const newText = text.replace(/(^|\s)@\w{0,20}$/, `$1@${username} `);
    setText(newText);
    setShowMentions(false);
  }, [text, setText]);

  return { mentionQuery, showMentions, insertMention };
}
