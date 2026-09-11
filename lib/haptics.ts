import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// One haptics vocabulary for the whole app (X/iMessage-calibrated):
//  tap    — light tick for engagement actions (vote, bookmark, repost)
//  select — selection change (tab switch, filter change)
//  success— notification-style confirm (follow, post published)
//  warn   — destructive/attention (delete, error)
// All fire-and-forget and no-op on web.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  tap()     { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  select()  { if (enabled) Haptics.selectionAsync().catch(() => {}); },
  success() { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warn()    { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};
