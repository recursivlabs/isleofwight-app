import { Dimensions, Platform } from 'react-native';

export type ChatRouteParams = Record<string, string | undefined>;

type ChatLayoutEnvironment = {
  platform: string;
  width: number;
};

export function usesWideChatPane({ platform, width }: ChatLayoutEnvironment): boolean {
  return platform === 'web' && width >= 1000;
}

/**
 * Route a conversation through the full-screen root stack on native and
 * narrow web. Wide web keeps the inbox's two-pane layout.
 *
 * Keeping this decision in one place prevents newly-created conversations
 * from opening inside the tab screen while existing rows open full-screen.
 */
export function chatConversationHref(
  conversationId: string,
  params: ChatRouteParams = {},
  environment: ChatLayoutEnvironment = {
    platform: Platform.OS,
    width: Dimensions.get('window').width,
  },
) {
  return {
    pathname: usesWideChatPane(environment) ? '/(tabs)/chat' : '/chat/[id]',
    params: { ...params, id: conversationId },
  } as const;
}
