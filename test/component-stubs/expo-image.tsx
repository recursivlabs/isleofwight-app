// expo-image stub: a plain <img> so Avatar and media render without the
// native module. Keeps the `source={{ uri }}` contract.
import * as React from 'react';

export function Image(props: {
  source?: { uri?: string } | string;
  style?: unknown;
  alt?: string;
  contentFit?: string;
  accessibilityLabel?: string;
}) {
  const src = typeof props.source === 'string' ? props.source : props.source?.uri;
  return React.createElement('img', { src, alt: props.accessibilityLabel ?? props.alt ?? '' });
}

export default { Image };
