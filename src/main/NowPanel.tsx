// Issue #18 chunks 5 + 7 — Now Panel.
//
// Three slots — Active / Next / Today — laid out as one rounded
// bar split by 1px gaps (matches weekly_scheduler.html's
// `.now-strip`). Active gets a larger column (1.4fr) because its
// content is denser.
//
//   Active  — Session whose [startMin, endMin) contains "now"; the
//             status dot pulses red.
//   Next    — soonest Session starting after "now" today; blue dot.
//   Today   — total Sessions count + total scheduled hours; green dot.
//
// Values are computed once at render time. Slice #8 (Now Panel + 1
// Hz tick) replaces the static `new Date()` read with a timer-
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
      data-testid="now-panel"
      className="grid overflow-hidden rounded-lg border border-border bg-border"
      style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gap: '1px' }}
    >
      <Slot
        testid="now-active"
        label="Active"
        dotClass={active ? 'bg-now animate-pulse-dot' : 'bg-fg-muted-2'}
      >
        {active ? (
          <>
            <SlotMain accent="text-now">
              <CategoryBadge category={active.category} />
              <span className="truncate">{active.label}</span>
            </SlotMain>
            <SlotMeta>
              {formatTime(active.startMin)} → {formatTime(active.endMin)} ·{' '}
              {formatDuration(active.endMin - nowMin)} left
            </SlotMeta>
          </>
        ) : (
          <SlotEmpty>No active Session</SlotEmpty>
        )}
      </Slot>

      <Slot testid="now-next" label="Next" dotClass={next ? 'bg-accent' : 'bg-fg-muted-2'}>
        {next ? (
          <>
            <SlotMain>
              <CategoryBadge category={next.category} />
              <span className="truncate">{next.label}</span>
            </SlotMain>
            <SlotMeta>
              starts at {formatTime(next.startMin)} · in {formatDuration(next.startMin - nowMin)}
            </SlotMeta>
          </>
        ) : (
          <SlotEmpty>Nothing else today</SlotEmpty>
        )}
      </Slot>

      <Slot testid="now-today" label="Today" dotClass="bg-ok">
        <SlotMain>
          <span className="tabular-nums">{formatDuration(totals.minutes)}</span>
        </SlotMain>
        <SlotMeta>
          {totals.count} {totals.count === 1 ? 'Session' : 'Sessions'} scheduled
        </SlotMeta>
      </Slot>
    </section>
  );
}

function Slot({
  testid,
  label,
  dotClass,
  children,
}: {
  testid: string;
  label: string;
  dotClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testid}
      className="flex min-h-[60px] items-center gap-3 bg-surface px-3.5 py-2.5"
    >
      <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function SlotMain({
  accent = 'text-fg',
  children,
}: {
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${accent}`}>
      {children}
    </div>
  );
}

function SlotMeta({ children }: { children: React.ReactNode }) {
  return <div className="mt-0.5 text-[11px] tabular-nums text-fg-muted">{children}</div>;
}

function SlotEmpty({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] italic text-fg-muted">{children}</span>;
}
