import * as React from 'react';
import {
  Redirect,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router';
import { useAuth } from './auth';
import { otpSignInPath } from './authRedirect';

const PRIVATE_ROUTE_ROOTS = new Set([
  'admin',
  'agent',
  'ai',
  'apps',
  'billing',
  'blocked',
  'bookmarks',
  'boost',
  'chat',
  'create',
  'email',
  'feedback',
  'invites',
  'jobs',
  'muted',
  'notifications',
  'org-settings',
  'profile',
  'protocols',
  'settings',
  'switch-account',
  'wallet',
  'webhooks',
  'verify-email-change',
]);

/**
 * Routes that cannot do useful work without an authenticated account.
 * Public posts, profiles, communities, pricing, privacy, and the moderation
 * transparency log deliberately stay outside this list.
 */
export function isPrivateRoute(pathname: string): boolean {
  const normalized = normalizeRoutePathname(pathname);
  if (normalized === '/auth/pick-username') return true;
  const root = normalized.split('/').filter(Boolean)[0];
  return !!root && PRIVATE_ROUTE_ROOTS.has(root);
}

function normalizeRoutePathname(pathname: string): string {
  return pathname.replace(/^\/\(tabs\)(?=\/|$)/, '') || '/';
}

function currentReturnTo(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  segments: string[],
): string {
  // On web the address bar is authoritative and already distinguishes path
  // params from query params. This preserves quote/composer and checkout state.
  if (typeof window !== 'undefined' && window.location) {
    return `${pathname}${window.location.search}${window.location.hash}`;
  }

  // Native has no address bar. Expo includes dynamic path params in the global
  // params object, so omit names represented by [segment] to avoid returning
  // to /chat/123?id=123 while retaining real query state.
  const pathParamNames = new Set(
    segments.flatMap((segment) => {
      const match = segment.match(/^\[\[?\.\.\.(.+)\]\]?$/) ?? segment.match(/^\[(.+)\]$/);
      return match ? [match[1]] : [];
    }),
  );
  const query: string[] = [];
  for (const [key, raw] of Object.entries(params)) {
    if (pathParamNames.has(key) || raw == null) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return query.length > 0 ? `${pathname}?${query.join('&')}` : pathname;
}

/**
 * Prevent private route trees from mounting before authentication. This is
 * intentionally above the root navigator: hooks that fetch notifications,
 * hydrate drafts, open realtime connections, or wait on an SDK never run for
 * a signed-out deep link.
 */
export function AuthRouteGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>;
  const segments = useSegments() as string[];

  if (!isPrivateRoute(pathname)) return <>{children}</>;
  if (isLoading) return null;
  if (!user) {
    return (
      <Redirect
        href={otpSignInPath(currentReturnTo(normalizeRoutePathname(pathname), params, segments)) as any}
      />
    );
  }
  return <>{children}</>;
}

/**
 * True only for platform/admin users. Matches the check used by the SideNav
 * admin item and the admin Badge.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return !!((user as any)?.role === 'admin' || (user as any)?.is_admin);
}

/**
 * Gate a platform/admin-only screen. Non-admins are redirected to the feed.
 * Returns false while loading or when not allowed, so the screen renders
 * nothing instead of flashing platform tooling at a consumer.
 */
export function useRequireAdmin(): boolean {
  const { isLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  React.useEffect(() => {
    if (!isLoading && !isAdmin) router.replace('/(tabs)');
  }, [isLoading, isAdmin, router]);
  return isAdmin && !isLoading;
}

/**
 * Wrap a screen so only platform/admin users can render it. Consumers who hit
 * the route directly are bounced to the feed before the screen's own hooks run.
 */
export function withAdminGuard<P extends object>(Component: React.ComponentType<P>) {
  return function AdminGuarded(props: P) {
    const allowed = useRequireAdmin();
    if (!allowed) return null;
    return <Component {...props} />;
  };
}
