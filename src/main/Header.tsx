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
}

export function Header({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  onOpenSettings,
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
        {onOpenSettings && (
          <Button variant="secondary" size="sm" onClick={onOpenSettings} aria-label="Settings">
            Settings
          </Button>
        )}
      </div>
    </header>
  );
}
