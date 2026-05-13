// Tests for the `pace` pure module — ported behaviour from
// weekly_scheduler.html's computePace / weekHasStarted /
// activeDaysForCategory.
//
// computePace decides what badge to show next to each Category on
// the dashboard: "On pace", "Ahead 2.0h", "Behind 1.0h", "Not
// started yet", "Planning ahead", or final tally for a past week.
// weekHasStarted is the engagement gate — until it returns true,
// pace stays neutral so an untouched week doesn't nag.

import { describe, expect, it } from 'vitest';
import type { Session } from './ipc';
import { computePace, weekHasStarted } from './pace';

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

// Monday 2026-05-11
const WEEK_START = new Date(2026, 4, 11);

describe('weekHasStarted', () => {
  it('returns false when no Session in the week is done and no Day is off', () => {
    const days = {
      '2026-05-11': [mk({ dateKey: '2026-05-11' })],
    };
    expect(weekHasStarted(days, WEEK_START, { offDays: new Set() })).toBe(false);
  });

  it('returns true when any Session in the week is marked done', () => {
    const days = {
      '2026-05-13': [mk({ done: true })],
    };
    expect(weekHasStarted(days, WEEK_START, { offDays: new Set() })).toBe(true);
  });

  it('returns true when any Day in the week is marked off', () => {
    expect(weekHasStarted({}, WEEK_START, { offDays: new Set(['2026-05-13']) })).toBe(true);
  });

  it('only inspects the 7 Days starting at weekStart — Sessions outside do not flip the gate', () => {
    const days = {
      '2026-05-18': [mk({ dateKey: '2026-05-18', done: true })], // next Monday
    };
    expect(weekHasStarted(days, WEEK_START, { offDays: new Set() })).toBe(false);
  });
});

describe('computePace — current week', () => {
  // weekStart, today, and now all live in the same week so the
  // "current week" branch is the one under test.
  const TODAY = new Date(2026, 4, 13, 13, 30); // Wed 13:30
  const offDays = new Set<string>();

  it('reads "Not started yet" for every work Category until weekHasStarted is true', () => {
    // No done Sessions, no off-Days → not started.
    const result = computePace(
      {},
      WEEK_START,
      TODAY,
      { animation: 0, workflow: 0, cornerman: 0 },
      { offDays },
    );
    expect(result.animation.status).toBe('neutral');
    expect(result.animation.text).toMatch(/not started yet/i);
    expect(result.workflow.text).toMatch(/not started yet/i);
    expect(result.cornerman.text).toMatch(/not started yet/i);
  });

  it('reads "On pace" when |actual − expected| ≤ 1h after engagement', () => {
    // Engagement: one done Session.
    // Planned: animation 13:00–14:00 active at 13:30 → 0.5h expected so far.
    const days = {
      '2026-05-11': [
        mk({
          dateKey: '2026-05-11',
          category: 'animation',
          startMin: 8 * 60,
          endMin: 10 * 60,
          done: true,
        }),
      ],
      '2026-05-13': [mk({ category: 'animation', startMin: 13 * 60, endMin: 14 * 60 })],
    };
    // Actual = 2h (Monday done) + 0.5h in-progress not counted in `sums`
    //         (sums comes from summarizeLogged, which doesn't count
    //          in-progress fractions). expected ≈ 2.5h.
    // delta = 2 − 2.5 = −0.5 → on pace.
    const result = computePace(
      days,
      WEEK_START,
      TODAY,
      { animation: 2, workflow: 0, cornerman: 0 },
      { offDays },
    );
    expect(result.animation.status).toBe('on');
    expect(result.animation.text).toBe('On pace');
  });

  it('reads "Ahead Xh" when actual exceeds expected by more than 1h', () => {
    const days = {
      '2026-05-11': [
        mk({
          dateKey: '2026-05-11',
          category: 'animation',
          startMin: 8 * 60,
          endMin: 10 * 60,
          done: true,
        }),
      ],
    };
    // expected ≈ 2h (Mon 8–10 fully past). actual = 5 → ahead 3.0h.
    const result = computePace(
      days,
      WEEK_START,
      TODAY,
      { animation: 5, workflow: 0, cornerman: 0 },
      { offDays },
    );
    expect(result.animation.status).toBe('ahead');
    expect(result.animation.text).toMatch(/ahead 3\.0h/i);
  });

  it('reads "Behind Xh" when actual trails expected by more than 1h', () => {
    const days = {
      '2026-05-11': [
        mk({
          dateKey: '2026-05-11',
          category: 'animation',
          startMin: 8 * 60,
          endMin: 12 * 60,
          done: true,
        }),
      ],
    };
    // expected = 4h (Mon 8–12 fully past). actual = 1 → behind 3.0h.
    const result = computePace(
      days,
      WEEK_START,
      TODAY,
      { animation: 1, workflow: 0, cornerman: 0 },
      { offDays },
    );
    expect(result.animation.status).toBe('behind');
    expect(result.animation.text).toMatch(/behind 3\.0h/i);
  });
});

describe('computePace — past/future weeks', () => {
  const TODAY = new Date(2026, 4, 13, 13, 30); // Wed 13:30

  it('marks a future week as "Planning ahead" without checking engagement', () => {
    const nextWeek = new Date(2026, 4, 18); // next Monday
    const result = computePace(
      {},
      nextWeek,
      TODAY,
      { animation: 0, workflow: 0, cornerman: 0 },
      { offDays: new Set() },
    );
    expect(result.animation.status).toBe('neutral');
    expect(result.animation.text).toMatch(/planning ahead/i);
  });

  it('marks a past week with met target as "Hit · +Xh"', () => {
    const prevWeek = new Date(2026, 4, 4); // previous Monday
    const result = computePace(
      {},
      prevWeek,
      TODAY,
      { animation: 17, workflow: 0, cornerman: 0 },
      { offDays: new Set() },
    );
    expect(result.animation.status).toBe('on');
    expect(result.animation.text).toMatch(/hit/i);
    expect(result.animation.text).toMatch(/\+2\.0h/);
  });

  it('marks a past week with unmet target as "Short Xh"', () => {
    const prevWeek = new Date(2026, 4, 4);
    const result = computePace(
      {},
      prevWeek,
      TODAY,
      { animation: 10, workflow: 0, cornerman: 0 },
      { offDays: new Set() },
    );
    expect(result.animation.status).toBe('behind');
    expect(result.animation.text).toMatch(/short 5\.0h/i);
  });
});

describe('computePace — off-Day handling', () => {
  const TODAY = new Date(2026, 4, 13, 13, 30);

  it('does not count an off-Day toward expectedHoursByNow', () => {
    // Monday 8–12 planned (4h) but Monday is marked off → expected
    // collapses to 0. actual = 0 → delta = 0 → on pace.
    const days = {
      '2026-05-11': [
        mk({ dateKey: '2026-05-11', category: 'animation', startMin: 8 * 60, endMin: 12 * 60 }),
      ],
    };
    const result = computePace(
      days,
      WEEK_START,
      TODAY,
      { animation: 0, workflow: 0, cornerman: 0 },
      { offDays: new Set(['2026-05-11']) },
    );
    expect(result.animation.status).toBe('on');
    expect(result.animation.text).toBe('On pace');
  });
});
