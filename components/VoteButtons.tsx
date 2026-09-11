import * as React from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring, FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import { haptics } from '../lib/haptics';

interface Props {
  score: number;
  userVote: 'upvote' | 'downvote' | null;
  onUpvote: () => void;
  onDownvote: () => void;
  compact?: boolean;
}

// X-style engagement micro-interaction: casting a vote pops the icon with a
// spring burst + a light haptic tick. Un-voting stays quiet — the reward is
// for the action, not the retraction.
function BurstIcon({ active, children, burstKey }: { active: boolean; children: React.ReactNode; burstKey: number }) {
  const scale = useSharedValue(1);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (active) {
      scale.value = withSequence(
        withSpring(1.45, { damping: 9, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 300 }),
      );
    }
    // burstKey re-triggers when the same direction is re-cast after an unvote
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, burstKey]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export const VoteButtons = React.memo(function VoteButtons({ score, userVote, onUpvote, onDownvote, compact = false }: Props) {
  const colors = useColors();
  const iconSize = compact ? 18 : 22;
  const [burstKey, setBurstKey] = React.useState(0);
  const prevScore = React.useRef<number | null>(null);
  React.useEffect(() => { prevScore.current = score; }, [score]);

  const vote = (dir: 'upvote' | 'downvote', fn: () => void) => {
    if (userVote !== dir) {
      haptics.tap();
      setBurstKey((k) => k + 1);
    }
    fn();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? spacing.xs : spacing.sm,
      }}
    >
      <Pressable
        onPress={() => vote('upvote', onUpvote)}
        accessibilityRole="button"
        accessibilityLabel={`${userVote === 'upvote' ? 'Remove upvote' : 'Upvote'}, score ${score}`}
        accessibilityState={{ selected: userVote === 'upvote' }}
        aria-pressed={userVote === 'upvote'}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          padding: 2,
        })}
      >
        <BurstIcon active={userVote === 'upvote'} burstKey={burstKey}>
          <Ionicons
            name={userVote === 'upvote' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
            size={iconSize}
            color={userVote === 'upvote' ? colors.accent : colors.textMuted}
          />
        </BurstIcon>
      </Pressable>

      {/* X-style rolling counter: the number slides in from the direction
          of change. Keyed on score so reanimated runs enter/exit each tick. */}
      <Animated.View
        key={score}
        entering={(score >= (prevScore.current ?? score) ? FadeInUp : FadeInDown).duration(140)}
        exiting={(score >= (prevScore.current ?? score) ? FadeOutDown : FadeOutUp).duration(100)}
      >
        <Text
          variant="bodyMedium"
          color={
            userVote === 'upvote'
              ? colors.accent
              : userVote === 'downvote'
                ? colors.error
                : colors.textSecondary
          }
          style={{ fontSize: compact ? 13 : 15, minWidth: 20, textAlign: 'center' }}
        >
          {score.toLocaleString('en-US')}
        </Text>
      </Animated.View>

      <Pressable
        onPress={() => vote('downvote', onDownvote)}
        accessibilityRole="button"
        accessibilityLabel={`${userVote === 'downvote' ? 'Remove downvote' : 'Downvote'}, score ${score}`}
        accessibilityState={{ selected: userVote === 'downvote' }}
        aria-pressed={userVote === 'downvote'}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          padding: 2,
        })}
      >
        <BurstIcon active={userVote === 'downvote'} burstKey={burstKey}>
          <Ionicons
            name={userVote === 'downvote' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
            size={iconSize}
            color={userVote === 'downvote' ? colors.error : colors.textMuted}
          />
        </BurstIcon>
      </Pressable>
    </View>
  );
});
