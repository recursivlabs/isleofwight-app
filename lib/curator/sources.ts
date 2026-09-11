/**
 * Default RSS / Atom sources the Minds personal-agent CuratorService
 * pulls from on behalf of Free-tier users. Each onboarding interest
 * tag maps to a curated set of 3-6 high-signal feeds. Users can add
 * their own paste-in RSS URLs on top of these defaults.
 *
 * The list is opinionated, not exhaustive. It's tuned to return good
 * content on day 1 without OAuth connections. Minds+ users layer
 * connected-account taste on top of these; Pro adds premium sources.
 *
 * Add, don't break. Keep sources that return clean RSS reliably and
 * have a substantive publishing cadence. Dead or spammy feeds should
 * be removed rather than replaced silently.
 */

export type MindsInterest =
  | 'ai'
  | 'crypto'
  | 'design'
  | 'tech'
  | 'privacy'
  | 'politics'
  | 'nfl'
  | 'startups'
  | 'science'
  | 'philosophy'
  | 'music'
  | 'film'
  | 'gaming'
  | 'books'
  | 'climate'
  | 'space'
  | 'health'
  | 'art'
  | 'history'
  | 'food'
  | 'travel'
  | 'finance'
  | 'journalism'
  | 'culture';

export interface MindsRssSource {
  name: string;
  url: string;
}

