import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { tabsRender } = vi.hoisted(() => ({ tabsRender: vi.fn() }));

vi.mock('expo-router', () => ({
  Slot: () => <div data-testid="active-route" />,
  Tabs: Object.assign(
    (props: unknown) => {
      tabsRender(props);
      return <div data-testid="tabs-navigator" />;
    },
    { Screen: () => null },
  ),
  usePathname: () => '/discover',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'web' },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useWindowDimensions: () => ({ width: 1280, height: 720 }),
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => null }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('../../lib/theme', () => ({ useTheme: () => ({ colors: { bg: '#000', error: '#f00' } }) }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ sdk: null, user: null }) }));
vi.mock('../../lib/onboarding', () => ({ isUsernamePicked: vi.fn(), markUsernamePicked: vi.fn() }));
vi.mock('../../lib/signupWindow', () => ({ isFreshSignup: () => false }));
vi.mock('../../lib/cache', () => ({ subscribeToInvalidations: () => vi.fn() }));
vi.mock('../../components/MobileDrawer', () => ({ MobileDrawerProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../components/NavPill', () => ({ NavPill: () => null }));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org' }));

import TabLayout from '../../app/(tabs)/_layout';

describe('desktop route layout', () => {
  it('renders only the active route instead of retaining a hidden tab navigator', () => {
    render(<TabLayout />);

    expect(screen.getByTestId('active-route')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs-navigator')).not.toBeInTheDocument();
    expect(tabsRender).not.toHaveBeenCalled();
  });
});
