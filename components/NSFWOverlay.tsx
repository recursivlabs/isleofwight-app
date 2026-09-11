import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  children: React.ReactNode;
}

export function NSFWOverlay({ children }: Props) {
  const [revealed, setRevealed] = React.useState(false);
  const colors = useColors();

  return (
    // minHeight guarantees a short text post still gives the mask enough
    // vertical room to show the full "Sensitive content" label + View button
    // without clipping. We KEEP it after reveal too: a very short post would
    // otherwise collapse so small that the absolutely-positioned re-mask chip
    // overlaps the content and becomes unclickable. The masked height is the
    // post's minimum height in both states.
    <View style={{ position: 'relative', overflow: 'hidden', borderRadius: radius.md, minHeight: 150 }}>
      {children}

      {!revealed ? (
        // Masked: a frosted blur over the content with a single, obvious "View"
        // button. On web the blur does the hiding; native falls back to a
        // stronger scrim since it has no backdrop-filter.
        <Pressable
          onPress={() => setRevealed(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.md,
            backgroundColor: Platform.OS === 'web' ? colors.scrim : colors.scrimStrong,
            ...(Platform.OS === 'web'
              ? { backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', cursor: 'pointer' } as any
              : {}),
          }}
        >
          <Text variant="caption" color="#fff" style={{ opacity: 0.9 }}>
            Sensitive content
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: colors.text,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="eye-outline" size={15} color={colors.bg} />
            <Text variant="bodyMedium" color={colors.bg}>View</Text>
          </View>
        </Pressable>
      ) : (
        // Revealed: a small, unobtrusive chip to put the mask back.
        <Pressable
          onPress={() => setRevealed(false)}
          style={({ pressed }) => ({
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: colors.scrimStrong,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            opacity: pressed ? 0.8 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', backdropFilter: 'blur(8px)' } as any : {}),
          })}
        >
          <Ionicons name="eye-off-outline" size={13} color="#fff" />
          <Text variant="caption" color="#fff">Hide</Text>
        </Pressable>
      )}
    </View>
  );
}