export const MINDS_INTEREST_SOURCES: Record<MindsInterest, MindsRssSource[]> = {
  ai: [
    { name: 'Anthropic', url: 'https://www.anthropic.com/rss.xml' },
    { name: 'OpenAI', url: 'https://openai.com/blog/rss.xml' },
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
    { name: 'HN — AI', url: 'https://hnrss.org/newest?q=AI' },
    { name: 'The Gradient', url: 'https://thegradient.pub/rss/' },
    { name: 'Ars — AI', url: 'https://arstechnica.com/ai/feed/' },
  ],
  crypto: [
    { name: 'Bankless', url: 'https://www.bankless.com/rss/' },
    { name: 'Coindesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'HN — crypto', url: 'https://hnrss.org/newest?q=crypto+OR+bitcoin+OR+ethereum' },
    { name: 'Delphi Digital', url: 'https://delphidigital.io/feed' },
  ],
  design: [
    { name: 'Sidebar.io', url: 'https://sidebar.io/feed.xml' },
    { name: 'CSS-Tricks', url: 'https://css-tricks.com/feed/' },
    { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
    { name: 'A List Apart', url: 'https://alistapart.com/main/feed/' },
  ],
  tech: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://arstechnica.com/feed/' },
    { name: 'Stratechery (free)', url: 'https://stratechery.com/feed/' },
  ],
  privacy: [
    { name: 'EFF Deeplinks', url: 'https://www.eff.org/rss/updates.xml' },
    { name: 'Signal Blog', url: 'https://signal.org/blog/rss.xml' },
    { name: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/' },
  ],
  politics: [
    { name: 'Tangle', url: 'https://www.readtangle.com/rss/' },
    { name: 'Semafor Principals', url: 'https://www.semafor.com/feed/politics' },
    { name: 'The Dispatch', url: 'https://thedispatch.com/feed/' },
  ],
  nfl: [
    { name: 'ESPN NFL', url: 'https://www.espn.com/espn/rss/nfl/news' },
    { name: 'The Athletic — NFL', url: 'https://theathletic.com/nfl/rss/' },
    { name: 'r/NFL — top', url: 'https://www.reddit.com/r/nfl/top/.rss?t=day' },
  ],
  startups: [
    { name: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss' },
    { name: 'First Round Review', url: 'https://review.firstround.com/feed.xml' },
    { name: 'HN — Show HN', url: 'https://hnrss.org/show' },
  ],
  science: [
    { name: 'Quanta', url: 'https://www.quantamagazine.org/feed/' },
    { name: 'Nature News', url: 'https://www.nature.com/nature.rss' },
    { name: 'Ars — Science', url: 'https://arstechnica.com/science/feed/' },
  ],
  philosophy: [
    { name: 'Aeon', url: 'https://aeon.co/feed.rss' },
    { name: 'LessWrong', url: 'https://www.lesswrong.com/feed.xml' },
  ],
  music: [
    { name: 'Pitchfork', url: 'https://pitchfork.com/feed/feed-news/rss' },
    { name: 'Stereogum', url: 'https://www.stereogum.com/feed/' },
    { name: 'The Quietus', url: 'https://thequietus.com/feed' },
    { name: 'NPR Music', url: 'https://feeds.npr.org/1039/rss.xml' },
  ],
  film: [
    { name: 'A.V. Club — Film', url: 'https://www.avclub.com/rss/tag/film' },
    { name: 'Film Comment', url: 'https://www.filmcomment.com/feed/' },
    { name: 'Letterboxd — editorial', url: 'https://letterboxd.com/journal/rss/' },
  ],
  gaming: [
    { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
    { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
    { name: 'Giant Bomb', url: 'https://www.giantbomb.com/feeds/news/' },
  ],
  books: [
    { name: 'Literary Hub', url: 'https://lithub.com/feed/' },
    { name: 'The Paris Review', url: 'https://www.theparisreview.org/blog/feed/' },
    { name: 'NYRB', url: 'https://www.nybooks.com/feed/' },
  ],
  climate: [
    { name: 'Heatmap', url: 'https://heatmap.news/feed' },
    { name: 'Inside Climate News', url: 'https://insideclimatenews.org/feed/' },
    { name: 'Carbon Brief', url: 'https://www.carbonbrief.org/feed' },
  ],
  space: [
    { name: 'NASA News', url: 'https://www.nasa.gov/news-release/feed/' },
    { name: 'Ars — Space', url: 'https://arstechnica.com/space/feed/' },
    { name: 'The Planetary Society', url: 'https://www.planetary.org/rss' },
  ],
  health: [
    { name: 'Stat News', url: 'https://www.statnews.com/feed/' },
    { name: 'The Conversation — Health', url: 'https://theconversation.com/us/health/articles.atom' },
  ],
  art: [
    { name: 'Hyperallergic', url: 'https://hyperallergic.com/feed/' },
    { name: 'Artforum', url: 'https://www.artforum.com/feed/' },
  ],
  history: [
    { name: 'Not Even Past', url: 'https://notevenpast.org/feed/' },
    { name: 'History Today', url: 'https://www.historytoday.com/feed' },
  ],
  food: [
    { name: 'Serious Eats', url: 'https://www.seriouseats.com/feed/all' },
    { name: 'Eater', url: 'https://www.eater.com/rss/index.xml' },
  ],
  travel: [
    { name: 'NYT — Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml' },
    { name: 'Afar', url: 'https://www.afar.com/rss' },
  ],
  finance: [
    { name: 'Matt Levine — Money Stuff', url: 'https://www.bloomberg.com/opinion/authors/ARbTQlRLRjE/matthew-s-levine.rss' },
    { name: 'Marginal Revolution', url: 'https://marginalrevolution.com/feed' },
    { name: 'Noahpinion', url: 'https://www.noahpinion.blog/feed' },
  ],
  journalism: [
    { name: 'Columbia Journalism Review', url: 'https://www.cjr.org/feeds/cjr_all.rss' },
    { name: 'Nieman Lab', url: 'https://www.niemanlab.org/feed/' },
    { name: 'Poynter', url: 'https://www.poynter.org/feed/' },
  ],
  culture: [
    { name: 'The Point', url: 'https://thepointmag.com/feed/' },
    { name: 'n+1', url: 'https://www.nplusonemag.com/feed/' },
  ],
};

/** Return all RSS sources for a given set of user interests. */
export function getSourcesForInterests(interests: readonly string[]): MindsRssSource[] {
  const sources: MindsRssSource[] = [];
  const seen = new Set<string>();
  for (const interest of interests) {
    const key = interest.toLowerCase() as MindsInterest;
    const matches = MINDS_INTEREST_SOURCES[key];
    if (!matches) continue;
    for (const src of matches) {
      if (seen.has(src.url)) continue;
      seen.add(src.url);
      sources.push(src);
    }
  }
  return sources;
}
