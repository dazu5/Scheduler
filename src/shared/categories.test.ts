// Tests for the categories catalog — single source of truth for the
// Category palette, weekly targets, and the weekly template used by
// pace math. Ported from weekly_scheduler.html's CATEGORY_INFO /
// TEMPLATES / activeDaysForCategory.
//
// activeDaysForCategory is exercised against the live TEMPLATES
// constant (not a fixture) so it serves as a regression check that
// the canonical template matches what pace expects.

import { describe, expect, it } from 'vitest';
import {
  ALL_CATEGORIES,
  CATEGORY_INFO,
  TEMPLATES,
  WORK_CATEGORIES,
  activeDaysForCategory,
  templateForDow,
} from './categories';

describe('CATEGORY_INFO', () => {
  it('lists every Category with a weekly target', () => {
    expect(CATEGORY_INFO.animation.target).toBe(15);
    expect(CATEGORY_INFO.workflow.target).toBe(10);
    expect(CATEGORY_INFO.cornerman.target).toBe(36);
    expect(CATEGORY_INFO.break.target).toBe(0);
  });
});

describe('WORK_CATEGORIES / ALL_CATEGORIES', () => {
  it('separates work Categories from break', () => {
    expect(WORK_CATEGORIES).toEqual(['animation', 'workflow', 'cornerman']);
    expect(ALL_CATEGORIES).toEqual(['animation', 'workflow', 'cornerman', 'break']);
  });
});

describe('templateForDow', () => {
  it('returns Sunday template for dow=0 (empty)', () => {
    expect(templateForDow(0)).toEqual([]);
  });

  it('returns Saturday template for dow=6', () => {
    expect(templateForDow(6)).toBe(TEMPLATES.saturday);
  });

  it('returns weekday template for dow=1..5', () => {
    for (let dow = 1; dow <= 5; dow++) {
      expect(templateForDow(dow)).toBe(TEMPLATES.weekday);
    }
  });
});

describe('activeDaysForCategory', () => {
  it('counts how many weekdays-of-the-week have any Session of that Category', () => {
    // animation is on weekdays only (5 days)
    expect(activeDaysForCategory('animation')).toBe(5);
  });

  it('counts cornerman on both weekdays and Saturday (6 days)', () => {
    expect(activeDaysForCategory('cornerman')).toBe(6);
  });

  it('returns at least 1 for a Category absent from every template', () => {
    // No Category currently absent in TEMPLATES, so we exercise the
    // floor via a synthetic Category: TS isn't enforcing the param
    // here since the input is a string under the hood.
    expect(activeDaysForCategory('nonexistent' as 'animation')).toBe(1);
  });
});
