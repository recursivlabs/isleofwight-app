type Segment = { segment: string };
type Segmenter = { segment(value: string): Iterable<Segment> };
type SegmenterConstructor = new (
  locale?: string | string[],
  options?: { granularity: 'grapheme' },
) => Segmenter;

const SegmenterImpl = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
const graphemeSegmenter = SegmenterImpl
  ? new SegmenterImpl(undefined, { granularity: 'grapheme' })
  : null;

/**
 * Return one user-visible character without cutting a UTF-16 surrogate pair.
 * Intl.Segmenter keeps joined emoji and flags intact; Array.from is the safe
 * fallback on native runtimes that do not provide Segmenter yet.
 */
function firstGrapheme(value: string): string {
  const normalized = value.normalize('NFC');
  if (graphemeSegmenter) {
    return graphemeSegmenter.segment(normalized)[Symbol.iterator]().next().value?.segment ?? '';
  }
  return Array.from(normalized)[0] ?? '';
}

export function getInitials(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return '?';

  const first = firstGrapheme(parts[0]);
  if (parts.length === 1) return first.toLocaleUpperCase() || '?';

  const last = firstGrapheme(parts[parts.length - 1]);
  return `${first}${last}`.toLocaleUpperCase() || '?';
}
