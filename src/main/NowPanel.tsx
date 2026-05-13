// Issue #18 chunks 5 + 7 + issue #8 — Now Panel.
//
// Three slots — Active / Next / Today — laid out as one rounded
// bar split by 1px gaps (matches weekly_scheduler.html's
// `.now-strip`). Active gets a larger column (1.4fr) because its
// content is denser.
//
//   Active  — Session whose [startMin, endMin) contains "now"; the
//             status dot pulses red. Reflects the live tick payload
//             so the "duration left" countdown decrements every
//             second.
//   Next    — soonest Session starting after "now" today; blue dot.
//   Today   — total Sessions count + total scheduled hours; green dot.
//
// Live values come in via the `tick` prop — App owns the
// `useTick(sessions)` subscription (one per app, not one per
// surface) and threads the payload down. When `tick` is omitted
// (e.g. unit tests) the component synthesises one from `sessions`
// + `new Date()` so it still renders deterministically.

import type { Session, TimerTick } from '../shared/ipc';
import { dateKey, formatDuration, formatTime } from '../shared/time';
import { CategoryBadge } from './ui';

export interface NowPanelProps {
  sessions: Session[];
  /** Live tick payload — app owns the subscription via useTick so
   *  WeekGrid and NowPanel re-render in the same frame on Session
   *  start/end transitions. Optional so the component renders
   *  deterministically in tests via vi.setSystemTime + a synthesised
   *  TimerTick. */
  tick?: TimerTick;
}

function todayTotals(sessions: Session[], today: string): { count: number; minutes: number } {
  const todays = sessions.filter((s) => s.dateKey === today);
  const minutes = todays.reduce((acc, s) => acc + Math.max(0, s.endMin - s.startMin), 0);
  return { count: todays.length, minutes };
}

function fallbackTick(sessions: Session[]): TimerTick {
  const now = new Date();
  const todayKey = dateKey(now);
  const m = now.getHours() * 60 + now.getMinutes();
  const today = sessions.filter((s) => s.dateKey === todayKey);
  return {
    active: today.find((s) => s.startMin <= m && m < s.endMin) ?? null,
    next: today.filter((s) => s.startMin > m).sort((a, b) => a.startMin - b.startMin)[0] ?? null,
    nowMin: m,
    elapsed: 0,
    planned: 0,
  };
}

export function NowPanel({ sessions, tick }: NowPanelProps) {
  const t = tick ?? fallbackTick(sessions);
  const { active, next, nowMin } = t;

  // Today's totals come from the props (no per-second recompute
  // needed — count + minutes only change when sessions change).
  const today = dateKey(new Date());
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
