// The week-grid surface. Slice #2 landed the column / hour-row
// structure; slice #3 chunk C added the clickable body cells;
// chunk D renders saved Session blocks inside the cells matching
// each Session's (dateKey, start hour).
//
// Multi-hour Sessions render only in their START cell for v0.1 —
// visual span (CSS-positioned overlay) is a layout problem
// deferred to a later slice once we know what the editor's drag
// interaction wants.

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
  /** Monday-anchored start of the displayed week. Defaults to the
   *  Monday of the current local week. */
  weekStart?: Date;
  /** Sessions to render inside cells; default empty. Each Session
   *  appears in the cell at its (dateKey, start-hour). */
  sessions?: Session[];
  /** Fired when the user clicks an empty body cell. The hour is the
   *  24-hour integer (8..19). */
  onCellClick?: (dateKey: string, hour: number) => void;
}

export function WeekGrid({
  weekStart = getMondayOf(new Date()),
  sessions = [],
  onCellClick,
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
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard add-session flow lands in slice #4 when editor surfaces unify
                <td
                  key={dKey}
                  aria-label={`${dKey} ${hourLabel(h)}`}
                  onClick={() => onCellClick?.(dKey, h)}
                >
                  {inCell.map((s) => (
                    <div key={s.id} data-category={s.category} data-testid="session-block">
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
