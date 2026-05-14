// Issue #18 chunk 4 — app header with week navigation.
//
// Visible affordances: app title, ← / Today / → buttons, and a
// human-readable week date range. Keyboard parity via the shared
// useKeyboardShortcut hook: ArrowLeft / ArrowRight / T fire the
// same actions, suppressed when an input/select/textarea is focused
// or when the SessionEditor modal is open.

import { addDays } from '../shared/time';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import { Button } from './ui';

const SHORT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${SHORT.format(weekStart)} — ${SHORT.format(end)}, ${end.getFullYear()}`;
}

export interface HeaderProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  /** Open the Settings surface. For issue #12 this is just the
   *  import-from-v4 re-entry point; the full Settings panel ships in
   *  a later slice. Optional so tests/stories that don't care can
   *  omit it. */
  onOpenSettings?: () => void;
  /** Issue #13 — CSV export of the visible week. Optional so tests
   *  that don't need the export surface can skip wiring. */
  onExportCsv?: () => void;
  /** Issue #13 — JSON export of the visible week. */
  onExportJson?: () => void;
  /** Issue #9 — toggle the always-on-top pill window. */
  onTogglePill?: () => void;
  /** Issue #11 — today's activity counts (keystrokes + clicks).
   *  Displayed in a tooltip on hover of a 🔔 button. Counts only,
   *  privacy-pinned. */
  activity?: { keystrokes: number; clicks: number };
}

export function Header({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  onOpenSettings,
  onExportCsv,
  onExportJson,
  onTogglePill,
  activity,
}: HeaderProps) {
  useKeyboardShortcut('ArrowLeft', onPrevWeek);
  useKeyboardShortcut('ArrowRight', onNextWeek);
  useKeyboardShortcut('t', onToday);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
      <h1 className="m-0 text-base font-semibold text-fg">Scheduler</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onPrevWeek} aria-label="Previous week">
          ←
        </Button>
        <Button variant="secondary" size="sm" onClick={onToday}>
          Today
        </Button>
        <Button variant="ghost" size="sm" onClick={onNextWeek} aria-label="Next week">
          →
        </Button>
        <span
          data-testid="week-range"
          className="ml-2 text-sm font-medium text-fg-muted tabular-nums"
        >
          {formatWeekRange(weekStart)}
        </span>
        {onExportCsv && (
          <Button variant="ghost" size="sm" onClick={onExportCsv} aria-label="Export CSV">
            CSV
          </Button>
        )}
        {onExportJson && (
          <Button variant="ghost" size="sm" onClick={onExportJson} aria-label="Export JSON">
            JSON
          </Button>
        )}
        {activity && (
          <span
            data-testid="activity-bell"
            title={`Today: ${activity.keystrokes} keystrokes · ${activity.clicks} clicks`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-warn"
          >
            🔔
            <span className="tabular-nums text-fg-muted">
              {activity.keystrokes + activity.clicks}
            </span>
          </span>
        )}
        {onTogglePill && (
          <Button variant="ghost" size="sm" onClick={onTogglePill} aria-label="Toggle pill">
            ⊙
          </Button>
        )}
        {onOpenSettings && (
          <Button variant="secondary" size="sm" onClick={onOpenSettings} aria-label="Settings">
            Settings
          </Button>
        )}
      </div>
    </header>
  );
}
