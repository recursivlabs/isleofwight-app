/**
 * Cross-screen "what conversation is the user currently looking at"
 * store. Used by SideNav so the unread badge doesn't light up the
 * conversation the user is actively reading, regardless of how that
 * route is wired (URL query param on web, screen state on native).
 *
 * Previous implementation parsed `window.location` for `?id=<uuid>` —
 * works on web only and breaks any time the convo opens without that
 * param. This module is one source of truth, set by ConversationView.
 */
import * as React from 'react';

interface ActiveConvoValue {
  activeConvoId: string | null;
  setActiveConvoId: (id: string | null) => void;
}

const ActiveConvoContext = React.createContext<ActiveConvoValue>({
  activeConvoId: null,
  setActiveConvoId: () => {},
});

export function ActiveConvoProvider({ children }: { children: React.ReactNode }) {
  const [activeConvoId, setActiveConvoId] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ activeConvoId, setActiveConvoId }), [activeConvoId]);
  return <ActiveConvoContext.Provider value={value}>{children}</ActiveConvoContext.Provider>;
}

export function useActiveConvoId(): string | null {
  return React.useContext(ActiveConvoContext).activeConvoId;
}

export function useSetActiveConvoId(): (id: string | null) => void {
  return React.useContext(ActiveConvoContext).setActiveConvoId;
}
