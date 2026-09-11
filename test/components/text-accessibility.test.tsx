import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Text } from '../../components/Text';
import { ScreenHeader } from '../../components/ScreenHeader';

describe('Text heading semantics', () => {
  it.each([
    ['h1', 1],
    ['h2', 2],
    ['h3', 3],
  ] as const)('exposes the %s visual variant as heading level %i', (variant, level) => {
    render(<Text variant={variant}>Launch Minds</Text>);

    expect(screen.getByRole('heading', { level, name: 'Launch Minds' })).toBeInTheDocument();
  });

  it('does not turn ordinary text into a heading', () => {
    render(<Text>Readable body copy</Text>);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('preserves an explicit caller accessibility role and level', () => {
    const { rerender } = render(
      <Text variant="h3" accessibilityRole="header" aria-level={1}>Page title</Text>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Page title' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    rerender(<Text variant="h3" accessibilityRole="text">Decorative display text</Text>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('exposes the shared screen title as the page-level heading', () => {
    render(<ScreenHeader title="Post" showBack={false} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Post' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});
