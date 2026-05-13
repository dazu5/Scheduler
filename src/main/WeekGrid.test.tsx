// Behaviour tests for <WeekGrid />. The grid is the user's primary
// surface for placing Sessions onto Days. Slice #2 (issue #2) is
// scoped to "empty grid renders" — so this file asserts column
// structure only. Real date labels, Session blocks, click handlers,
// drag-create, and overlap warnings all live in later slices.
//
// The tests query by ARIA role rather than CSS class so that the
// underlying markup can be a <table>, a CSS grid of divs with
// role attributes, or anything else — the user-visible behaviour
// (a 7-column grid with weekday headers) is what matters.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeekGrid } from './WeekGrid';

describe('<WeekGrid />', () => {
  it('renders 7 column headers, Monday through Sunday in that order', () => {
    render(<WeekGrid />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent?.trim())).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('renders 12 hour-label rows covering the 8 AM–8 PM working window', () => {
    // 12 rows because the grid window is [8:00, 20:00) — each row
    // represents one hour starting at its label, so labels run from
    // 8 AM through 7 PM. Matches gridStartH=8 / gridEndH=20 in the
    // weekly_scheduler.html predecessor.
    render(<WeekGrid />);
    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(12);
    expect(rows[0].textContent?.trim()).toBe('8 AM');
    expect(rows[11].textContent?.trim()).toBe('7 PM');
  });
});
