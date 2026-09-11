import * as React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ConversationView } from '../(tabs)/chat';
import { useSmartBack } from '../../lib/navigation';
import { useAuth } from '../../lib/auth';
import { otpSignInPath } from '../../lib/authRedirect';

// Chat thread as a ROOT-STACK screen: pushed over the tabs, so the bottom bar
// is gone the whole time you're in a conversation (X hides it in DMs too),
// back is a native pop / edge-swipe, and the keyboard-attached composer owns
// the bottom edge with zero competing chrome. Chat friction is death — this
// screen is deliberately nothing but the conversation.
export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useSmartBack('/(tabs)/chat');
  const { user, isLoading } = useAuth();

  // A direct thread URL is private for the same reason as the inbox. Avoid
  // mounting ConversationView with no credential, then return the user to the
  // exact thread after OTP completes.
  if (isLoading) return null;
  if (!user) return <Redirect href={otpSignInPath(id ? `/chat/${id}` : '/chat') as any} />;
  if (!id) return null;
  return <ConversationView conversationId={id} onBack={goBack} />;
}
