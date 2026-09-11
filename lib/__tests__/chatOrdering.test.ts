import { describe, it, expect } from 'vitest';
import { sortThread, isOptimisticRow } from '../chatOrdering';

const at = (s: string) => `2026-07-24T12:0${s}:00.000Z`;

describe('isOptimisticRow', () => {
  it('flags temp-/agent-/streaming- ids and nothing else', () => {
    expect(isOptimisticRow({ id: 'temp-123' })).toBe(true);
    expect(isOptimisticRow({ id: 'agent-123' })).toBe(true);
    expect(isOptimisticRow({ id: 'streaming-123' })).toBe(true);
    expect(isOptimisticRow({ id: 'msg-uuid' })).toBe(false);
    expect(isOptimisticRow({ id: 42 })).toBe(false);
    expect(isOptimisticRow(null)).toBe(false);
  });
});

describe('sortThread', () => {
  it('sorts persisted rows by server time', () => {
    const out = sortThread([
      { id: 'b', createdAt: at('2') },
      { id: 'a', createdAt: at('1') },
    ]);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('pins optimistic rows to the bottom regardless of clock skew', () => {
    // Client clock AHEAD of server: the optimistic question has a later
    // timestamp than the server-persisted agent reply. A createdAt sort put
    // the reply ABOVE the question — the out-of-order bug.
    const out = sortThread([
      { id: 'temp-1', createdAt: at('9'), seq: 0 }, // question, skewed clock
      { id: 'server-reply', createdAt: at('1') },
    ]);
    expect(out.map((m) => m.id)).toEqual(['server-reply', 'temp-1']);
  });

  it('keeps optimistic rows in local send order via seq', () => {
    const out = sortThread([
      { id: 'streaming-2', createdAt: at('1'), seq: 5 },
      { id: 'temp-1', createdAt: at('9'), seq: 4 },
      { id: 'server-1', createdAt: at('0') },
    ]);
    expect(out.map((m) => m.id)).toEqual(['server-1', 'temp-1', 'streaming-2']);
  });

  it('breaks persisted-row timestamp ties stably by id', () => {
    const out = sortThread([
      { id: 'z', createdAt: at('1') },
      { id: 'a', createdAt: at('1') },
    ]);
    expect(out.map((m) => m.id)).toEqual(['a', 'z']);
  });
});
