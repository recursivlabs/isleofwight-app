import * as React from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';

/**
 * A Pressable inside an expo-router <Link asChild> that KEEPS ITS STYLES.
 *
 * THE BUG THIS EXISTS TO PREVENT:
 * `<Link asChild>` renders a Radix `Slot`, and Slot merges the slot's props
 * into the child's with one special case for style:
 *
 *     overrideProps.style = { ...slotPropValue, ...childPropValue }
 *
 * React Native's idiomatic Pressable style is a FUNCTION of press state:
 *
 *     style={({ hovered, pressed }) => ({ flexDirection: 'row', ... })}
 *
 * A function has no enumerable own properties, so spreading it into an object
 * literal yields `{}`. The child therefore receives `style={}` and EVERY rule
 * is silently dropped — no error, no warning, nothing in the types. Because
 * React Native's default flexDirection is `column`, a row laid out this way
 * stacks instead: on the groups list, the avatar, the text and the chevron each
 * took their own line, which is what "the arrow is on a 3rd line" was.
 *
 * The fix is to resolve the state-dependent style HERE, and hand Pressable a
 * plain object, which Slot merges correctly. Press and hover state is tracked
 * locally so callers keep the ergonomics they already write.
 *
 * Use this anywhere a pressable row or button needs to be a real link. Do not
 * put a function `style` on a Pressable directly inside `<Link asChild>`;
 * `linkAsChildStyles.test.tsx` fails the build if you do.
 */

type PressState = { hovered: boolean; pressed: boolean };
type StyleProp = ViewStyle | ((state: PressState) => ViewStyle);

interface Props {
  href: string;
  style?: StyleProp;
  children?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Defaults to "link" — this IS a link, and screen readers should say so. */
  accessibilityRole?: 'link' | 'button';
}

export function LinkPressable({
  href,
  style,
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'link',
}: Props) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  // Resolved to a plain object BEFORE it reaches the Slot. This is the whole
  // point of the component; passing `style` straight through would drop it.
  const resolved = typeof style === 'function' ? style({ hovered, pressed }) : style;

  return (
    <Link href={href as any} asChild>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={resolved}
      >
        {children}
      </Pressable>
    </Link>
  );
}
