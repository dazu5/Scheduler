// Pace math — ported from weekly_scheduler.html's
// `computePace` / `weekHasStarted` / `activeDaysForCategory`.
//
// computePace decides what badge to show next to each Category on
// the dashboard. weekHasStarted is the engagement gate that keeps
// the dashboard neutral until the user actually starts working a
// week. activeDaysForCategory lives in `categories.ts` because it
// only reads the static weekly template.

import { CATEGORY_INFO, WORK_CATEGORIES } from './categories';
import type { Category, Session } from './ipc';
import { type OffDayContext, expectedHoursByNow } from './summarize';
import { addDays, dateKey, getMondayOf } from './time';

export { activeDaysForCategory } from './categories';

export type PaceStatus = 'neutral' | 'on' | 'ahead' | 'behind';

export interface PaceEntry {
  status: PaceStatus;
  text: string;
  /** Expected-by-now hours when comparing against the current
   *  week's planned schedule. Absent on neutral / past / future
   *  branches. */
  expected?: number;
}

/** Per-Category pace badge for the work Categories.
 *  `sums[category]` is the actual logged hours so far this Week
 *  (typically `summarizeLogged` totals). */
export interface PaceResult {
  animation: PaceEntry;
  workflow: PaceEntry;
  cornerman: PaceEntry;
}

/** Compute pace badges for each work Category.
 *
 * Past Week → final vs target ("Hit · +Xh" / "Short Xh").
 * Future Week → "Planning ahead".
 * Current Week + nothing done yet → "Not started yet" (neutral).
 * Current Week + started → compare actual vs expectedHoursByNow
 *   with a ±1h on-pace threshold.
 */
export function computePace(
  days: Record<string, Session[]>,
  weekStart: Date,
  today: Date,
  sums: Record<Category, number> | { animation: number; workflow: number; cornerman: number },
  ctx: OffDayContext,
): PaceResult {
  const thisMonday = getMondayOf(today);
  const started = weekHasStarted(days, weekStart, ctx);
  const result: Partial<Record<Category, PaceEntry>> = {};

  for (const cat of WORK_CATEGORIES) {
    const info = CATEGORY_INFO[cat];
    const actual = sums[cat as keyof typeof sums] ?? 0;

    if (info.target === 0) {
      result[cat] = { status: 'neutral', text: '—' };
      continue;
    }
    if (weekStart > thisMonday) {
      result[cat] = { status: 'neutral', text: 'Planning ahead' };
      continue;
    }
    if (weekStart < thisMonday) {
      const delta = actual - info.target;
      if (actual >= info.target) {
        result[cat] = { status: 'on', text: `Hit · +${delta.toFixed(1)}h` };
      } else {
        result[cat] = { status: 'behind', text: `Short ${Math.abs(delta).toFixed(1)}h` };
      }
      continue;
    }
    // Current week.
    if (!started) {
      result[cat] = { status: 'neutral', text: 'Not started yet' };
      continue;
    }
    const expected = expectedHoursByNow(days, cat, weekStart, today, ctx);
    const delta = actual - expected;
    let status: PaceStatus;
    let text: string;
    if (Math.abs(delta) <= 1) {
      status = 'on';
      text = 'On pace';
    } else if (delta > 0) {
      status = 'ahead';
      text = `Ahead ${delta.toFixed(1)}h`;
    } else {
      status = 'behind';
      text = `Behind ${Math.abs(delta).toFixed(1)}h`;
    }
    result[cat] = { status, text, expected };
  }

  return result as PaceResult;
}

/** Has the user engaged with this Week yet? Pace is meaningless
 *  when the Week is still untouched template — we'd be nagging
 *  about Sessions the user never planned to work. Marking a Day
 *  off also counts as engagement (the user has actively shaped
 *  the Week). */
export function weekHasStarted(
  days: Record<string, Session[]>,
  weekStart: Date,
  ctx: OffDayContext,
): boolean {
  for (let i = 0; i < 7; i++) {
    const k = dateKey(addDays(weekStart, i));
    if (ctx.offDays.has(k)) return true;
    if ((days[k] || []).some((s) => s.done)) return true;
  }
  return false;
}
