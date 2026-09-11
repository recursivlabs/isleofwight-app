/**
 * Seekable progress bar. Tap (or drag) anywhere on the track to seek. Shared by
 * the inline player, the mini-player, and the fullscreen player so scrub
 * behavior is identical everywhere.
 */
import * as React from 'react';
import { View, PanResponder, Platform, type LayoutChangeEvent } from 'react-native';
import { useColors } from '../../lib/theme';
import { formatDuration } from './format';

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  /** Bar thickness. */
  height?: number;
  /** Show the draggable knob (off for the thin mini-player line). */
  knob?: boolean;
  color?: string;
}

export function Scrubber({ position, duration, onSeek, height = 4, knob = true, color }: Props) {
  const colors = useColors();
  const widthRef = React.useRef(0);
  const [dragRatio, setDragRatio] = React.useState<number | null>(null);
  const canSeek = Number.isFinite(duration) && duration > 0;
  const end = canSeek ? duration : 0;
  const current = Number.isFinite(position) ? Math.min(end, Math.max(0, position)) : 0;
  const valueText = canSeek ? `${formatDuration(current)} of ${formatDuration(end)}` : 'Duration unavailable';

  const ratio = canSeek ? (dragRatio ?? current / end) : 0;

  const seek = (seconds: number) => {
    if (!canSeek) return;
    setDragRatio(null);
    onSeek(Math.min(end, Math.max(0, seconds)));
  };

  // RNW forwards DOM keyboard/ARIA props; native uses adjustable actions.
  // accessibilityValue alone is not forwarded by RNW's View.
  const webProps = Platform.OS === 'web' ? {
    'aria-valuemin': 0,
    'aria-valuemax': end,
    'aria-valuenow': current,
    'aria-valuetext': valueText,
    'aria-disabled': !canSeek,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      let target: number;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp': target = current + 5; break;
        case 'ArrowLeft':
        case 'ArrowDown': target = current - 5; break;
        case 'Home': target = 0; break;
        case 'End': target = end; break;
        default: return;
      }
      event.preventDefault();
      event.stopPropagation();
      seek(target);
    },
  } : {};

  const seekFromX = React.useCallback(
    (x: number, commit: boolean) => {
      const w = widthRef.current;
      if (w <= 0 || !canSeek || !Number.isFinite(x)) return;
      const r = Math.min(1, Math.max(0, x / w));
      if (commit) {
        setDragRatio(null);
        onSeek(r * duration);
      } else {
        setDragRatio(r);
      }
    },
    [canSeek, duration, onSeek],
  );

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canSeek,
        onMoveShouldSetPanResponder: () => canSeek,
        onPanResponderGrant: (e) => seekFromX(e.nativeEvent.locationX, false),
        onPanResponderMove: (e) => seekFromX(e.nativeEvent.locationX, false),
        onPanResponderRelease: (e) => seekFromX(e.nativeEvent.locationX, true),
        onPanResponderTerminate: (e) => seekFromX(e.nativeEvent.locationX, true),
      }),
    [canSeek, seekFromX],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const fill = color || colors.accent;
  const knobSize = height * 3;

  return (
    <View
      {...responder.panHandlers}
      {...webProps}
      onLayout={onLayout}
      accessible
      focusable={canSeek}
      accessibilityRole="adjustable"
      accessibilityLabel="Audio position"
      accessibilityState={{ disabled: !canSeek }}
      accessibilityValue={{ min: 0, max: end, now: current, text: valueText }}
      accessibilityActions={canSeek ? [{ name: 'increment' }, { name: 'decrement' }] : []}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') seek(current + 5);
        if (event.nativeEvent.actionName === 'decrement') seek(current - 5);
      }}
      // Pad the touch target vertically so a 4px line is easy to grab.
      style={{ paddingVertical: 8, justifyContent: 'center' }}
      hitSlop={{ top: 8, bottom: 8 }}
    >
      <View style={{ height, borderRadius: height, backgroundColor: colors.border, overflow: 'visible' }}>
        <View style={{ width: `${ratio * 100}%`, height, borderRadius: height, backgroundColor: fill }} />
        {knob && (
          <View
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: height / 2 - knobSize / 2,
              width: knobSize,
              height: knobSize,
              borderRadius: knobSize / 2,
              marginLeft: -knobSize / 2,
              backgroundColor: fill,
            }}
          />
        )}
      </View>
    </View>
  );
}
