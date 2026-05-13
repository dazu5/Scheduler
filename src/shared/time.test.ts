// Tests for the `time` pure module. One describe block per function;
// behaviour assertions only (input → output, not how the result is
// produced). Functions land incrementally per slice #3's TDD plan,
// but the simpler direct-port helpers (mmToInput, inputToMm, dateKey,
// addDays, …) are batched into one turn to avoid ceremony — each
// still has its own focused test driving its existence.

import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKey,
  formatDuration,
  formatTime,
  getMondayOf,
  inputToMm,
  mmToInput,
  nowMinutes,
  parseDateKey,
  readEditTimes,
  snapMin,
} from './time';

describe('snapMin', () => {
  it('rounds minutes to the nearest 15-minute boundary', () => {
    expect(snapMin(0)).toBe(0);
    expect(snapMin(7)).toBe(0); // rounds down
    expect(snapMin(8)).toBe(15); // rounds up
    expect(snapMin(15)).toBe(15);
    expect(snapMin(22)).toBe(15);
    expect(snapMin(23)).toBe(30);
    expect(snapMin(360)).toBe(360); // 6:00 AM exact
    expect(snapMin(367)).toBe(360); // 6:07 → 6:00
    expect(snapMin(368)).toBe(375); // 6:08 → 6:15
  });
});

describe('mmToInput / inputToMm', () => {
  it('round-trips minutes-since-midnight to HH:MM 24-hour string', () => {
    expect(mmToInput(0)).toBe('00:00');
    expect(mmToInput(60)).toBe('01:00');
    expect(mmToInput(360)).toBe('06:00');
    expect(mmToInput(750)).toBe('12:30');
    expect(mmToInput(1439)).toBe('23:59');
    expect(mmToInput(1440)).toBe('24:00');

    expect(inputToMm('00:00')).toBe(0);
    expect(inputToMm('06:00')).toBe(360);
    expect(inputToMm('12:30')).toBe(750);
    expect(inputToMm('23:59')).toBe(1439);
  });

  it('inputToMm returns NaN for empty / nullish input', () => {
    expect(inputToMm('')).toBeNaN();
    expect(inputToMm(null)).toBeNaN();
    expect(inputToMm(undefined)).toBeNaN();
  });
});

describe('dateKey / parseDateKey', () => {
  it('round-trips Date to YYYY-MM-DD string in local time', () => {
    expect(dateKey(new Date(2025, 0, 15))).toBe('2025-01-15');
    expect(dateKey(new Date(2024, 11, 31))).toBe('2024-12-31');
    expect(dateKey(new Date(2026, 4, 13))).toBe('2026-05-13');

    const back = parseDateKey('2025-01-15');
    expect(back.getFullYear()).toBe(2025);
    expect(back.getMonth()).toBe(0); // January
    expect(back.getDate()).toBe(15);
  });
});

describe('addDays', () => {
  it('adds (or subtracts) days without mutating the input', () => {
    const start = new Date(2025, 0, 15);
    const plus3 = addDays(start, 3);
    expect(plus3.getDate()).toBe(18);
    expect(plus3.getMonth()).toBe(0);
    expect(start.getDate()).toBe(15); // not mutated

    const minus20 = addDays(start, -20);
    expect(minus20.getMonth()).toBe(11); // December previous year
    expect(minus20.getDate()).toBe(26);
    expect(minus20.getFullYear()).toBe(2024);
  });
});

describe('getMondayOf', () => {
  it('returns the Monday of the same week (Monday-anchored)', () => {
    // Wednesday Jan 15 2025 → Monday Jan 13 2025
    expect(dateKey(getMondayOf(new Date(2025, 0, 15)))).toBe('2025-01-13');
    // Monday Jan 13 2025 → no shift
    expect(dateKey(getMondayOf(new Date(2025, 0, 13)))).toBe('2025-01-13');
    // Sunday Jan 19 2025 → previous Monday Jan 13 (Sunday is end-of-week)
    expect(dateKey(getMondayOf(new Date(2025, 0, 19)))).toBe('2025-01-13');
  });

  it('normalises the returned Date to local midnight', () => {
    const result = getMondayOf(new Date(2025, 0, 15, 14, 30, 12));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('nowMinutes', () => {
  it('returns the time-of-day in minutes for a given Date', () => {
    expect(nowMinutes(new Date(2025, 0, 15, 9, 30))).toBe(9 * 60 + 30);
    expect(nowMinutes(new Date(2025, 0, 15, 0, 0))).toBe(0);
    expect(nowMinutes(new Date(2025, 0, 15, 23, 59))).toBe(23 * 60 + 59);
  });
});

describe('formatTime', () => {
  it('renders minutes-since-midnight as H:MM AM/PM', () => {
    expect(formatTime(0)).toBe('12:00 AM'); // midnight
    expect(formatTime(60)).toBe('1:00 AM');
    expect(formatTime(360)).toBe('6:00 AM');
    expect(formatTime(720)).toBe('12:00 PM'); // noon
    expect(formatTime(780)).toBe('1:00 PM');
    expect(formatTime(1380)).toBe('11:00 PM');
    // Fix from HTML predecessor: 1440 = next-day midnight = 12:00 AM (not PM).
    // HTML never reached 1440 because session ends capped at 23:59; the
    // 2026-05-13 overnight-split fix made it reachable.
    expect(formatTime(1440)).toBe('12:00 AM');
  });

  it('clamps out-of-range values to [0, 24h]', () => {
    expect(formatTime(-30)).toBe('12:00 AM');
    expect(formatTime(2000)).toBe('12:00 AM'); // clamped to 1440
  });
});

describe('formatDuration', () => {
  it('renders minutes as a human-friendly duration', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(-5)).toBe('0 min');
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(59)).toBe('59 min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(125)).toBe('2h 5m');
    expect(formatDuration(180)).toBe('3h');
  });
});

describe('readEditTimes', () => {
  it('parses a same-day range with valid start/end', () => {
    expect(readEditTimes('09:00', '11:00')).toEqual({
      startMin: 540,
      endMin: 660,
      overnightEnd: null,
      zeroLength: false,
    });
  });

  it('detects an overnight wrap when end is before start', () => {
    // 6 PM → 1 AM (next day)
    expect(readEditTimes('18:00', '01:00')).toEqual({
      startMin: 1080,
      endMin: 1440,
      overnightEnd: 60,
      zeroLength: false,
    });
  });

  it('treats 00:00 with a positive start as the midnight shorthand', () => {
    // 6 PM → midnight, same day, no spill onto next day
    expect(readEditTimes('18:00', '00:00')).toEqual({
      startMin: 1080,
      endMin: 1440,
      overnightEnd: null,
      zeroLength: false,
    });
  });

  it('flags zero-length ranges (start === end, no overnight intent)', () => {
    expect(readEditTimes('09:00', '09:00')).toEqual({
      startMin: 540,
      endMin: 540,
      overnightEnd: null,
      zeroLength: true,
    });
  });

  it('returns null for invalid input', () => {
    expect(readEditTimes('', '12:00')).toBeNull();
    expect(readEditTimes('09:00', '')).toBeNull();
  });

  it('snaps inputs to 15-minute boundaries before processing', () => {
    const result = readEditTimes('09:07', '11:23');
    expect(result?.startMin).toBe(540); // 09:07 → 09:00
    expect(result?.endMin).toBe(690); // 11:23 → 11:30
  });
});
