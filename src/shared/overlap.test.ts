// Tests for the `overlap` pure module. findOverlaps is the single
// conflict-detection function used by the editor's live warning,
// the day-card ⚠ icon, and the save-time check. Behaviour-only:
// assertions describe "what overlaps mean" via input → output, not
// how the filter is implemented.

import { describe, expect, it } from 'vitest';
import type { Session } from './ipc';
import { findOverlaps } from './overlap';

function mk(id: string, startMin: number, endMin: number): Session {
  return {
    id,
    dateKey: '2025-01-13',
    category: 'animation',
    label: id,
    startMin,
    endMin,
    notes: null,
    done: false,
    adjusted: false,
    overnightLinkId: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('findOverlaps', () => {
  it('returns no overlaps against an empty pool', () => {
    const target = { id: 't', startMin: 540, endMin: 660 };
    expect(findOverlaps([], target)).toEqual([]);
  });

  it('returns Sessions whose time range overlaps the target', () => {
    const pool = [
      mk('a', 480, 540), // 8–9, ends right at target's start → NOT overlap
      mk('b', 600, 720), // 10–12, sits inside target → overlap
      mk('c', 660, 780), // 11–13, starts at target's end → NOT overlap
      mk('d', 720, 840), // 12–14, after target → NOT overlap
    ];
    const target = { id: 't', startMin: 540, endMin: 660 }; // 9–11

    const out = findOverlaps(pool, target).map((s) => s.id);
    expect(out).toEqual(['b']);
  });

  it('treats target.endMin and otherSession.startMin equal as NOT overlap', () => {
    // exclusive-end semantics — a 9–10 Session sits next to a 10–11
    // Session without colliding.
    const pool = [mk('next', 600, 660)];
    const target = { id: 't', startMin: 540, endMin: 600 };
    expect(findOverlaps(pool, target)).toEqual([]);
  });

  it('treats target.startMin and otherSession.endMin equal as NOT overlap', () => {
    const pool = [mk('prev', 480, 540)];
    const target = { id: 't', startMin: 540, endMin: 600 };
    expect(findOverlaps(pool, target)).toEqual([]);
  });

  it('excludes the target itself by id from the result', () => {
    const pool = [mk('self', 540, 660), mk('other', 600, 720)];
    const target = { id: 'self', startMin: 540, endMin: 660 };

    const out = findOverlaps(pool, target).map((s) => s.id);
    expect(out).toEqual(['other']);
  });

  it('returns multiple overlapping Sessions when several collide', () => {
    const pool = [mk('a', 600, 720), mk('b', 630, 750), mk('c', 720, 780)];
    const target = { id: 't', startMin: 540, endMin: 720 };
    const out = findOverlaps(pool, target).map((s) => s.id);
    expect(out).toEqual(['a', 'b']);
  });
});
