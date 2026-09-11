import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '../../components/Avatar';

describe('Avatar accessibility', () => {
  it('names an image avatar when the caller supplies standalone context', () => {
    render(
      <Avatar
        uri="https://cdn.example/technology.jpg"
        name="Technology"
        accessibilityLabel="Technology community avatar"
      />,
    );

    expect(screen.getByRole('img', { name: 'Technology community avatar' })).toBeInTheDocument();
  });

  it('names the initials fallback with the same caller-supplied context', () => {
    render(
      <Avatar
        name="Technology"
        accessibilityLabel="Technology community avatar"
      />,
    );

    expect(screen.getByRole('img', { name: 'Technology community avatar' })).toHaveTextContent('T');
  });

  it('renders a complete emoji grapheme instead of a replacement glyph', () => {
    render(
      <Avatar
        name="Adrint 🇨🇦"
        accessibilityLabel="Adrint avatar"
      />,
    );

    const avatar = screen.getByRole('img', { name: 'Adrint avatar' });
    expect(avatar).toHaveTextContent('A🇨🇦');
    expect(avatar).not.toHaveTextContent('�');
  });
});
