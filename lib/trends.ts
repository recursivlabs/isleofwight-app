// "What's happening" — emergent topics from the COMMUNITY SIGNAL. No AI digest,
// no manual seeding (that's the future agent-driven admin console): just what real
// people are actually posting about right now, ranked so it reads as a live
// conversation rather than one loud account.
//
// Signals used (the cleanest, least-noisy ones for v1):
//   • hashtags               (#topic)
//   • shared external links  (people posting the same source/story)
// Ranking is DISTINCT AUTHORS × velocity — a topic is "alive" when MANY different
// people post it, recently. A single account spamming a tag can't manufacture a
// trend. Entity/NLP extraction and editorial seeding come later.

import { postReplyCount } from './models';

export interface Trend {
  key: string;
  label: string;
  type: 'topic' | 'link';
  postCount: number;
  authorCount: number;
  avatars: string[];   // up to 3 distinct-author avatars
  href: string;        // where the card navigates (search or the link)
  preview?: string;    // a one-line snippet from the top post, so it reads as a story
}

// Generic tags that carry no discussion signal — never interesting to click.
const STOP = new Set([
  'funny', 'meme', 'memes', 'lol', 'nsfw', 'news', 'video', 'photo', 'image',
  'minds', 'mindsapp', 'post', 'follow', 'followme', 'love', 'life', 'art',
]);

