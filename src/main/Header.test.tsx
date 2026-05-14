import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

// 2026-05-11 is a Monday — useful canonical week-start for the tests.
const MONDAY = new Date(2026, 4, 11);

function setup(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    weekStart: MONDAY,
    onPrevWeek: vi.fn(),
    onNextWeek: vi.fn(),
    onToday: vi.fn(),
    ...overrides,
  };
  render(<Header {...props} />);
  return props;
}

describe('<Header />', () => {
  it('renders the app title with the colored "Work Scheduler" accent', () => {
    setup();
    expect(screen.getByRole('heading', { name: /weekly work scheduler/i })).toBeInTheDocument();
  });

  it('shows the week date range', () => {
    setup();
    expect(screen.getByTestId('week-range')).toHaveTextContent(/May 11/);
    expect(screen.getByTestId('week-range')).toHaveTextContent(/May 17/);
    expect(screen.getByTestId('week-range')).toHaveTextContent(/2026/);
  });

  it('calls onPrevWeek when the prev-week button is clicked', () => {
    const { onPrevWeek } = setup();
    fireEvent.click(screen.getByRole('button', { name: /previous week/i }));
    expect(onPrevWeek).toHaveBeenCalledTimes(1);
  });

  it('calls onNextWeek when the → button is clicked', () => {
    const { onNextWeek } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onNextWeek).toHaveBeenCalledTimes(1);
  });

  it('calls onToday when the Today button is clicked', () => {
    const { onToday } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('maps ArrowLeft / ArrowRight / T to their nav actions', () => {
    const { onPrevWeek, onNextWeek, onToday } = setup();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 't' });
    expect(onPrevWeek).toHaveBeenCalledTimes(1);
    expect(onNextWeek).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
