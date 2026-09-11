import { Redirect } from 'expo-router';

// The Groups feed moved to /groups. Keep /communities working for old links.
export default function CommunitiesRedirect() {
  return <Redirect href="/groups" />;
}
