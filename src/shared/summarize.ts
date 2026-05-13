// Aggregation primitives — ported from weekly_scheduler.html's
// summarize / summarizeAll / summarizeLogged / dayWorkHours /
// expectedHoursByNow / summarizeNow.
//
// Pure: no DOM, no global state. Off-Days flow in as a `Set` so
// issue #7 (Off-Days) can wire them without changing this module's
// signature. The "logged = done" rule and the in-progress
// fractional hour are encoded here, not in callers.

import type { Category, Session } from './ipc';
import { ALL_CATEGORIES, WORK_CATEGORIES } from './categories';
import { addDays, dateKey, nowMinutes, parseDateKey } from './time';

export interface PerDayHours {
  date: Date;
  key: string;
  animation: number;
  workflow: number;
  cornerman: number;
  break: number;
}

export interface SummaryTotals {
  animation: number;
  workflow: number;
  cornerman: number;
  break: number;
  perDay: PerDayHours[];
  /** Sum of `WORK_CATEGORIES` totals — break excluded. */
  totalWork: number;
}

/** Per-Category hour totals across `[startDate, endDate]` (inclusive
 *  on both ends, by Day). `days` maps each `YYYY-MM-DD` key to its
 *  Sessions; missing keys count as empty Days. */
export function summarize(
  days: Record<string, Session[]>,
  startDate: Date,
  endDate: Date,
): SummaryTotals {
  const out: SummaryTotals = {
    animation: 0,
    workflow: 0,
    cornerman: 0,
    break: 0,
    perDay: [],
    totalWork: 0,
  };
  let d = new Date(startDate);
  while (d <= endDate) {
    const k = dateKey(d);
    const sessions = days[k] || [];
    const day: Record<Category, number> = { animation: 0, workflow: 0, cornerman: 0, break: 0 };
    for (const s of sessions) {
      day[s.category] = (day[s.category] || 0) + (s.endMin - s.startMin) / 60;
    }
    for (const c of ALL_CATEGORIES) {
      out[c] += day[c];
    }
    out.perDay.push({ date: new Date(d), key: k, ...day });
    d = addDays(d, 1);
  }
  out.totalWork = WORK_CATEGORIES.reduce((sum, c) => sum + out[c], 0);
  return out;
}

/** `summarize` widened to span every Day that has at least one
 *  Session. `firstKey` / `lastKey` are null when `days` is empty. */
export interface SummaryAllTotals extends SummaryTotals {
  firstKey: string | null;
  lastKey: string | null;
}

/** Discover the first/last Day with any Sessions in `days` and
 *  rollup across that span. Empty `days` returns a zero rollup
 *  with null first/last keys. */
export function summarizeAll(days: Record<string, Session[]>): SummaryAllTotals {
  const keys = Object.keys(days)
    .filter((k) => days[k] && days[k].length > 0)
    .sort();
  if (keys.length === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { ...summarize({}, today, today), firstKey: null, lastKey: null };
  }
  const first = parseDateKey(keys[0]);
  const last = parseDateKey(keys[keys.length - 1]);
  return { ...summarize(days, first, last), firstKey: keys[0], lastKey: keys[keys.length - 1] };
}

/** Caller-supplied off-Day context — issue #7 will plug in the
 *  SQLite-backed set; today the call site passes `new Set()`. */
export interface OffDayContext {
  offDays: ReadonlySet<string>;
}

/** A Session counts as "logged" only when it's ticked done.
 *  Past planned Sessions you didn't tick won't auto-fill — pace
 *  still uses planned hours as "expected by now" elsewhere. */
function isLoggedSession(s: Session): boolean {
  return s.done === true;
}

/** Same shape as `summarize`, but only counts done Sessions and
 *  skips Days listed in `offDays` (they contribute zero). */
export function summarizeLogged(
  days: Record<string, Session[]>,
  startDate: Date,
  endDate: Date,
  ctx: OffDayContext,
): SummaryTotals {
  const filtered: Record<string, Session[]> = {};
  let d = new Date(startDate);
  while (d <= endDate) {
    const k = dateKey(d);
    if (ctx.offDays.has(k)) {
      filtered[k] = [];
    } else {
      filtered[k] = (days[k] || []).filter(isLoggedSession);
    }
    d = addDays(d, 1);
  }
  return summarize(filtered, startDate, endDate);
}

/** How many hours of `cat` SHOULD have been done by `now` given the
 *  user's actual planned Sessions this week (not the weekly
 *  template). Past-ended Sessions count fully; in-progress Sessions
 *  count partially. Off-Days contribute zero. */
export function expectedHoursByNow(
  days: Record<string, Session[]>,
  cat: Category,
  weekStart: Date,
  now: Date,
  ctx: OffDayContext,
): number {
  let expected = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const k = dateKey(d);
    if (ctx.offDays.has(k)) continue;
    const dayDate = new Date(d);
    const list = (days[k] || []).filter((s) => s.category === cat);
    for (const s of list) {
      const start = new Date(dayDate);
      start.setHours(Math.floor(s.startMin / 60), s.startMin % 60, 0, 0);
      const end = new Date(dayDate);
      end.setHours(Math.floor(s.endMin / 60), s.endMin % 60, 0, 0);
      if (end <= now) {
        expected += (s.endMin - s.startMin) / 60;
      } else if (start < now) {
        expected += (now.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    }
  }
  return expected;
}

/** Snapshot of "what is happening right now and next today",
 *  consumed by the Now Panel and emitted by the Rust 1 Hz tick.
 *  `elapsed` includes the in-progress active Session's fractional
 *  hour. */
export interface NowSummary {
  active: Session | null;
  next: Session | null;
  nowMin: number;
  /** Hours of work elapsed today including the in-progress fraction. */
  elapsed: number;
  /** Total planned work hours today (work Categories only). */
  planned: number;
  /** Hours of work marked done today. */
  doneHours: number;
  firstStart: number | null;
  lastEnd: number | null;
}

/** "What is happening right now and next today" — pure. `sessions`
 *  should be just today's Sessions. */
export function summarizeNow(sessions: Session[], now: Date): NowSummary {
  const sorted = sessions.slice().sort((a, b) => a.startMin - b.startMin);
  const m = nowMinutes(now);
  const active = sorted.find((s) => s.startMin <= m && m < s.endMin) ?? null;
  const next = sorted.find((s) => s.startMin > m) ?? null;
  const work = sorted.filter((s) => WORK_CATEGORIES.includes(s.category));
  const elapsed = work
    .filter((s) => s.endMin <= m)
    .reduce((sum, s) => sum + (s.endMin - s.startMin) / 60, 0);
  const inProgress =
    active && WORK_CATEGORIES.includes(active.category) ? (m - active.startMin) / 60 : 0;
  const planned = work.reduce((sum, s) => sum + (s.endMin - s.startMin) / 60, 0);
  const doneHours = work
    .filter((s) => s.done)
    .reduce((sum, s) => sum + (s.endMin - s.startMin) / 60, 0);
  return {
    active,
    next,
    nowMin: m,
    elapsed: elapsed + inProgress,
    planned,
    doneHours,
    firstStart: sorted[0]?.startMin ?? null,
    lastEnd: sorted[sorted.length - 1]?.endMin ?? null,
  };
}

/** Hours spent on work Categories on a given day's Sessions. Break
 *  Category time is excluded. */
export function dayWorkHours(sessions: Session[]): number {
  return sessions.reduce(
    (acc, s) =>
      WORK_CATEGORIES.includes(s.category) ? acc + (s.endMin - s.startMin) / 60 : acc,
    0,
  );
}
