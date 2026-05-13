import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Session } from '../shared/ipc';
import { NowPanel } from './NowPanel';

// 2026-05-13 13:30 — a Wednesday in the middle of the work day,
// useful as the canonical "now" for these tests.
const NOW = new Date(2026, 4, 13, 13, 30, 0);
const TODAY = '2026-05-13';

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's',
  dateKey: TODAY,
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
});

describe('<NowPanel />', () => {
  it('renders three cards: Active, Next, Today', () => {
    render(<NowPanel sessions={[]} now={NOW} />);
    expect(screen.getByTestId('now-active')).toBeInTheDocument();
    expect(screen.getByTestId('now-next')).toBeInTheDocument();
    expect(screen.getByTestId('now-today')).toBeInTheDocument();
  });

  it('shows the empty Active state when nothing is currently running', () => {
    render(<NowPanel sessions={[]} now={NOW} />);
    expect(screen.getByTestId('now-active')).toHaveTextContent(/no active session/i);
  });

  it("flags the Session containing 'now' as Active", () => {
    // 13:30 is 810 minutes; this Session covers 13:00–14:00 (780–840).
    render(
      <NowPanel
        sessions={[session({ id: 'live', label: 'Live one', startMin: 780, endMin: 840 })]}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('now-active')).toHaveTextContent('Live one');
  });

  it('treats endMin as exclusive — a Session ending exactly at "now" is not Active', () => {
    render(
      <NowPanel
        sessions={[session({ id: 'past', label: 'just ended', startMin: 720, endMin: 810 })]}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('now-active')).toHaveTextContent(/no active session/i);
  });

  it('shows the soonest upcoming Session as Next', () => {
    render(
      <NowPanel
        sessions={[
          session({ id: 'later', label: 'late', startMin: 1080 }),
          session({ id: 'sooner', label: 'sooner', startMin: 900 }),
        ]}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('now-next')).toHaveTextContent('sooner');
  });

  it('shows empty Next when nothing is scheduled later today', () => {
    render(<NowPanel sessions={[session({ startMin: 600, endMin: 660 })]} now={NOW} />);
    expect(screen.getByTestId('now-next')).toHaveTextContent(/nothing else today/i);
  });

  it("computes Today's session count + total hours from sessions on today's dateKey only", () => {
    render(
      <NowPanel
        sessions={[
          session({ id: 'a', startMin: 540, endMin: 600 }), // 60 min
          session({ id: 'b', startMin: 600, endMin: 720 }), // 120 min
          session({ id: 'c', dateKey: '2026-05-14', startMin: 540, endMin: 600 }), // tomorrow
        ]}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('now-today')).toHaveTextContent('2 Sessions scheduled');
    expect(screen.getByTestId('now-today')).toHaveTextContent('3h'); // 180 min
  });

  it('pluralises "Session" correctly for a single entry', () => {
    render(<NowPanel sessions={[session()]} now={NOW} />);
    expect(screen.getByTestId('now-today')).toHaveTextContent('1 Session scheduled');
  });
});
