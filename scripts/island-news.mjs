// Post the latest island news into the Local News group. Dedupes on link.
// Usage: IOW_NEWS_KEY=... node iow-news.mjs [maxPerRun]
import { readFileSync, existsSync } from 'node:fs';
const S = '';
const key = process.env.IOW_NEWS_KEY || '';
if (!key) { console.error('no key'); process.exit(1); }
const BASE = 'https://api.minds.com/api/v1';
const COMMUNITY = '4282fc1b-5a2a-48f4-ae25-f5d10686133c'; // Local News
const MAX = Number(process.argv[2] || 4);
const FEEDS = [
  ['Isle of Wight County Press', 'https://www.countypress.co.uk/news/rss/'],
  ['OnTheWight', 'https://onthewight.com/feed/'],
  ['Island Echo', 'https://www.islandecho.co.uk/feed/'],
];
const H = { Authorization: `Bearer ${key}` };
const decode = (t) => (t || '').replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&#8216;|&lsquo;/g, "'").replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/g, '"').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#8230;|&hellip;/g, '...').replace(/\s+/g, ' ').trim();
const tag = (x, n) => { const m = x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return m ? m[1] : ''; };
let items = [];
for (const [source, url] of FEEDS) {
  try {
    const xml = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (island news bot)' } }).then((r) => r.text());
    for (const it of xml.split('<item>').slice(1)) {
      const link = decode(tag(it, 'link')) || decode(tag(it, 'guid'));
      const title = decode(tag(it, 'title'));
      const desc = decode(tag(it, 'description')).slice(0, 220);
      const date = new Date(decode(tag(it, 'pubDate')) || Date.now());
      if (link && title) items.push({ source, link, title, desc, date });
    }
  } catch (e) { console.log('feed failed', source, e.message); }
}
items.sort((a, b) => b.date - a.date);
const recent = await fetch(`${BASE}/posts?community_id=${COMMUNITY}&limit=100`, { headers: H }).then((r) => r.json()).catch(() => ({}));
const seen = new Set((recent.data || []).map((p) => p.content || '').flatMap((c) => c.match(/https?:\/\/\S+/g) || []));
let posted = 0;
for (const it of items) {
  if (posted >= MAX) break;
  if (seen.has(it.link)) continue;
  const content = `${it.title}\n\n${it.desc ? it.desc + (it.desc.length >= 220 ? '...' : '') + '\n\n' : ''}${it.source}: ${it.link}`;
  const r = await fetch(`${BASE}/posts`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ content, community_id: COMMUNITY }) });
  if (r.ok) { posted++; console.log('posted', it.source, '|', it.title.slice(0, 60)); }
  else console.log('FAIL', r.status, (await r.text()).slice(0, 160));
}
console.log(`items ${items.length}, already posted ${seen.size}, new ${posted}`);
