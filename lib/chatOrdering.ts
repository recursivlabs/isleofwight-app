// Deterministic chat-thread ordering.
//
// Optimistic rows carry client-clock timestamps; server rows carry server-clock
// ones. Sorting the whole list by createdAt mixes the two clocks, which is what
// produced out-of-order answers (an agent reply reconciling ABOVE the question
// that caused it when the clocks disagreed). Deterministic rule instead:
// persisted rows sort by server time, and optimistic rows (temp-/agent-/
// streaming-) — which are by construction the newest things in the thread —
// pin to the bottom in the order they were created locally (`seq`).

export function isOptimisticRow(m: any): boolean {
  return typeof m?.id === 'string'
    && (m.id.startsWith('temp-') || m.id.startsWith('agent-') || m.id.startsWith('streaming-'));
}

export function sortThread(rows: any[]): any[] {
  const persisted: any[] = [];
  const optimistic: any[] = [];
  for (const m of rows) (isOptimisticRow(m) ? optimistic : persisted).push(m);
  persisted.sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
  optimistic.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  return [...persisted, ...optimistic];
}
