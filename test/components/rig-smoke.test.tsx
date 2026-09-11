// Proves the rig itself: app components render to real DOM through
// react-native-web, and DOM events reach RN-style handlers.
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';

describe('component rig', () => {
  it('renders an app Text component through react-native-web', () => {
    render(<Text>hello rig</Text>);
    expect(screen.getByText('hello rig')).toBeInTheDocument();
  });

  it('delivers a click to a Button onPress', async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Tap me</Button>);
    await userEvent.click(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when the Button is disabled', async () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} disabled>
        No tap
      </Button>,
    );
    await userEvent.click(screen.getByText('No tap'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
