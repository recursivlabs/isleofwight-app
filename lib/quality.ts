// Discovery quality gate. One shared filter so search, discover, and the rail
// all hide the same junk — test/simulator accounts, bots, and empty shells that
// game raw-follower ranking. Content-first discovery means low-quality accounts
// never lead a surface, no matter how many (fake) followers they carry.
//
// The concrete trigger: ~178 `qa-par…` "Parity B" simulator accounts with
// inflated follower counts were dominating "who to follow" and burying 3M real
// users. This is defense-in-depth on top of removing them at the source.

// Handle/name patterns that mark a non-real account.
const JUNK_NAME = /(^|[^a-z])(betabot|parody|parity|test|qa|demo|simulator|dummy|sample|fixture|bot)([^a-z]|\d|$)/;

const num = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * True when an account should NOT surface in discovery/search/rail results.
 * Conservative: real imported users (who often have a post but no bio) still
 * pass. Only clear test/bot handles and truly empty shells are filtered.
 */
export function isJunkCreator(u: any): boolean {
  if (!u) return true;
  if (u.is_ai || u.isAi || u.agent_type) return true;

  const handle = `${u.username || ''} ${u.name || ''}`.toLowerCase();
  if (JUNK_NAME.test(handle)) return true;

  // Truly empty shell: nothing that says a real person is here.
  const followers = num(u.follower_count ?? u.followers_count ?? u.followers ?? u.subscribers_count);
  const posts = num(u.post_count ?? u.posts_count ?? u.postsCount);
  const hasAvatar = !!(u.image || u.avatar);
  const bio = String(u.bio || u.description || u.briefdescription || '').trim();
  if (!hasAvatar && !bio && followers === 0 && posts === 0) return true;

  return false;
}

/** Filter a list of profiles down to real, surfaceable accounts. */
export function filterJunkCreators<T = any>(list: T[] | null | undefined): T[] {
  return (list || []).filter((u) => !isJunkCreator(u));
}
