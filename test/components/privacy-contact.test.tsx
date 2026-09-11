import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyScreen from '../../app/privacy';

describe('Privacy contact', () => {
  it('links data-rights requests to the published privacy email address', () => {
    render(<PrivacyScreen />);

    expect(screen.getByRole('link', { name: 'Email privacy@minds.com' }))
      .toHaveAttribute('href', 'mailto:privacy@minds.com');
  });
});
