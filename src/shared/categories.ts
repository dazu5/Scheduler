// Category catalog + weekly template — ported from
// weekly_scheduler.html (`CATEGORY_INFO` / `WORK_CATEGORIES` /
// `ALL_CATEGORIES` / `TEMPLATES` / `templateForDow` /
// `activeDaysForCategory`). Single source of truth for the four
// Categories' weekly targets and the canonical weekly schedule
// used by pace math.

import type { Category } from './ipc';

/** Per-Category metadata. `target` is the weekly hours goal used by
 *  computePace; break has target=0 so it stays neutral on the
 *  dashboard. */
export interface CategoryInfo {
  label: string;
  short: string;
  pill: string;
  /** Weekly hours target. 0 = no pace expectation (used by `break`). */
  target: number;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  animation: { label: 'LR · AI Animation', short: 'Animation', pill: 'ANIM', target: 15 },
  workflow: { label: 'LR · AI Workflow', short: 'Workflow', pill: 'WF', target: 10 },
  cornerman: { label: 'Cornerman', short: 'Cornerman', pill: 'CM', target: 36 },
  break: { label: 'Break', short: 'Break', pill: 'BREAK', target: 0 },
};

/** Categories that count toward pace and "logged hours" totals. */
export const WORK_CATEGORIES: readonly Category[] = ['animation', 'workflow', 'cornerman'];

/** Every Category, in display order. */
export const ALL_CATEGORIES: readonly Category[] = ['animation', 'workflow', 'cornerman', 'break'];

/** A scheduled slice in the weekly template — used to derive
 *  per-Category "active days" counts for pace math. */
export interface TemplateEntry {
  category: Category;
  label: string;
  startMin: number;
  endMin: number;
}

/** The canonical weekly schedule. Same content as
 *  weekly_scheduler.html's TEMPLATES — Sunday is intentionally
 *  empty (rest day). */
export const TEMPLATES: {
  weekday: readonly TemplateEntry[];
  saturday: readonly TemplateEntry[];
  sunday: readonly TemplateEntry[];
} = {
  weekday: [
    { category: 'animation', label: 'LR · AI Animation', startMin: 8 * 60, endMin: 11 * 60 },
    { category: 'break', label: 'Short break', startMin: 11 * 60, endMin: 11 * 60 + 15 },
    {
      category: 'workflow',
      label: 'LR · AI Workflow',
      startMin: 11 * 60 + 15,
      endMin: 13 * 60 + 15,
    },
    { category: 'break', label: 'Lunch', startMin: 13 * 60 + 15, endMin: 14 * 60 + 15 },
    {
      category: 'cornerman',
      label: 'Cornerman · Labeling',
      startMin: 14 * 60 + 15,
      endMin: 17 * 60 + 15,
    },
    { category: 'break', label: 'Short break', startMin: 17 * 60 + 15, endMin: 17 * 60 + 30 },
    {
      category: 'cornerman',
      label: 'Cornerman · Labeling',
      startMin: 17 * 60 + 30,
      endMin: 20 * 60 + 30,
    },
  ],
  saturday: [
    { category: 'cornerman', label: 'Cornerman · Labeling', startMin: 8 * 60, endMin: 11 * 60 },
    { category: 'break', label: 'Break', startMin: 11 * 60, endMin: 11 * 60 + 30 },
    {
      category: 'cornerman',
      label: 'Cornerman · Labeling',
      startMin: 11 * 60 + 30,
      endMin: 14 * 60 + 30,
    },
  ],
  sunday: [],
};

/** dow: 0=Sun, 1=Mon..., 6=Sat. */
export function templateForDow(dow: number): readonly TemplateEntry[] {
  if (dow === 0) return TEMPLATES.sunday;
  if (dow === 6) return TEMPLATES.saturday;
  return TEMPLATES.weekday;
}

/** How many days in a typical week have any Session of this
 *  Category. Used for pace math. Floored at 1 so a Category with
 *  no template presence still avoids divide-by-zero. */
export function activeDaysForCategory(cat: Category): number {
  let count = 0;
  for (let dow = 0; dow < 7; dow++) {
    if (templateForDow(dow).some((s) => s.category === cat)) count++;
  }
  return Math.max(count, 1);
}
