// Explore is the "Search" primary nav tab. Discovery now lives at the tabbed
// /discover route, so Explore redirects there — mapping any legacy ?tab= param
// (e.g. from older sidebar "See all" links) onto the matching sub-route, and
// carrying a ?q search query through.
import { Redirect, useLocalSearchParams } from 'expo-router';

const TAB_ROUTES: Record<string, string> = {
  posts: '/(tabs)/discover/posts',
  people: '/(tabs)/discover/people',
  communities: '/(tabs)/discover/communities',
};

export default function Explore() {
  const params = useLocalSearchParams<{ tab?: string; q?: string }>();
  const pathname = (params.tab && TAB_ROUTES[params.tab]) || '/(tabs)/discover';
  const q = typeof params.q === 'string' ? params.q : undefined;
  return <Redirect href={{ pathname, params: q ? { q } : {} } as any} />;
}

// #187: contain a crash to this screen so the tab bar and navigation survive.
// expo-router renders this instead of the route when it throws.
export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
