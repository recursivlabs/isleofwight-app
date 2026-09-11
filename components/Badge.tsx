import * as React from 'react';
import { View, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { spacing, radius, type ColorTokens } from '../constants/theme';
import { useColors } from '../lib/theme';

// 'gold' = the shared Minds+/Pro/Founder membership check, drawn as an X-style
// scalloped seal. 'pro' = an extra Pro marker (diamond), 'founder' = a ribbon —
// both shown only in the FULL suite (profile). 'agent' = a square AI chip badge.
// 'plus' kept for back-compat (getBadges emits 'gold').
type BadgeType = 'verified' | 'admin' | 'agent' | 'gold' | 'pro' | 'founder' | 'plus';

interface Props {
  type: BadgeType;
  size?: 'sm' | 'md';
}

// Built per-render so accent/accentMuted track the active theme.
function badgeConfig(colors: ColorTokens): Record<BadgeType, { icon: string; color: string; label: string; bg: string }> {
  return {
    gold: { icon: 'checkmark', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
    pro: { icon: 'diamond', color: colors.accent, label: 'Pro', bg: colors.accentMuted },
    founder: { icon: 'ribbon', color: colors.token, label: 'Founder', bg: colors.tokenMuted },
    verified: { icon: 'checkmark-circle', color: colors.verified, label: 'Verified', bg: colors.verifiedMuted },
    admin: { icon: 'shield', color: colors.accent, label: 'Admin', bg: colors.accentMuted },
    agent: { icon: 'sparkles', color: colors.accent, label: 'AI', bg: colors.accentMuted },
    plus: { icon: 'checkmark', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
  };
}

// X-style verified seal: two overlapping rounded squares (one rotated 45°) form
// an 8-point gold burst, with a white checkmark centered. Pure Views + a glyph.
// Exported so the sidebar's Upgrade row can reuse the exact same seal as the
// verified badge next to usernames.
export function GoldSeal({ size, color }: { size: number; color: string }) {
  const burst = Math.round(size * 0.82);
  const check = Math.round(size * 0.62);
  const square = {
    position: 'absolute' as const,
    width: burst, height: burst,
    borderRadius: Math.round(burst * 0.28),
    backgroundColor: color,
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={square} />
      <View style={[square, { transform: [{ rotate: '45deg' }] }]} />
      <Ionicons name="checkmark" size={check} color="#ffffff" style={{ zIndex: 1 }} />
    </View>
  );
}

// Agent: a clean filled rounded SQUARE with a white AI glyph — the single agent
// badge everywhere (replaces the old robot icon).
function AgentSquare({ size, color }: { size: number; color: string }) {
  const glyph = Math.round(size * 0.66);
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="sparkles" size={glyph} color="#ffffff" />
    </View>
  );
}

export const Badge = React.memo(function Badge({ type, size = 'sm' }: Props) {
  const colors = useColors();
  const config = badgeConfig(colors)[type];
  if (!config) return null;

  const isSeal = type === 'gold' || type === 'plus';
  const isAgentSq = type === 'agent';
  const glyph = size === 'sm' ? 14 : 12;

  const tip = Platform.OS === 'web' ? ({ title: config.label } as any) : {};
  const wrap = (node: React.ReactNode) => (
    <View accessible accessibilityLabel={config.label} {...tip}
      style={size === 'sm' ? undefined : {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: config.bg, paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: radius.sm,
      }}>
      {node}
    </View>
  );

  const icon = isSeal
    ? <GoldSeal size={glyph} color={config.color} />
    : isAgentSq
      ? <AgentSquare size={glyph} color={config.color} />
      : <Ionicons name={config.icon as any} size={size === 'sm' ? glyph : 12} color={config.color} />;

  if (size === 'sm') return wrap(icon);

  return wrap(
    <>
      {icon}
      <Text variant="caption" color={config.color} style={{ fontSize: 10 }}>{config.label}</Text>
    </>
  );
});

/**
 * Badges for a user/agent.
 *
 * - COMPACT (default) — for bylines, sidebars, chat, rails: ONE badge only, so
 *   the UI stays clean. An agent shows the AI square; a Plus/Pro/Founder shows a
 *   single gold seal (the tier breakdown lives on the profile); else verified /
 *   admin if present.
 * - FULL (`{ full: true }`) — for the PROFILE: the whole suite, in order (gold
 *   seal, Pro diamond, Founder ribbon, verified, admin, agent).
 */
export function getBadges(user: any, opts?: { full?: boolean }): BadgeType[] {
  const isPro = !!(user?.pro || user?.is_pro);
  const isPlus = !!(user?.plus || user?.is_plus);
  const isFounder = !!(user?.founder || user?.is_founder);
  const isVerified = !!(user?.verified || user?.is_verified);
  const isAdmin = user?.role === 'admin' || !!user?.is_admin;
  const isAgent = !!(user?.isAi || user?.is_ai || user?.type === 'agent');

  if (opts?.full) {
    const badges: BadgeType[] = [];
    if (isPlus || isPro) badges.push('gold');
    if (isPro) badges.push('pro');
    if (isFounder) badges.push('founder');
    if (isVerified) badges.push('verified');
    if (isAdmin) badges.push('admin');
    if (isAgent) badges.push('agent');
    return badges;
  }

  // Compact: a single badge by priority.
  if (isAgent) return ['agent'];
  if (isPlus || isPro || isFounder) return ['gold'];
  if (isVerified) return ['verified'];
  if (isAdmin) return ['admin'];
  return [];
}
