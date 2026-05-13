// Tests for the `summarize` pure module — ported behaviour from
// weekly_scheduler.html's summarize / summarizeAll / summarizeNow /
// summarizeLogged / dayWorkHours / expectedHoursByNow.
//
// Behaviour-only: assertions describe "what the rollup means" via
// input → output, not how the math is implemented. Off-Days are
// accepted as a parameter so issue #7 (Off-Days) can wire them in
// without changing this module's signature.

import { describe, expect, it } from 'vitest';
import type { Session } from './ipc';
import {
  dayWorkHours,
  expectedHoursByNow,
  summarize,
  summarizeAll,
  summarizeLogged,
  summarizeNow,
} from './summarize';

function mk(overrides: Partial<Session> = {}): Session {
  return {
    id: 's',
    dateKey: '2026-05-13',
    category: 'animation',
    label: 'work',
    startMin: 540,
    endMin: 600,
    notes: null,
    done: false,
    adjusted: false,
    overnightLinkId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('dayWorkHours', () => {
  it('returns 0 for an empty day', () => {
    expect(dayWorkHours([])).toBe(0);
  });

  it('sums hours across work Categories and excludes break time', () => {
    expect(
      dayWorkHours([
        mk({ category: 'animation', startMin: 8 * 60, endMin: 11 * 60 }), // 3h
        mk({ category: 'break', startMin: 11 * 60, endMin: 11 * 60 + 30 }), // 30m → excluded
        mk({ category: 'workflow', startMin: 11 * 60 + 30, endMin: 13 * 60 + 30 }), // 2h
        mk({ category: 'cornerman', startMin: 14 * 60, endMin: 16 * 60 }), // 2h
      ]),
    ).toBe(7);
  });
});

describe('summarize', () => {
  it('rolls up per-Category hours across the date range, day by day', () => {
    const days: Record<string, Session[]> = {
      '2026-05-13': [
        mk({ category: 'animation', startMin: 8 * 60, endMin: 11 * 60 }),
        mk({ category: 'workflow', startMin: 11 * 60, endMin: 12 * 60 }),
      ],
      '2026-05-14': [
        mk({ dateKey: '2026-05-14', category: 'cornerman', startMin: 9 * 60, endMin: 12 * 60 }),
      ],
    };
    const out = summarize(days, new Date(2026, 4, 13), new Date(2026, 4, 14));
    expect(out.animation).toBe(3);
    expect(out.workflow).toBe(1);
    expect(out.cornerman).toBe(3);
    expect(out.break).toBe(0);
    expect(out.totalWork).toBe(7);
  });

  it('includes a per-Day entry for every Day in the range, in order', () => {
    const out = summarize({}, new Date(2026, 4, 11), new Date(2026, 4, 13));
    expect(out.perDay.map((p) => p.key)).toEqual(['2026-05-11', '2026-05-12', '2026-05-13']);
    // Empty range still rolls up to zeroes
    expect(out.totalWork).toBe(0);
  });
});

describe('summarizeLogged', () => {
  it('only counts done Sessions toward the totals', () => {
    const days: Record<string, Session[]> = {
      '2026-05-13': [
        mk({ id: 'a', category: 'animation', startMin: 8 * 60, endMin: 10 * 60, done: true }),
        mk({ id: 'b', category: 'animation', startMin: 10 * 60, endMin: 12 * 60, done: false }),
      ],
    };
    const out = summarizeLogged(days, new Date(2026, 4, 13), new Date(2026, 4, 13), {
      offDays: new Set(),
    });
    expect(out.animation).toBe(2); // only the done 2h session
  });

  it('skips Days listed in offDays (contributes zero hours)', () => {
    const days: Record<string, Session[]> = {
      '2026-05-13': [mk({ category: 'cornerman', startMin: 9 * 60, endMin: 12 * 60, done: true })],
      '2026-05-14': [
        mk({
          dateKey: '2026-05-14',
          category: 'cornerman',
          startMin: 9 * 60,
          endMin: 12 * 60,
          done: true,
        }),
      ],
    };
    const out = summarizeLogged(days, new Date(2026, 4, 13), new Date(2026, 4, 14), {
      offDays: new Set(['2026-05-13']),
    });
    expect(out.cornerman).toBe(3); // only the 14th counts
  });
});

describe('summarizeAll', () => {
  it('discovers the first/last Days containing Sessions and rolls up across the span', () => {
    const days: Record<string, Session[]> = {
      '2026-05-13': [mk({ category: 'animation', startMin: 8 * 60, endMin: 10 * 60 })],
      '2026-05-15': [
        mk({ dateKey: '2026-05-15', category: 'workflow', startMin: 9 * 60, endMin: 11 * 60 }),
      ],
    };
    const out = summarizeAll(days);
    expect(out.firstKey).toBe('2026-05-13');
    expect(out.lastKey).toBe('2026-05-15');
    expect(out.animation).toBe(2);
    expect(out.workflow).toBe(2);
    // 13, 14, 15 — three Days, even though 14 had no Sessions
    expect(out.perDay).toHaveLength(3);
  });

  it('returns a zero rollup with null first/last keys when there are no Sessions', () => {
    const out = summarizeAll({});
    expect(out.firstKey).toBeNull();
    expect(out.lastKey).toBeNull();
    expect(out.totalWork).toBe(0);
  });
});

// 2026-05-13 13:30 — a Wednesday in the middle of the work day,
// canonical "now" for summarizeNow tests.
const NOW = new Date(2026, 4, 13, 13, 30, 0);

describe('summarizeNow', () => {
  it('returns the Session containing "now" as active', () => {
    const ss = [
      mk({ id: 'a', startMin: 12 * 60, endMin: 13 * 60 }), // 12:00–13:00 (past)
      mk({ id: 'b', startMin: 13 * 60, endMin: 14 * 60 }), // 13:00–14:00 (active at 13:30)
      mk({ id: 'c', startMin: 14 * 60, endMin: 15 * 60 }), // 14:00–15:00 (future)
    ];
    const out = summarizeNow(ss, NOW);
    expect(out.active?.id).toBe('b');
    expect(out.next?.id).toBe('c');
    expect(out.nowMin).toBe(13 * 60 + 30);
  });

  it('treats endMin as exclusive — a Session ending exactly at "now" is not active', () => {
    const out = summarizeNow([mk({ startMin: 13 * 60, endMin: 13 * 60 + 30 })], NOW);
    expect(out.active).toBeNull();
  });

  it('counts the in-progress active work Session as a fractional hour in elapsed', () => {
    // 13:00–14:00 is active at 13:30 → 0.5h elapsed of in-progress + 0 past = 0.5
    const ss = [mk({ category: 'animation', startMin: 13 * 60, endMin: 14 * 60 })];
    const out = summarizeNow(ss, NOW);
    expect(out.elapsed).toBeCloseTo(0.5);
  });

  it('sums fully-elapsed work Sessions plus the in-progress fractional hour', () => {
    const ss = [
      mk({ category: 'animation', startMin: 12 * 60, endMin: 13 * 60 }), // 1h done
      mk({ category: 'workflow', startMin: 13 * 60, endMin: 14 * 60 }), // active, 0.5h so far
    ];
    const out = summarizeNow(ss, NOW);
    expect(out.elapsed).toBeCloseTo(1.5);
  });

  it('excludes break Sessions from elapsed/planned even when active', () => {
    const ss = [mk({ category: 'break', startMin: 13 * 60, endMin: 14 * 60 })];
    const out = summarizeNow(ss, NOW);
    expect(out.elapsed).toBe(0);
    expect(out.planned).toBe(0);
    // active is still set — break Sessions can be the current Session
    expect(out.active?.category).toBe('break');
  });

  it('reports planned hours as the sum of every work Session today', () => {
    const ss = [
      mk({ category: 'animation', startMin: 8 * 60, endMin: 11 * 60 }), // 3h
      mk({ category: 'cornerman', startMin: 14 * 60, endMin: 17 * 60 }), // 3h
    ];
    const out = summarizeNow(ss, NOW);
    expect(out.planned).toBe(6);
  });
});

describe('expectedHoursByNow', () => {
  // Monday 2026-05-11; "now" is Wednesday 2026-05-13 13:30
  const WEEK_START = new Date(2026, 4, 11);

  it('counts past-ended Sessions of the Category in full', () => {
    const days: Record<string, Session[]> = {
      '2026-05-11': [
        mk({ dateKey: '2026-05-11', category: 'animation', startMin: 8 * 60, endMin: 11 * 60 }), // 3h
      ],
    };
    const expected = expectedHoursByNow(days, 'animation', WEEK_START, NOW, {
      offDays: new Set(),
    });
    expect(expected).toBeCloseTo(3);
  });

  it('counts an in-progress Session partially', () => {
    // 13:00–14:00 active at 13:30 → 0.5h expected so far
    const days: Record<string, Session[]> = {
      '2026-05-13': [mk({ category: 'animation', startMin: 13 * 60, endMin: 14 * 60 })],
    };
    const expected = expectedHoursByNow(days, 'animation', WEEK_START, NOW, {
      offDays: new Set(),
    });
    expect(expected).toBeCloseTo(0.5);
  });

  it('skips Days listed in offDays (they contribute zero)', () => {
    const days: Record<string, Session[]> = {
      '2026-05-11': [
        mk({ dateKey: '2026-05-11', category: 'animation', startMin: 8 * 60, endMin: 11 * 60 }),
      ],
    };
    const expected = expectedHoursByNow(days, 'animation', WEEK_START, NOW, {
      offDays: new Set(['2026-05-11']),
    });
    expect(expected).toBe(0);
  });

  it('does not count Sessions of other Categories', () => {
    const days: Record<string, Session[]> = {
      '2026-05-11': [
        mk({ dateKey: '2026-05-11', category: 'workflow', startMin: 8 * 60, endMin: 11 * 60 }),
      ],
    };
    expect(expectedHoursByNow(days, 'animation', WEEK_START, NOW, { offDays: new Set() })).toBe(0);
  });
});
