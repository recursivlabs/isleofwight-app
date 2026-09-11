import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ host: null as any, pan: null as any }));

// Capture the real Scrubber's native host/action props, which react-native-web
// intentionally does not forward. This proves wiring, not device accessibility.
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Platform: { OS: 'ios' },
    View: ({ children, ...props }: any) => {
      if (typeof props.onLayout === 'function') captured.host = props;
      return React.createElement('div', null, children);
    },
    PanResponder: {
      create: (handlers: any) => {
        captured.pan = handlers;
        return { panHandlers: {} };
      },
    },
  };
});
vi.mock('../lib/theme', () => ({ useColors: () => ({ accent: '#d4a844', border: '#333333' }) }));

import { Scrubber } from '../components/audio/Scrubber';

function action(actionName: string) {
  expect(captured.host?.onAccessibilityAction).toEqual(expect.any(Function));
  act(() => captured.host.onAccessibilityAction({ nativeEvent: { actionName } }));
}

beforeEach(() => { captured.host = null; captured.pan = null; });
afterEach(cleanup);

describe('native audio scrubber accessibility contract', () => {
  it('announces its adjustable value and handles bounded increment/decrement actions', () => {
    const seek = vi.fn();
    const view = render(<Scrubber position={30} duration={120} onSeek={seek} />);
    expect(captured.host.accessibilityRole).toBe('adjustable');
    expect(captured.host.accessibilityLabel).toBe('Audio position');
    expect(captured.host.accessibilityValue).toEqual(expect.objectContaining({ min: 0, max: 120, now: 30 }));
    expect(captured.host.accessibilityValue.text).toEqual(expect.stringMatching(/\S/));
    expect(captured.host.accessibilityActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'increment' }), expect.objectContaining({ name: 'decrement' }),
    ]));
    action('increment');
    expect(seek).toHaveBeenLastCalledWith(35);
    view.rerender(<Scrubber position={30} duration={120} onSeek={seek} />);
    action('decrement');
    expect(seek).toHaveBeenLastCalledWith(25);
    view.rerender(<Scrubber position={118} duration={120} onSeek={seek} />);
    action('increment');
    expect(seek).toHaveBeenLastCalledWith(120);
    view.rerender(<Scrubber position={2} duration={120} onSeek={seek} />);
    action('decrement');
    expect(seek).toHaveBeenLastCalledWith(0);
  });

  it.each([0, Number.NaN])('ignores native adjustment when duration is unavailable: %s', (duration) => {
    const seek = vi.fn();
    render(<Scrubber position={30} duration={duration} onSeek={seek} />);
    expect(captured.host.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    action('increment');
    action('decrement');
    expect(seek).not.toHaveBeenCalled();
  });

  it('preserves pointer seeking through the existing layout and responder callbacks', () => {
    const seek = vi.fn();
    render(<Scrubber position={30} duration={120} onSeek={seek} />);
    act(() => { captured.host.onLayout({ nativeEvent: { layout: { width: 100 } } }); });
    act(() => { captured.pan.onPanResponderGrant({ nativeEvent: { locationX: 25 } }); });
    expect(seek).not.toHaveBeenCalled();
    act(() => { captured.pan.onPanResponderRelease({ nativeEvent: { locationX: 75 } }); });
    expect(seek).toHaveBeenCalledWith(90);
  });
});
