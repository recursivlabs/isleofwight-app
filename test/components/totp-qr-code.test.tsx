import type * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const qr = vi.hoisted(() => vi.fn());

vi.mock('react-native-qrcode-svg', () => ({
  default: (props: Record<string, unknown>) => {
    qr(props);
    return <div data-testid="totp-qr" />;
  },
}));

vi.mock('react-native', () => ({
  View: ({ children, accessibilityRole, accessibilityLabel }: any) => (
    <div role={accessibilityRole} aria-label={accessibilityLabel}>{children}</div>
  ),
}));

vi.mock('../../components/Text', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({ glass: '#222', text: '#fff', textMuted: '#aaa' }),
}));

import { TotpQrCode } from '../../components/TotpQrCode';

describe('TotpQrCode', () => {
  it('renders the complete setup URI as a scannable, accessible QR code and manual fallback', () => {
    const uri = 'otpauth://totp/Minds%3Amember%40example.com?secret=ABC123&issuer=Minds';

    render(<TotpQrCode uri={uri} />);

    expect(screen.getByRole('image', { name: 'Authenticator setup QR code' })).toBeInTheDocument();
    expect(screen.getByTestId('totp-qr')).toBeInTheDocument();
    expect(qr).toHaveBeenCalledWith(expect.objectContaining({ value: uri, size: 196 }));
    expect(screen.getByText(uri)).toBeInTheDocument();
  });
});
