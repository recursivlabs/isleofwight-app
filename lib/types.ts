/**
 * Shared type helpers for the Minds app.
 * Eliminates `as any` casts throughout the codebase.
 */
import { type ViewStyle, TextStyle } from 'react-native';

/**
 * Web-only CSS properties that React Native's ViewStyle doesn't include.
 * Use with Platform.OS === 'web' spreads.
 */
export type WebStyle = {
  cursor?: string;
  transition?: string;
  outlineStyle?: string;
  boxShadow?: string;
  backdropFilter?: string;
  filter?: string;
  position?: string;
  overflowY?: string;
  background?: string;
  wordBreak?: string;
  minHeight?: string;
  maxHeight?: string;
  width?: string;
};

/**
 * Helper to create web-only styles without `as any`.
 * Returns empty object on native.
 */
export function webStyle(styles: WebStyle): ViewStyle {
  return styles as unknown as ViewStyle;
}

/**
 * Expo Router href type — used for router.push() calls.
 * The actual Href type is complex; this covers our usage.
 */
export type AppRoute = string | { pathname: string; params?: Record<string, string> };

/**
 * Helper to create a route without `as any`.
 */
export function route(path: string): AppRoute;
export function route(path: string, params: Record<string, string>): AppRoute;
export function route(path: string, params?: Record<string, string>): AppRoute {
  if (params) return { pathname: path, params };
  return path;
}
