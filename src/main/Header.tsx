// Issue #18 chunk 4 + iteration after side-by-side review with the
// predecessor. Two-row layout matching `weekly_scheduler.html`'s
// `.topbar` + `.actionbar`:
//
//   Row 1 (topbar):
//     left  — "Weekly Work Scheduler" (with accent on "Work Scheduler")
//             + subtitle ("Thursday, May 14, 2026 · click any session…")
//     right — segmented Week / Analytics + ghost CSV / JSON / Import
//             + 🔔 alarm-toggle placeholder + ⊙ pill toggle + Settings
//
//   Row 2 (actionbar):
//     left  — ‹ / week range / › / Today
//     right — Undo / Redo
//
// Keyboard shortcuts (ArrowLeft / ArrowRight / T) are wired the same
// way they were before. The bell is intentionally a placeholder — the
// activity-tracker count chip was removed because it incremented on
// every in-app click (including the user clicking the pill toggle),
// which the user found noisy. Counts still flow through the Rust
// store; surfacing them lands when slice #11's OS-level hook makes the
// number meaningful.

import { addDays } from '../shared/time';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import { Button } from './ui';

const SHORT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const FULL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
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
  onOpenSettings?: () => void;
  onExportCsv?: () => void;
  onExportJson?: () => void;
  onTogglePill?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
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
  onUndo,
  onRedo,
}: HeaderProps) {
  useKeyboardShortcut('ArrowLeft', onPrevWeek);
  useKeyboardShortcut('ArrowRight', onNextWeek);
  useKeyboardShortcut('t', onToday);

  return (
    <header className="flex flex-col gap-3 border-b border-border bg-bg px-5 pt-4 pb-3">
      {/* Row 1 — topbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="m-0 text-[18px] font-bold leading-[1.2] tracking-[-0.015em]">
            Weekly <span className="text-accent">Work Scheduler</span>
          </h1>
          <div className="mt-0.5 text-[11px] tabular-nums text-fg-muted">
            {FULL.format(new Date())} · click any session to edit times or add a note
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <div className="inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
            <button
              type="button"
              data-active="true"
              className="rounded px-3 py-1 text-[12px] font-medium text-fg data-[active=true]:bg-surface-3"
            >
              Week
            </button>
            <button
              type="button"
              disabled
              className="rounded px-3 py-1 text-[12px] font-medium text-fg-muted disabled:cursor-not-allowed"
              title="Analytics view coming with the Reports slice"
            >
              Analytics
            </button>
          </div>
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
          {onOpenSettings && (
            <Button variant="ghost" size="sm" onClick={onOpenSettings} aria-label="Import data">
              Import
            </Button>
          )}
          <button
            type="button"
            className="cursor-not-allowed rounded px-1.5 py-1 text-[14px] text-warn opacity-70"
            title="End-of-session alarm — coming soon"
            aria-label="Alarm toggle"
          >
            🔔
          </button>
          {onTogglePill && (
            <button
              type="button"
              onClick={onTogglePill}
              aria-label="Toggle pill"
              className="rounded px-2 py-1 text-[14px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              ⊙
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — actionbar (week nav + tools) */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevWeek}
            aria-label="Previous week"
            className="rounded px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            ‹
          </button>
          <span
            data-testid="week-range"
            className="min-w-[200px] px-2 text-center text-[13px] font-semibold tabular-nums text-fg"
          >
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            onClick={onNextWeek}
            aria-label="Next week"
            className="rounded px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            ›
          </button>
          <Button variant="ghost" size="sm" onClick={onToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              className="rounded px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              ↶
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              onClick={onRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              className="rounded px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              ↷
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
