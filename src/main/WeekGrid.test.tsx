// Behaviour tests for <WeekGrid />. The grid is the user's primary
// surface for placing Sessions onto Days. Slice #2 landed the
// columnheader + rowheader structure; slice #3 chunk C added the
// 7×12 body cells the user clicks to start a New Session; chunk D
// adds the Session-block rendering inside cells.
//
// Tests query by ARIA role (columnheader / rowheader / cell) so the
// underlying markup stays free to evolve. Aria-labels on cells use
// the format `{dateKey} {hour AM/PM}` — a stable, query-friendly
// handle for both screen readers and testing-library.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../shared/ipc';
import { WeekGrid } from './WeekGrid';

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    dateKey: '2025-01-13',
    category: 'animation',
    label: 'sample',
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

describe('<WeekGrid />', () => {
  it('renders 7 day-column headers, MON through SUN in that order', () => {
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} />);
    const headers = screen.getAllByRole('columnheader');
    // Each header stacks the weekday short, the date, and the
    // day-meta line — assert just the leading weekday short here so
    // the test stays robust to the rest of the header content.
    const shorts = headers.map((h) => h.textContent?.trim().slice(0, 3));
    expect(shorts).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  });

  it('renders 12 hour-label rows covering the 8 AM–8 PM working window', () => {
    render(<WeekGrid />);
    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(12);
    expect(rows[0].textContent?.trim()).toBe('8 AM');
    expect(rows[11].textContent?.trim()).toBe('7 PM');
  });

  it('renders 84 hour-bucket buttons (7 days × 12 hours) for click-to-add', () => {
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} />);
    // Each invisible hour bucket carries an aria-label of the form
    // "{dateKey} {hour AM/PM}" — 7 × 12 = 84 of them.
    const buckets = screen
      .getAllByRole('button')
      .filter((b) =>
        /^\d{4}-\d{2}-\d{2} \d{1,2} (AM|PM)$/.test(b.getAttribute('aria-label') ?? ''),
      );
    expect(buckets).toHaveLength(84);
  });

  it('labels each hour bucket with its dateKey + hour for queries', () => {
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} />);
    expect(screen.getByLabelText('2025-01-13 8 AM')).toBeInTheDocument();
    expect(screen.getByLabelText('2025-01-15 1 PM')).toBeInTheDocument();
    expect(screen.getByLabelText('2025-01-19 7 PM')).toBeInTheDocument();
  });

  it('calls onCellClick with (dateKey, hour) when a cell is clicked', () => {
    const handler = vi.fn();
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} onCellClick={handler} />);

    fireEvent.click(screen.getByLabelText('2025-01-15 10 AM'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('2025-01-15', 10);
  });

  it('renders a Session block inside the day column matching its dateKey', () => {
    const sessions = [
      mkSession({ dateKey: '2025-01-13', startMin: 540, label: 'Morning warm-up' }),
    ];
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} sessions={sessions} />);

    const block = screen.getByText('Morning warm-up').closest('[data-testid="session-block"]');
    const dayColumn = block?.parentElement;
    expect(dayColumn).toHaveAttribute('data-day-column', '2025-01-13');

    // No block on a different day
    const otherColumn = document.querySelector('[data-day-column="2025-01-14"]');
    expect(otherColumn?.textContent ?? '').not.toContain('Morning warm-up');
  });

  it('positions each Session block proportional to startMin + duration (top + height)', () => {
    const sessions = [
      mkSession({ id: 'a', dateKey: '2025-01-13', startMin: 540, endMin: 600, label: 'one-hour' }), // 9–10
      mkSession({ id: 'b', dateKey: '2025-01-14', startMin: 540, endMin: 780, label: 'four-hour' }), // 9–1
    ];
    render(<WeekGrid weekStart={new Date(2025, 0, 13)} sessions={sessions} />);

    const oneHour = screen
      .getByText('one-hour')
      .closest('[data-testid="session-block"]') as HTMLElement;
    const fourHour = screen
      .getByText('four-hour')
      .closest('[data-testid="session-block"]') as HTMLElement;

    // 9 AM is one HOUR_PX (80px) below the 8 AM start of the
    // visible window.
    expect(oneHour.style.top).toBe('80px');
    expect(fourHour.style.top).toBe('80px');
    // The 4-hour Session is 4× as tall as the 1-hour Session.
    expect(oneHour.style.height).toBe('80px');
    expect(fourHour.style.height).toBe('320px');
  });

  it('calls onSessionClick (not onCellClick) when a Session block is clicked', () => {
    const onCellClick = vi.fn();
    const onSessionClick = vi.fn();
    const target = mkSession({
      id: 'click-me',
      dateKey: '2025-01-13',
      startMin: 540,
      label: 'Click target',
    });
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[target]}
        onCellClick={onCellClick}
        onSessionClick={onSessionClick}
      />,
    );

    fireEvent.click(screen.getByText('Click target'));

    expect(onSessionClick).toHaveBeenCalledTimes(1);
    expect(onSessionClick).toHaveBeenCalledWith(target);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('fires onToggleDone (not edit / cell) when the done checkbox is clicked', () => {
    const onSessionClick = vi.fn();
    const onToggleDone = vi.fn();
    const onCellClick = vi.fn();
    const target = mkSession({ id: 't1', startMin: 540, label: 'task' });
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[target]}
        onCellClick={onCellClick}
        onSessionClick={onSessionClick}
        onToggleDone={onToggleDone}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mark task done'));

    expect(onToggleDone).toHaveBeenCalledWith(target);
    expect(onSessionClick).not.toHaveBeenCalled();
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('fires onDuplicate (not edit / cell) when the ⎘ button is clicked', () => {
    const onSessionClick = vi.fn();
    const onDuplicate = vi.fn();
    const onCellClick = vi.fn();
    const target = mkSession({ id: 'dup-me', label: 'task' });
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[target]}
        onCellClick={onCellClick}
        onSessionClick={onSessionClick}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.click(screen.getByLabelText('Duplicate task'));

    expect(onDuplicate).toHaveBeenCalledWith(target);
    expect(onSessionClick).not.toHaveBeenCalled();
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('fires onDelete (not edit / cell) when the 🗑 button is clicked', () => {
    const onSessionClick = vi.fn();
    const onDelete = vi.fn();
    const onCellClick = vi.fn();
    const target = mkSession({ id: 'del-me', label: 'task' });
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[target]}
        onCellClick={onCellClick}
        onSessionClick={onSessionClick}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText('Delete task'));

    expect(onDelete).toHaveBeenCalledWith(target);
    expect(onSessionClick).not.toHaveBeenCalled();
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('tags the Session matching activeSessionId with data-active="true"', () => {
    const live = mkSession({ id: 'live-one', label: 'now playing' });
    const other = mkSession({ id: 'other', label: 'idle', startMin: 720, endMin: 780 });
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[live, other]}
        activeSessionId="live-one"
      />,
    );

    const blocks = screen.getAllByTestId('session-block');
    const liveBlock = blocks.find((b) => b.textContent?.includes('now playing'));
    const otherBlock = blocks.find((b) => b.textContent?.includes('idle'));
    expect(liveBlock).toHaveAttribute('data-active', 'true');
    expect(otherBlock).not.toHaveAttribute('data-active');
  });

  it('omits data-active when no activeSessionId is provided', () => {
    render(
      <WeekGrid
        weekStart={new Date(2025, 0, 13)}
        sessions={[mkSession({ id: 'one', label: 'nothing live' })]}
      />,
    );
    expect(screen.getByTestId('session-block')).not.toHaveAttribute('data-active');
  });
});
