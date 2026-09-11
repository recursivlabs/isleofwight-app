import * as React from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True while the soft keyboard is up. Drives the two adjustments that make
 * composers feel iMessage/Claude-precise:
 *  - collapse safe-area bottom padding while the keyboard covers the home
 *    indicator (otherwise a dead 34px strip sits between input and keyboard)
 *  - hide the bottom tab pill (X behavior) so it neither peeks above the
 *    keyboard nor holds layout space under it
 * iOS uses the will* events so the UI moves WITH the keyboard animation
 * instead of snapping after it.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setVisible(true));
    const h = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);
  return visible;
}
