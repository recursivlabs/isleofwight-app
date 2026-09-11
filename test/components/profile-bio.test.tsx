import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileBio, profileBioSegments } from '../../components/ProfileBio';

describe('ProfileBio', () => {
  it('renders safe HTTP links with browser-safe external navigation', () => {
    render(<ProfileBio bio="Visit https://example.com/about." expanded />);

    const link = screen.getByRole('link', { name: 'https://example.com/about' });
    expect(link).toHaveAttribute('href', 'https://example.com/about');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(document.body).toHaveTextContent('Visit https://example.com/about.');
  });

  it('keeps unsafe schemes inert', () => {
    render(<ProfileBio bio="Do not open javascript:alert(1) or data:text/html,hi" expanded />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/javascript:alert/)).toBeInTheDocument();
  });
});

describe('profileBioSegments', () => {
  it('keeps balanced URL brackets and trims sentence punctuation', () => {
    expect(profileBioSegments('Read https://en.wikipedia.org/wiki/Frost_flower_(sea_ice).')).toEqual([
      { type: 'text', text: 'Read ' },
      {
        type: 'link',
        text: 'https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)',
        url: 'https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)',
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('does not link visibly truncated destinations', () => {
    expect(profileBioSegments('Archive https://example.com/story…')).toEqual([
      { type: 'text', text: 'Archive ' },
      { type: 'text', text: 'https://example.com/story…' },
    ]);
  });
});
