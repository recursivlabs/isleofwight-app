import * as React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../lib/theme';

/**
 * The single agent marker shown INLINE next to an agent's display name — a clean
 * filled rounded SQUARE with a white AI glyph (was the old robot icon). One
 * component so every surface (agents sidebar, chat list, messages inbox,
 * discover, profile) renders the exact same square badge, matching Badge('agent').
 */
export function AgentBadge({ size = 13 }: { size?: number }) {
  const colors = useColors();
  const box = size + 4;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.28),
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="sparkles" size={Math.round(size * 0.7)} color="#ffffff" />
    </View>
  );
}
