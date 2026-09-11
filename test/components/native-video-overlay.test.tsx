import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NativeVideoOverlay } from '../../components/NativeVideoOverlay';

describe('NativeVideoOverlay', () => {
  it('shows the supplied poster while playback is loading', () => {
    render(<NativeVideoOverlay poster="https://media.example/poster.jpg" state="loading" />);

    expect(screen.getByRole('img', { name: 'Video preview' })).toHaveAttribute(
      'src',
      'https://media.example/poster.jpg',
    );
    expect(screen.queryByText("Couldn't load this video")).not.toBeInTheDocument();
  });

  it('replaces a failed player with an honest unavailable state', () => {
    render(<NativeVideoOverlay poster="https://media.example/poster.jpg" state="failed" />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this video");
    expect(screen.getByRole('img', { name: 'Video preview' })).toBeInTheDocument();
  });

  it('gets out of the way once playback is ready', () => {
    const { container } = render(<NativeVideoOverlay state={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
