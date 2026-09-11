import { useLocalSearchParams } from 'expo-router';
import { DiscoverLanding, DiscoverResults } from '../../../components/DiscoverExplore';

// ──────────────────────────────────────────────────────────────────────────
// Discover is a search + explore surface, NOT a second feed (that's For You).
// No entity tabs: with a query it's ONE blended, ranked result list; without
// one it's the landing — trending topics, top on Minds today, and people +
// groups to follow. The shared search box in _layout drives ?q here.
// ──────────────────────────────────────────────────────────────────────────
export default function DiscoverIndex() {
  const params = useLocalSearchParams<{ q?: string }>();
  const q = (typeof params.q === 'string' ? params.q : '').trim();
  return q ? <DiscoverResults q={q} /> : <DiscoverLanding />;
}
