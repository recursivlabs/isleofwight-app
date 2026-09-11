// Canonical time formatting for the whole app so posts, messages, the inbox,
// and notifications all read the SAME way. The rule (Jack):
//   < 24h  -> relative, compact: now / 30m / 2h / 23h
//   >= 24h -> date only. This year -> "Jun 3". Prior year -> "Jun 3, 2021".

function toDate(input: string | number | Date | undefined | null): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Compact timestamp for list/feed surfaces. */
export function formatTimestamp(input: string | number | Date | undefined | null, opts?: { nowLabel?: string }): string {
  const d = toDate(input);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return opts?.nowLabel ?? 'now';
  if (diff < 60_000) return opts?.nowLabel ?? 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Clock time (HH:MM) for a single chat message. */
export function formatClock(input: string | number | Date | undefined | null): string {
  const d = toDate(input);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Day-separator label for chat history: Today / Yesterday / "Jun 3" / "Jun 3, 2021". */
export function formatDayLabel(input: string | number | Date | undefined | null): string {
  const d = toDate(input);
  if (!d) return '';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** True when two timestamps fall on different calendar days (for day separators). */
export function isNewDay(a: string | number | Date | undefined | null, b: string | number | Date | undefined | null): boolean {
  const da = toDate(a); const db = toDate(b);
  if (!da || !db) return !!da; // first message always starts a day
  return da.getFullYear() !== db.getFullYear() || da.getMonth() !== db.getMonth() || da.getDate() !== db.getDate();
}
