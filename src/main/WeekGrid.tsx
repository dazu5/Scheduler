// The week-grid surface. Refactored in issue #18 chunk 3 to use
// Tailwind utilities driven by the @theme tokens defined in
// styles.css; the Session block's color comes from the
// `--color-cat-*` palette via a static lookup so Tailwind's JIT
// picks every class up at build time.
//
// Each nested action (done checkbox, duplicate, delete) calls
// stopPropagation so the block's edit-open handler — and the cell's
// add-Session handler — don't both fire on the same click.

import type { Session } from '../shared/ipc';
import { addDays, dateKey, formatTime, getMondayOf } from '../shared/time';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

// Static lookup so Tailwind's JIT scanner sees every concrete class.
// Driving by template literal (`bg-cat-${cat}-bg`) would not work.
// We use the dark `*-bg` fills (not the bright accents) — matches
// the predecessor's Session-block treatment: solid dark tinted
// background with white text on top, brightness-up on hover.
const CATEGORY_BG: Record<Session['category'], string> = {
  animation: 'bg-cat-animation-bg',
  workflow: 'bg-cat-workflow-bg',
  cornerman: 'bg-cat-cornerman-bg',
  break: 'bg-cat-break-bg',
};

function hourLabel(hour24: number): string {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 || 12;
  return `${h12} ${ampm}`;
}

const TH_COL = 'border border-border bg-surface px-3 py-2 text-left font-semibold text-fg';
const TH_ROW =
  'w-20 border border-border bg-surface px-2 py-1.5 text-right font-normal tabular-nums ' +
  'align-top text-fg-muted';
const CELL =
  'border border-border align-top p-1 h-14 cursor-pointer transition-colors ' +
  'hover:bg-white/[0.03]';
const SESSION_BLOCK_BASE =
  'group/session relative flex flex-col gap-0.5 px-2 py-1.5 mb-0.5 rounded-lg text-white ' +
  'cursor-pointer overflow-hidden transition-[filter] hover:brightness-[1.18]';
const INLINE_BTN =
  'rounded bg-black/25 px-1.5 py-0.5 leading-tight text-white hover:bg-black/45 ' +
  'transition-colors';

export interface WeekGridProps {
  weekStart?: Date;
  sessions?: Session[];
  onCellClick?: (dateKey: string, hour: number) => void;
  onSessionClick?: (session: Session) => void;
  onToggleDone?: (session: Session) => void;
  onDuplicate?: (session: Session) => void;
  onDelete?: (session: Session) => void;
}

export function WeekGrid({
  weekStart = getMondayOf(new Date()),
  sessions = [],
  onCellClick,
  onSessionClick,
  onToggleDone,
  onDuplicate,
  onDelete,
}: WeekGridProps = {}) {
  const dateKeys = WEEKDAYS.map((_, i) => dateKey(addDays(weekStart, i)));

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th key={day} scope="col" className={TH_COL}>
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {HOURS.map((h) => (
          <tr key={h}>
            <th scope="row" className={TH_ROW}>
              {hourLabel(h)}
            </th>
            {dateKeys.map((dKey) => {
              const inCell = sessions.filter(
                (s) => s.dateKey === dKey && Math.floor(s.startMin / 60) === h,
              );
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard add-Session flow lands when editor surfaces unify
                <td
                  key={dKey}
                  aria-label={`${dKey} ${hourLabel(h)}`}
                  onClick={() => onCellClick?.(dKey, h)}
                  className={CELL}
                >
                  {inCell.map((s) => (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: edit flow is mouse-driven for v0.1; keyboard-edit via global shortcut comes later
                    <div
                      key={s.id}
                      data-category={s.category}
                      data-testid="session-block"
                      data-done={s.done}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionClick?.(s);
                      }}
                      className={`${SESSION_BLOCK_BASE} ${
                        CATEGORY_BG[s.category] ?? 'bg-cat-break-bg'
                      } ${s.done ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] leading-tight tabular-nums text-white/55">
                            {formatTime(s.startMin)} → {formatTime(s.endMin)}
                          </div>
                          <div
                            className={`truncate text-[11px] font-semibold leading-tight ${
                              s.done ? 'line-through' : ''
                            }`}
                          >
                            {s.label}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/session:opacity-100">
                          <input
                            type="checkbox"
                            aria-label={`Mark ${s.label} done`}
                            checked={s.done}
                            onChange={() => onToggleDone?.(s)}
                            onClick={(e) => e.stopPropagation()}
                            className="m-0 size-3 cursor-pointer accent-white"
                          />
                          <button
                            type="button"
                            aria-label={`Duplicate ${s.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate?.(s);
                            }}
                            className={INLINE_BTN}
                          >
                            ⎘
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${s.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete?.(s);
                            }}
                            className={INLINE_BTN}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
