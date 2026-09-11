import * as React from 'react';
import { Pressable } from 'react-native';
import { Text } from './Text';
import { useColors } from '../lib/theme';

interface Props {
  expanded: boolean;
  onToggle: () => void;
}

export function ProfileBioToggle({ expanded, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Collapse profile bio' : 'Show full profile bio'}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      hitSlop={6}
      style={{ marginTop: 2 }}
    >
      <Text variant="caption" color={colors.accent}>
        {expanded ? 'Show less' : 'Show more'}
      </Text>
    </Pressable>
  );
}