// Bare hosts read as boring/broken ("github.com"). Map the common ones to the
// name people know, and title-case the rest.
const HOST_LABELS: Record<string, string> = {
  'github.com': 'GitHub', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
  'x.com': 'X', 'twitter.com': 'X', 'reddit.com': 'Reddit', 'substack.com': 'Substack',
  'news.ycombinator.com': 'Hacker News', 'medium.com': 'Medium', 'twitch.tv': 'Twitch',
  'tiktok.com': 'TikTok', 'nytimes.com': 'NYT', 'bloomberg.com': 'Bloomberg',
  'arxiv.org': 'arXiv', 'wikipedia.org': 'Wikipedia', 'apple.com': 'Apple',
  'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'rumble.com': 'Rumble', 'odysee.com': 'Odysee',
};
function prettyHost(host: string): string {
  if (HOST_LABELS[host]) return HOST_LABELS[host];
  const base = host.replace(/\.(com|org|net|io|co|tv|gg|xyz|app|news|me|info|us)$/, '');
  const last = base.split('.').pop() || base;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// Common capitalized words that start sentences but aren't topics.
const PHRASE_STOP = new Set([
  'the', 'this', 'that', 'these', 'those', 'there', 'their', 'they', 'them',
  'here', 'what', 'when', 'where', 'which', 'while', 'with', 'your', 'you',
  'and', 'but', 'for', 'not', 'are', 'was', 'were', 'have', 'has', 'had',
  'will', 'would', 'could', 'should', 'from', 'just', 'like', 'also', 'some',
  'now', 'new', 'get', 'got', 'one', 'all', 'how', 'why', 'who', 'its', 'our',
  'i', 'im', 'ive', 'my', 'me', 'we', 'he', 'she', 'it', 'so', 'if', 'no', 'yes',
  'good', 'great', 'best', 'more', 'most', 'very', 'much', 'many', 'well', 'still',
  'today', 'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
]);

const authorId = (p: any): string =>
  String(p?.author?.id || p?.author?.username || p?.owner_guid || p?.ownerGuid || '');
const postTime = (p: any): number =>
  new Date(p?.created_at || p?.createdAt || 0).getTime() || 0;

interface Bucket {
  label: string;
  type: 'topic' | 'link';
  href: string;
  posts: Set<string>;
  authors: Set<string>;
  avatars: Map<string, string>;
  recent: number;
  topText: string;   // text of the highest-engagement post in the bucket
  topScore: number;
}

const postEngagement = (p: any): number =>
  Number(p?.score || p?.reactions_count || p?.votes_up || 0) +
  postReplyCount(p);

// One clean line from a post: strip URLs + markdown + hashtags, collapse space,
// take the first sentence-ish chunk. Turns a raw post into a story caption.
function cleanPreview(text: string): string {
  const t = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  const firstStop = t.search(/[.!?](\s|$)/);
  const chunk = firstStop > 20 && firstStop < 120 ? t.slice(0, firstStop + 1) : t.slice(0, 100);
  return chunk.trim();
}

export function computeTrends(posts: any[], limit = 4): Trend[] {
  const now = Date.now();
  const buckets = new Map<string, Bucket>();

  const bump = (key: string, label: string, type: 'topic' | 'link', href: string, p: any) => {
    if (STOP.has(key)) return;
    let b = buckets.get(key);
    if (!b) { b = { label, type, href, posts: new Set(), authors: new Set(), avatars: new Map(), recent: 0, topText: '', topScore: -1 }; buckets.set(key, b); }
    if (p.id) b.posts.add(p.id);
    const aid = authorId(p);
    if (aid) {
      b.authors.add(aid);
      const av = p.author?.image || p.author?.avatar;
      if (av && !b.avatars.has(aid) && b.avatars.size < 3) b.avatars.set(aid, av);
    }
    b.recent = Math.max(b.recent, postTime(p));
    // Keep the highest-engagement post's text as the bucket's story caption.
    const eng = postEngagement(p);
    if (eng > b.topScore) {
      const preview = cleanPreview(p?.content || p?.body || p?.title || '');
      if (preview) { b.topScore = eng; b.topText = preview; }
    }
  };

  for (const p of posts || []) {
    const text = String(p?.content || p?.body || p?.title || '');
    // hashtags
    for (const m of text.matchAll(/#(\w{2,30})/g)) {
      const tag = m[1].toLowerCase();
      bump(`t:${tag}`, `#${m[1]}`, 'topic', `/(tabs)/discover?q=${encodeURIComponent(`#${m[1]}`)}`, p);
    }
    // shared external links → group by host (a story/source people are on)
    for (const m of text.matchAll(/https?:\/\/([^\s/]+)/gi)) {
      const host = m[1].replace(/^www\./i, '').toLowerCase();
      if (!host || host.includes('minds.com') || host.includes('recursiv')) continue; // not "news"
      bump(`l:${host}`, prettyHost(host), 'link', `/(tabs)/discover?q=${encodeURIComponent(host)}`, p);
    }
    // proper-noun topics — capitalized words/phrases (2-3 words) people are
    // actually talking about (e.g. "Hacker News", "Bitcoin"). The ≥2-distinct-
    // author filter below throws out random sentence-initial capitals.
    for (const m of text.matchAll(/\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){1,2})\b/g)) {
      const phrase = m[1].trim();
      const key = phrase.toLowerCase();
      // MULTI-WORD ONLY. Single capitalized words (Instead, Earth, Saturn) are
      // mostly sentence-initial noise; a real topic is a proper phrase.
      if (!phrase.includes(' ')) continue;
      if (phrase.split(/\s+/).every((w) => PHRASE_STOP.has(w.toLowerCase()))) continue;
      bump(`p:${key}`, phrase, 'topic', `/(tabs)/discover?q=${encodeURIComponent(phrase)}`, p);
    }
  }

  return [...buckets.values()]
    // ≥2 distinct people = a conversation, not one account.
    // Two people, or one voice on the same topic twice: a young app's news
    // account must be able to light this up alone.
    .filter((b) => b.authors.size >= 2 || b.posts.size >= 2)
    .map((b) => {
      // Fresher topics rank higher; decays over ~3 days.
      const recencyBoost = 1 + Math.max(0, 1 - (now - b.recent) / (3 * 864e5));
      const score = b.authors.size * Math.log2(b.posts.size + 1) * recencyBoost;
      return { b, score };
    })
    .sort((a, z) => z.score - a.score)
    .slice(0, limit)
    .map(({ b }) => ({
      key: b.label,
      label: b.label,
      type: b.type,
      postCount: b.posts.size,
      authorCount: b.authors.size,
      avatars: [...b.avatars.values()],
      href: b.href,
      preview: b.topText || undefined,
    }));
}
