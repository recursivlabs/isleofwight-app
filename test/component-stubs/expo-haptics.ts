// expo-haptics stub — lib/haptics no-ops on web anyway; the stub only keeps
// the import from pulling in expo-modules-core under node.
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as const;
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' } as const;
export async function impactAsync() {}
export async function selectionAsync() {}
export async function notificationAsync() {}
