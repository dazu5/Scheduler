// The week-grid surface. Slice #2 landed the column / hour-row
// structure; slice #3 chunk C added the clickable body cells +
// chunk D added saved-Session blocks; slice #4 makes the Session
// blocks themselves clickable so users can open the editor on a
// filled cell. Click events stopPropagation so clicking a block
// doesn't ALSO fire the cell's "add session here" handler.
//
// Multi-hour Sessions render only in their START cell for v0.1 —
// visual span is a layout problem deferred to a later slice.

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
}

export function WeekGrid({
  weekStart = getMondayOf(new Date()),
  sessions = [],
  onCellClick,
  onSessionClick,
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionClick?.(s);
                      }}
                    >
                      {s.label}
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
