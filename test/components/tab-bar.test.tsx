import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    textMuted: '#888888',
    borderSubtle: '#222222',
  }),
}));

import { TabBar } from '../../components/TabBar';

describe('TabBar accessibility', () => {
  it('names the tab set and exposes the selected section', async () => {
    const onChange = vi.fn();
    render(
      <TabBar
        tabs={[
          { key: 'posts', label: 'Posts' },
          { key: 'following', label: 'Following' },
        ]}
        active="posts"
        onChange={onChange}
        scrollable
        accessibilityLabel="Profile sections"
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Posts' })).toHaveAttribute('aria-selected', 'true');
    const following = screen.getByRole('tab', { name: 'Following' });
    expect(following).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(following);
    expect(onChange).toHaveBeenCalledWith('following');
  });
});
