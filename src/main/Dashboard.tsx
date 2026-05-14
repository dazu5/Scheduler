// Issue #13 — Dashboard / pace stats bar.
//
// Four cards above the WeekGrid showing per-Category progress for the
// visible week:
//
//   ANIMATION   3.00 / 15h   [BEHIND 2.4H]   ▮▮▯▯▯▯▯▯▯▯
//   WORKFLOW    2.00 / 10h   [ON PACE]       ▮▮▯▯▯▯▯▯▯▯
//   CORNERMAN   6.00 / 36h   [ON PACE]       ▮▯▯▯▯▯▯▯▯▯
//   TOTAL      11.00 / 61h   [CATCHING UP]   ▮▯▯▯▯▯▯▯▯▯
//
// All math comes from the pure modules that landed with #8:
//   - `summarizeLogged()` — actual hours per Category, off-Days skipped
//   - `computePace()`     — pace badge (neutral | on | ahead | behind)
//   - `CATEGORY_INFO[c].target` — the weekly hour target

import { CATEGORY_INFO, WORK_CATEGORIES } from '../shared/categories';
import type { Category, Session } from '../shared/ipc';
import { type PaceStatus, computePace } from '../shared/pace';
import { type OffDayContext, summarizeLogged } from '../shared/summarize';
import { addDays } from '../shared/time';

export interface DashboardProps {
  weekStart: Date;
  sessions: Session[];
  /** dateKey → reason. Off-Days contribute zero to actuals + expected. */
  offDays?: ReadonlyMap<string, string>;
  /** Optional override for "today" — defaults to `new Date()`. */
  now?: Date;
}

const STATUS_BADGE: Record<PaceStatus, string> = {
  neutral: 'bg-fg-muted/15 text-fg-muted',
  on: 'bg-ok/15 text-ok',
  ahead: 'bg-accent/15 text-accent',
  behind: 'bg-danger/15 text-danger',
};

const CATEGORY_DOT: Record<Category, string> = {
  animation: 'bg-cat-animation',
  workflow: 'bg-cat-workflow',
  cornerman: 'bg-cat-cornerman',
  break: 'bg-cat-break',
};

const CATEGORY_BAR: Record<Category, string> = {
  animation: 'bg-cat-animation',
  workflow: 'bg-cat-workflow',
  cornerman: 'bg-cat-cornerman',
  break: 'bg-cat-break',
};

export function Dashboard({ weekStart, sessions, offDays, now = new Date() }: DashboardProps) {
  // Aggregate sessions by dateKey so the pure modules can iterate.
  const days: Record<string, Session[]> = {};
  for (const s of sessions) {
    if (!days[s.dateKey]) days[s.dateKey] = [];
    days[s.dateKey].push(s);
  }

  const ctx: OffDayContext = {
    offDays: new Set(offDays?.keys() ?? []),
  };

  const weekEnd = addDays(weekStart, 6);
  const logged = summarizeLogged(days, weekStart, weekEnd, ctx);
  const sums = {
    animation: logged.animation,
    workflow: logged.workflow,
    cornerman: logged.cornerman,
  };
  const pace = computePace(days, weekStart, now, sums, ctx);

  const totalActual = sums.animation + sums.workflow + sums.cornerman;
  const totalTarget = WORK_CATEGORIES.reduce((sum, c) => sum + CATEGORY_INFO[c].target, 0);
  const totalDelta = totalActual - totalTarget;
  const totalEntry =
    totalActual >= totalTarget
      ? { status: 'on' as const, text: `Hit · +${totalDelta.toFixed(1)}h` }
      : totalDelta > -1
        ? { status: 'on' as const, text: 'On pace' }
        : { status: 'behind' as const, text: `Catching up ${Math.abs(totalDelta).toFixed(1)}h` };

  return (
    <section
      aria-label="Pace dashboard"
      data-testid="dashboard"
      className="grid grid-cols-1 gap-3 md:grid-cols-4"
    >
      {WORK_CATEGORIES.map((cat) => {
        const info = CATEGORY_INFO[cat];
        const actual = sums[cat as keyof typeof sums];
        const entry = pace[cat as keyof typeof pace];
        return (
          <StatCard
            key={cat}
            testid={`stat-${cat}`}
            name={info.short.toUpperCase()}
            actual={actual}
            target={info.target}
            badgeText={entry.text}
            badgeStatus={entry.status}
            dotClass={CATEGORY_DOT[cat]}
            barClass={CATEGORY_BAR[cat]}
            nameColor={`text-cat-${cat}`}
          />
        );
      })}
      <StatCard
        testid="stat-total"
        name="WEEKLY TOTAL"
        actual={totalActual}
        target={totalTarget}
        badgeText={totalEntry.text}
        badgeStatus={totalEntry.status}
        dotClass="bg-accent"
        barClass="bg-accent"
        nameColor="text-accent"
      />
    </section>
  );
}

interface StatCardProps {
  testid: string;
  name: string;
  actual: number;
  target: number;
  badgeText: string;
  badgeStatus: PaceStatus;
  dotClass: string;
  barClass: string;
  nameColor: string;
}

function StatCard({
  testid,
  name,
  actual,
  target,
  badgeText,
  badgeStatus,
  dotClass,
  barClass,
  nameColor,
}: StatCardProps) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return (
    <div
      data-testid={testid}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] ${nameColor}`}
        >
          <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
          {name}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] ${STATUS_BADGE[badgeStatus]}`}
        >
          {badgeText}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[20px] font-bold tabular-nums text-fg leading-none">
          {actual.toFixed(2)}
        </span>
        <span className="text-[11px] tabular-nums text-fg-muted">/ {target}h</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
