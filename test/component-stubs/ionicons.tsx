// @expo/vector-icons/Ionicons stub: renders a marker element carrying the icon
// name so tests can assert on which icon is shown without loading fonts.
import * as React from 'react';

export default function Ionicons({ name }: { name: string; size?: number; color?: string; style?: unknown }) {
  return React.createElement('span', { 'data-icon': name });
}
