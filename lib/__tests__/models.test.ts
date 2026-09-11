import { describe, it, expect } from 'vitest';
import {
  postScore, postReplyCount, postRepostCount, postUserVote,
  isSelfProfile, profileFollowerCount, profileFollowingCount, profilePostCount,
  communityDescription,
  conversationUnreadCount, timestampOf, isAiActor,
  normalizeMediaUrl, postDedupKey, dedupePosts,
} from '../models';

describe('post accessors', () => {
  it('reads score across field-name variants', () => {
    expect(postScore({ score: 5 })).toBe(5);
    expect(postScore({ vote_count: 3 })).toBe(3);
    expect(postScore({ voteCount: 2 })).toBe(2);
    expect(postScore({})).toBe(0);
    expect(postScore(null)).toBe(0);
  });
  it('reads reply + repost counts (the fields that had bugs)', () => {
    expect(postReplyCount({ repliesCount: 53 })).toBe(53);
    expect(postReplyCount({ replies_count: 8 })).toBe(8);
    expect(postReplyCount({ reply_count: 4 })).toBe(4);
    expect(postReplyCount({ replyCount: 1 })).toBe(1);
    expect(postRepostCount({ reposts_count: 7 })).toBe(7);
    expect(postRepostCount({ repostsCount: 2 })).toBe(2);
    expect(postRepostCount({})).toBe(0);
  });
  it('normalizes user vote to a valid union or null', () => {
    expect(postUserVote({ user_reaction: 'upvote' })).toBe('upvote');
    expect(postUserVote({ userVote: 'downvote' })).toBe('downvote');
    expect(postUserVote({ user_reaction: 'weird' })).toBeNull();
    expect(postUserVote({})).toBeNull();
  });
});

describe('profile accessors', () => {
  it('reads follower count (regression: follower_count vs followers_count)', () => {
    expect(profileFollowerCount({ followers_count: 9 })).toBe(9); // canonical API shape
    expect(profileFollowerCount({ followerCount: 3 })).toBe(3);
    expect(profileFollowerCount({ follower_count: 1 })).toBe(1);
    expect(profileFollowerCount({})).toBe(0);
  });
  it('reads following + post counts', () => {
    expect(profileFollowingCount({ following_count: 5 })).toBe(5);
    expect(profilePostCount({ posts_count: 12 })).toBe(12);
  });

  it('identifies only the signed-in profile as self', () => {
    expect(isSelfProfile({ id: 'viewer' }, { id: 'viewer' })).toBe(true);
    expect(isSelfProfile({ id: 'other' }, { id: 'viewer' })).toBe(false);
    expect(isSelfProfile({ username: 'viewer' }, { id: 'viewer' })).toBe(false);
  });
});

describe('community accessors', () => {
  it('decodes imported entities exactly once without changing stored data', () => {
    const community = { description: 'We&amp;#039;re here &amp; ready.' };
    expect(communityDescription(community)).toBe('We&#039;re here & ready.');
    expect(community.description).toBe('We&amp;#039;re here &amp; ready.');
  });

  it('turns legacy HTML fragments into readable plain text', () => {
    expect(communityDescription({ description: '<p>Build &amp; learn</p><p>Together</p>' }))
      .toBe('Build & learn\nTogether');
  });

  it('accepts the bio fallback and rejects non-string values', () => {
    expect(communityDescription({ bio: 'Open &amp; public' })).toBe('Open & public');
    expect(communityDescription({ description: 42 })).toBe('');
    expect(communityDescription(null)).toBe('');
  });
});

describe('conversation + common accessors', () => {
  it('reads unread count', () => {
    expect(conversationUnreadCount({ unread_count: 2 })).toBe(2);
    expect(conversationUnreadCount({ unreadCount: 1 })).toBe(1);
    expect(conversationUnreadCount({})).toBe(0);
  });
  it('timestampOf tolerates snake/camel and missing', () => {
    expect(timestampOf({ created_at: '2026-01-01T00:00:00Z' })).toBe('2026-01-01T00:00:00Z');
    expect(timestampOf({ createdAt: '2026-02-01T00:00:00Z' })).toBe('2026-02-01T00:00:00Z');
    expect(timestampOf({})).toBe('');
  });
  it('isAiActor detects agents across shapes', () => {
    expect(isAiActor({ is_ai: true })).toBe(true);
    expect(isAiActor({ isAi: true })).toBe(true);
    expect(isAiActor({ type: 'agent' })).toBe(true);
    expect(isAiActor({ user: { is_ai: true } })).toBe(true);
    expect(isAiActor({ name: 'human' })).toBe(false);
  });
});

describe('post dedup (orphaned reminds / "john Untitled" noise)', () => {
  it('normalizes media url across shapes, stripping query + trailing slash', () => {
    expect(normalizeMediaUrl({ media: [{ url: 'https://cdn.minds.io/img/abc.jpg?v=2' }] })).toBe('cdn.minds.io/img/abc.jpg');
    expect(normalizeMediaUrl({ media: { url: 'https://CDN.minds.io/img/abc.jpg/' } })).toBe('cdn.minds.io/img/abc.jpg');
    expect(normalizeMediaUrl({ media: 'https://cdn.minds.io/img/abc.jpg' })).toBe('cdn.minds.io/img/abc.jpg');
    expect(normalizeMediaUrl({ media: [] })).toBeNull();
    expect(normalizeMediaUrl({})).toBeNull();
  });
  it('keys orphaned reminds (no reposted_from_id) by their shared image', () => {
    // Two different post rows, different ids/authors, same image with cache-busting
    // query param — the legacy "john Untitled" dup pattern. Same dedup key.
    const a = { id: 'p1', author: { name: 'john' }, media: [{ url: 'https://cdn/x.jpg?v=1' }] };
    const b = { id: 'p2', author: { name: 'john' }, media: [{ url: 'https://cdn/x.jpg?v=9' }] };
    expect(postDedupKey(a)).toBe(postDedupKey(b));
  });
  it('prefers the repost link when present', () => {
    expect(postDedupKey({ id: 'p1', reposted_from_id: 'orig' })).toBe('orig');
    expect(postDedupKey({ id: 'p1', repostedFrom: { id: 'orig2' } })).toBe('orig2');
  });
  it('dedupePosts collapses the dups but keeps distinct posts', () => {
    const list = [
      { id: 'p1', media: [{ url: 'https://cdn/x.jpg?v=1' }] },
      { id: 'p2', media: [{ url: 'https://cdn/x.jpg?v=9' }] }, // dup of p1
      { id: 'p3', content: 'unique text' },
      { id: 'p4', reposted_from_id: 'orig' },
      { id: 'p5', reposted_from_id: 'orig' }, // dup repost of same original
    ];
    const out = dedupePosts(list);
    expect(out.map((p) => p.id)).toEqual(['p1', 'p3', 'p4']);
  });
});
