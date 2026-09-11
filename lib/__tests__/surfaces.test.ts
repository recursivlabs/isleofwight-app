/**
 * Receiving-surface logic: the detection + data mapping that makes a migrated
 * post render as an AUDIO player or an ARTICLE rather than a plain text post.
 * One concrete example of each (mirroring what the legacy import produces).
 */
import { describe, it, expect } from 'vitest';
import { isAudioUrl } from '../audio/types';
import { formatDuration } from '../../components/audio/format';
import {
  isArticlePost,
  postTitle,
  articleExcerpt,
  coverImageUrl,
  readingTimeMinutes,
  postContentFormat,
} from '../models';

// ── Example 1: an AUDIO post (custom_type=audio in legacy → media url is an mp3) ──
const audioPost = {
  id: 'aud_1',
  content: 'New episode is up 🎙️',
  media: [{ url: 'https://media.minds.com/legacy-media/ab/cd/track.mp3', type: 'audio' }],
  author: { name: 'Podcaster Jane', image: 'https://cdn/avatar.jpg' },
};

describe('audio surface detection', () => {
  it('recognizes an mp3 media url as audio', () => {
    expect(isAudioUrl('https://media.minds.com/legacy-media/ab/cd/track.mp3')).toBe(true);
    expect(isAudioUrl('https://x/audio/clip')).toBe(true); // path-based
    expect(isAudioUrl('https://x/photo.jpg')).toBe(false);
    expect(isAudioUrl('https://x/video.mp4')).toBe(false);
  });

  it('the example audio post carries a playable audio url', () => {
    const url = audioPost.media[0].url;
    expect(audioPost.media[0].type).toBe('audio');
    expect(isAudioUrl(url)).toBe(true);
  });

  it('formats player durations correctly', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(95)).toBe('1:35');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

// ── Example 2: an ARTICLE post (legacy blog → title + markdown body + cover) ──
const articlePost = {
  id: 'art_1',
  title: '  The Future of Decentralized Social  ',
  content:
    `# Why it matters\n\nMinds is **open** like Reddit. Here is a [link](https://minds.com) and \`code\`.\n\n${'A second paragraph with more than enough words to push the reading time past a single minute '.repeat(8)}`,
  content_format: 'markdown',
  media: [{ url: 'https://media.minds.com/legacy-media/ef/01/cover.jpg', type: 'image' }],
  author: { name: 'Bill Ottman' },
};

describe('article surface detection', () => {
  it('recognizes a titled markdown post as an article', () => {
    expect(isArticlePost(articlePost)).toBe(true);
  });

  it('does NOT treat a titled VIDEO post (plain format) as an article', () => {
    expect(isArticlePost({ title: 'Video', content_format: 'plain', content: '' })).toBe(false);
  });

  it('does NOT treat a normal text post as an article', () => {
    expect(isArticlePost({ content: 'just a quick thought', content_format: 'plain' })).toBe(false);
  });

  it('trims the title + reads the markdown format (snake or camel)', () => {
    expect(postTitle(articlePost)).toBe('The Future of Decentralized Social');
    expect(postContentFormat(articlePost)).toBe('markdown');
    expect(postContentFormat({ contentFormat: 'markdown' })).toBe('markdown');
  });

  it('builds a clean plain-text excerpt (markdown stripped)', () => {
    const ex = articleExcerpt(articlePost);
    expect(ex).not.toContain('#');
    expect(ex).not.toContain('**');
    expect(ex).not.toContain('](');
    expect(ex).toContain('Why it matters');
    expect(ex.length).toBeLessThanOrEqual(181);
  });

  it('extracts the cover image + a sane reading time', () => {
    expect(coverImageUrl(articlePost)).toBe('https://media.minds.com/legacy-media/ef/01/cover.jpg');
    expect(readingTimeMinutes(articlePost)).toBeGreaterThanOrEqual(1);
  });

  it('recovers a missing legacy article cover from its Minds GUID', () => {
    expect(coverImageUrl({
      ...articlePost,
      media: [],
      legacy_guid: '546153141079388160',
    })).toBe('https://cdn.minds.com/fs/v1/banners/546153141079388160');
    expect(coverImageUrl({ title: 'Video', content_format: 'plain', legacy_guid: '546153141079388160' })).toBeNull();
  });

  it('decodes entity-only legacy bodies without leaking entity spellings', () => {
    const legacy = { ...articlePost, content: 'It\'s here.&nbsp;Get ready &quot;now&quot;.' };
    expect(articleExcerpt(legacy)).toBe('It\'s here. Get ready "now".');
  });

  it('turns legacy HTML into a tag-free article excerpt', () => {
    const legacy = {
      ...articlePost,
      content: '<h2>Legacy heading</h2><p>Hello <strong>Minds</strong> &amp; welcome.</p>',
    };
    expect(articleExcerpt(legacy)).toBe('Legacy heading Hello Minds & welcome.');
    expect(readingTimeMinutes(legacy)).toBe(1);
  });
});
