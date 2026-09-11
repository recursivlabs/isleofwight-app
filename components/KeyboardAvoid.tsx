import * as React from 'react';
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, type ViewProps } from 'react-native';
import { KeyboardAvoidingView as KCKeyboardAvoidingView } from 'react-native-keyboard-controller';

// One keyboard-avoidance component for the whole app.
//
// iOS uses react-native-keyboard-controller's KeyboardAvoidingView: it drives
// layout from the native keyboard animation frame-by-frame, so composers stay
// ATTACHED to the keyboard through the show/hide animation AND interactive
// drag-dismiss — the Claude/iMessage feel RN's built-in KAV (which only
// listens to will-show/will-hide events) can't deliver.
//
// Android keeps the OS adjustResize behavior (no avoiding view needed —
// stacking one on top double-compensates). Web needs nothing.

interface Props extends ViewProps {
  keyboardVerticalOffset?: number;
}

export function KeyboardAvoid({ keyboardVerticalOffset = 0, children, ...props }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <KCKeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
        {...props}
      >
        {children}
      </KCKeyboardAvoidingView>
    );
  }
  return (
    <RNKeyboardAvoidingView behavior={undefined} {...props}>
      {children}
    </RNKeyboardAvoidingView>
  );
}
