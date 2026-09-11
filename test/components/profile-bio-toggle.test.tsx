import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProfileBioToggle } from '../../components/ProfileBioToggle';

function ToggleHarness() {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <ProfileBioToggle
      expanded={expanded}
      onToggle={() => setExpanded(value => !value)}
    />
  );
}

describe('ProfileBioToggle', () => {
  it('names the action and exposes its expanded state', async () => {
    render(<ToggleHarness />);

    const expand = screen.getByRole('button', { name: 'Show full profile bio' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).toHaveTextContent('Show more');

    await userEvent.click(expand);

    const collapse = screen.getByRole('button', { name: 'Collapse profile bio' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse).toHaveTextContent('Show less');
  });
});
