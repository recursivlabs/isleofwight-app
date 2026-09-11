import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArticleCard } from '../../components/ArticleCard';

const legacyArticle = {
  id: 'legacy-article-1',
  title: 'A migrated article',
  content_format: 'markdown',
  content: '<h2>Legacy heading</h2><p>Hello <strong>Minds</strong>.</p>',
  media: [],
};

describe('ArticleCard', () => {
  it('renders legacy HTML as document structure in the full reader', () => {
    const { container } = render(<ArticleCard post={legacyArticle} full />);

    expect(screen.getByRole('heading', { name: 'Legacy heading' })).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('Minds');
    expect(container.textContent).not.toContain('<h2>');
  });

  it('sanitizes active content in a migrated article', () => {
    const { container } = render(
      <ArticleCard
        post={{
          ...legacyArticle,
          content: '<p>Safe</p><img src="https://cdn.minds.com/x.jpg" onerror="window.__pwned=true"><script>window.__pwned=true</script>',
        }}
        full
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('uses readable text rather than tags in the compact excerpt', () => {
    const { container } = render(<ArticleCard post={legacyArticle} />);

    expect(container.textContent).toContain('Legacy heading Hello Minds.');
    expect(container.textContent).not.toContain('<h2>');
  });

  it('renders entity-only legacy article bodies as readable text', () => {
    const { container } = render(
      <ArticleCard post={{ ...legacyArticle, content: 'It\'s here.&nbsp;Get ready &quot;now&quot;.' }} full />,
    );

    expect(container.textContent).toContain('It\'s here. Get ready "now".');
    expect(container.textContent).not.toContain('&nbsp;');
    expect(container.textContent).not.toContain('&quot;');
  });

  it('uses the live legacy banner as the cover when media rows are absent', () => {
    const { container } = render(
      <ArticleCard post={{ ...legacyArticle, legacy_guid: '546153141079388160' }} />,
    );

    expect(container.querySelector('img')?.getAttribute('src'))
      .toBe('https://cdn.minds.com/fs/v1/banners/546153141079388160');
  });
});
