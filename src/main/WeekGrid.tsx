// The week-grid surface. Slice #5 adds per-Session quick actions
// inside each block — done checkbox, duplicate, delete — alongside
// the slice #4 onSessionClick edit flow. Every nested control
// stopPropagation so clicking it doesn't ALSO fire the block's
// edit-open handler or the cell's add-session handler.

import type { Session } from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';

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

function hourLabel(hour24: number): string {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 || 12;
  return `${h12} ${ampm}`;
}

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
    <table>
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th key={day} scope="col">
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {HOURS.map((h) => (
          <tr key={h}>
            <th scope="row">{hourLabel(h)}</th>
            {dateKeys.map((dKey) => {
              const inCell = sessions.filter(
                (s) => s.dateKey === dKey && Math.floor(s.startMin / 60) === h,
              );
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard add-session flow lands when editor surfaces unify
                <td
                  key={dKey}
                  aria-label={`${dKey} ${hourLabel(h)}`}
                  onClick={() => onCellClick?.(dKey, h)}
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
                    >
                      <input
                        type="checkbox"
                        aria-label={`Mark ${s.label} done`}
                        checked={s.done}
                        onChange={() => onToggleDone?.(s)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>{s.label}</span>
                      <button
                        type="button"
                        aria-label={`Duplicate ${s.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate?.(s);
                        }}
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
                      >
                        🗑
                      </button>
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
