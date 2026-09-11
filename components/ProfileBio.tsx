import * as React from 'react';
import { Linking, Platform } from 'react-native';

import { useColors } from '../lib/theme';
import { isLikelyTruncatedUrl, trimUrlEnd, URL_PATTERN_SOURCE } from '../lib/urls';
import { Text } from './Text';

export type ProfileBioSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; url: string };

/**
 * Linkify only explicit HTTP(S) URLs from profile text. Bios are plain text,
 * not markdown or HTML, so everything else stays inert and renders verbatim.
 */
export function profileBioSegments(bio: string): ProfileBioSegment[] {
  if (!bio) return [];

  const matches = new RegExp(URL_PATTERN_SOURCE, 'g');
  const segments: ProfileBioSegment[] = [];
  let cursor = 0;

  for (const match of bio.matchAll(matches)) {
    const index = match.index ?? cursor;
    if (index > cursor) segments.push({ type: 'text', text: bio.slice(cursor, index) });

    const raw = match[0];
    const url = trimUrlEnd(raw);
    if (isLikelyTruncatedUrl(url)) {
      segments.push({ type: 'text', text: raw });
    } else {
      segments.push({ type: 'link', text: url, url });
      if (raw.length > url.length) {
        segments.push({ type: 'text', text: raw.slice(url.length) });
      }
    }
    cursor = index + raw.length;
  }

  if (cursor < bio.length) segments.push({ type: 'text', text: bio.slice(cursor) });
  return segments;
}

export function ProfileBio({ bio, expanded }: { bio: string; expanded: boolean }) {
  const colors = useColors();

  return (
    <Text
      variant="body"
      color={colors.textSecondary}
      numberOfLines={expanded ? undefined : 4}
      style={{ lineHeight: 22 }}
    >
      {profileBioSegments(bio).map((segment, index) => {
        if (segment.type === 'text') {
          return <React.Fragment key={`${index}:${segment.text}`}>{segment.text}</React.Fragment>;
        }

        const webLinkProps = Platform.OS === 'web'
          ? {
              href: segment.url,
              hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' },
            }
          : {
              onPress: () => { void Linking.openURL(segment.url); },
            };

        return (
          <Text
            key={`${index}:${segment.url}`}
            accessibilityRole="link"
            color={colors.accent}
            style={{ textDecorationLine: 'underline' }}
            {...(webLinkProps as any)}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
