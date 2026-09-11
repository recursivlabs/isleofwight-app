import { invalidatePrefix } from './cache';

/**
 * Call after a follow or unfollow succeeds, from EVERY place that toggles one.
 *
 * WHY THIS EXISTS
 * ---------------
 * Following is the input to a feed, so changing it invalidates that feed. Before
 * this, the follow toggle invalidated the profile caches it could see from where
 * it was written -- 'myprofile', 'profile:<id>' -- and nothing touched the feed
 * itself. Unfollowing someone left their posts in the following feed, and they
 * survived a refresh too, because the cached page outlived the follow edge that
 * justified it.
 *
 * There are three toggle sites (profile screen, feed sidebar, discover/people)
 * and they had drifted apart on what they invalidated. A helper is the only way
 * they stay in step: the next surface that grows a follow button gets this for
 * free instead of rediscovering the bug.
 *
 * PREFIX, NOT AN EXACT KEY: feed caches are keyed `posts:<sort>:<limit>` and the
 * limit varies by surface, so an exact key would miss every caller that asked
 * for a different page size.
 */
export function afterFollowChange(): void {
  // The social-graph feed IS the follow list. Always stale after a toggle.
  invalidatePrefix('posts:following');
  // For You ranks partly on who you follow (in-network candidates and author
  // affinity), so it is stale too -- less visibly, but a just-unfollowed author
  // reappearing in suggestions is exactly the thing that reads as broken.
  invalidatePrefix('posts:personal');
}
