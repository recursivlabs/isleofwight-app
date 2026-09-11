import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfileUserRow } from '../../components/ProfileUserRow';

describe('ProfileUserRow', () => {
  it('exposes the destination as a named link and activates it', async () => {
    const onPress = vi.fn();

    render(
      <ProfileUserRow
        user={{ name: 'Lady Red', username: 'ladyred', bio: 'Independent creator' }}
        onPress={onPress}
      />,
    );

    const link = screen.getByRole('link', { name: 'View profile for Lady Red, @ladyred' });
    expect(link).toHaveTextContent('Lady Red');
    expect(link).toHaveTextContent('Independent creator');

    await userEvent.click(link);

    expect(onPress).toHaveBeenCalledOnce();
  });

  it('uses the username without repeating it when no display name exists', () => {
    render(
      <ProfileUserRow
        user={{ username: 'alice' }}
        onPress={() => {}}
      />,
    );

    expect(screen.getByRole('link', { name: 'View profile for alice' })).toHaveTextContent('@alice');
  });
});
