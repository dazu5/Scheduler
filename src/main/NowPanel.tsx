// Issue #18 chunk 5 — Now Panel placeholder.
//
// Three cards above the WeekGrid:
//   Active  — the Session whose [startMin, endMin) contains "now"
//   Next    — the soonest Session starting after "now" today
//   Today   — count + total hours of all Sessions on today
//
// The values are computed once at render time. Slice #8 (Now Panel +
// 1 Hz tick) replaces the static `Date.now()` read with a timer-
// driven hook so the values refresh every second.

import type { Session } from '../shared/ipc';
import { dateKey, formatDuration, formatTime, nowMinutes } from '../shared/time';
import { CategoryBadge } from './ui';

export interface NowPanelProps {
  sessions: Session[];
  /** Optional override — slice #8 will pass a tick-driven Date. */
  now?: Date;
}

function getActive(sessions: Session[], today: string, nowMin: number): Session | null {
  return (
    sessions.find((s) => s.dateKey === today && s.startMin <= nowMin && s.endMin > nowMin) ?? null
  );
}

function getNext(sessions: Session[], today: string, nowMin: number): Session | null {
  const upcoming = sessions
    .filter((s) => s.dateKey === today && s.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin);
  return upcoming[0] ?? null;
}

function todayTotals(sessions: Session[], today: string): { count: number; minutes: number } {
  const todays = sessions.filter((s) => s.dateKey === today);
  const minutes = todays.reduce((acc, s) => acc + Math.max(0, s.endMin - s.startMin), 0);
  return { count: todays.length, minutes };
}

export function NowPanel({ sessions, now = new Date() }: NowPanelProps) {
  const today = dateKey(now);
  const nowMin = nowMinutes(now);

  const active = getActive(sessions, today, nowMin);
  const next = getNext(sessions, today, nowMin);
  const totals = todayTotals(sessions, today);

  return (
    <section
      aria-label="Now panel"
      className="grid grid-cols-1 gap-3 md:grid-cols-3"
      data-testid="now-panel"
    >
      <Card label="Active" testid="now-active">
        {active ? (
          <>
            <CategoryBadge category={active.category} />
            <strong className="block truncate text-base text-fg">{active.label}</strong>
            <small className="block text-xs text-fg-muted tabular-nums">
              {formatTime(active.startMin)} → {formatTime(active.endMin)} ·{' '}
              {formatDuration(active.endMin - nowMin)} left
            </small>
          </>
        ) : (
          <Empty>No active Session</Empty>
        )}
      </Card>

      <Card label="Next" testid="now-next">
        {next ? (
          <>
            <CategoryBadge category={next.category} />
            <strong className="block truncate text-base text-fg">{next.label}</strong>
            <small className="block text-xs text-fg-muted tabular-nums">
              starts at {formatTime(next.startMin)} · in {formatDuration(next.startMin - nowMin)}
            </small>
          </>
        ) : (
          <Empty>Nothing else today</Empty>
        )}
      </Card>

      <Card label="Today" testid="now-today">
        <strong className="block text-2xl text-fg tabular-nums">
          {formatDuration(totals.minutes)}
        </strong>
        <small className="block text-xs text-fg-muted">
          {totals.count} {totals.count === 1 ? 'Session' : 'Sessions'} scheduled
        </small>
      </Card>
    </section>
  );
}

function Card({
  label,
  testid,
  children,
}: {
  label: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testid}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-fg-muted">{children}</span>;
}
