// The week-grid surface — rewritten for the absolutely-positioned
// day-column layout that matches `weekly_scheduler.html`.
//
// Each day is a single column whose body is `position: relative` and
// `HOUR_PX × HOUR_COUNT` tall. Sessions are positioned absolutely
// inside the column with `top` + `height` derived from `startMin`
// and duration, so a 4-hour Session is visibly four times taller
// than a 1-hour one. Hour gridlines are painted with a CSS
// `repeating-linear-gradient` so they don't add DOM nodes.
//
// For accessibility + click-to-add + tests, each hour-bucket inside
// a column has an invisible `<button>` covering its slice — keyed by
// `aria-label="{dateKey} {hour AM/PM}"` so existing tests
// (`getByLabelText('2025-01-13 8 AM')`) keep matching. Sessions sit
// above the buttons with `z-index` and stop click propagation so the
// click-to-add only fires on truly empty space.

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

const START_HOUR = 8;
const END_HOUR = 20; // exclusive; renders 8 AM through 7 PM
const HOUR_COUNT = END_HOUR - START_HOUR;
const HOURS = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
const HOUR_PX = 64; // pixels per hour — keeps a full work-day on-screen

// Static lookup so Tailwind's JIT scanner sees every concrete class
// at build time. We use the dark `*-bg` fills (not the bright
// accents) so white text reads on top — matches the predecessor.
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

/** Convert "minutes from midnight" to a vertical pixel offset within
 *  the day column body. Sessions before START_HOUR clamp to 0;
 *  sessions extending past END_HOUR clamp to the column height. */
function minToPx(min: number): number {
  return Math.max(0, (min - START_HOUR * 60) * (HOUR_PX / 60));
}

/** Sessions extending past the visible window are clipped to the
 *  bottom of the column rather than overflowing into next-day space. */
function clampHeight(top: number, raw: number): number {
  const totalPx = HOUR_COUNT * HOUR_PX;
  return Math.min(raw, totalPx - top);
}

const HOUR_ROW_LABEL = 'h-16 pr-2 text-right text-xs font-medium tabular-nums text-fg-muted';
const DAY_HEADER =
  'sticky top-0 z-10 border-b border-l border-border bg-surface px-3 py-2 ' +
  'text-left text-xs font-semibold uppercase tracking-wider text-fg';
const DAY_HEADER_FIRST = `${DAY_HEADER} border-l-0`;
const DAY_COLUMN_BODY = 'relative border-l border-border';
const HOUR_BUTTON =
  'absolute left-0 right-0 cursor-pointer transition-colors ' +
  'hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.06]';
const SESSION_BLOCK_BASE =
  'group/session absolute left-1 right-1 z-10 flex flex-col gap-0.5 overflow-hidden ' +
  'rounded-lg px-2 py-1.5 text-white cursor-pointer transition-[filter] ' +
  'hover:brightness-[1.18]';
const INLINE_BTN =
  'rounded bg-black/25 px-1.5 py-0.5 leading-tight text-white hover:bg-black/45 ' +
  'transition-colors';
// Hour-line texture painted on the column body so we don't render
// 12 separate divs per day per render pass.
const HOUR_LINES_BG = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(64px - 1px), var(--color-border) calc(64px - 1px), var(--color-border) 64px)',
  backgroundSize: '100% 64px',
  backgroundRepeat: 'repeat-y',
};

export interface WeekGridProps {
  weekStart?: Date;
  sessions?: Session[];
  /** Id of the Session currently containing "now" — drives the red
   *  ring + glow on that block. App owns the tick subscription and
   *  passes the id down so WeekGrid stays a pure render. */
  activeSessionId?: string | null;
  onCellClick?: (dateKey: string, hour: number) => void;
  onSessionClick?: (session: Session) => void;
  onToggleDone?: (session: Session) => void;
  onDuplicate?: (session: Session) => void;
  onDelete?: (session: Session) => void;
}

export function WeekGrid({
  weekStart = getMondayOf(new Date()),
  sessions = [],
  activeSessionId = null,
  onCellClick,
  onSessionClick,
  onToggleDone,
  onDuplicate,
  onDelete,
}: WeekGridProps = {}) {
  const dateKeys = WEEKDAYS.map((_, i) => dateKey(addDays(weekStart, i)));
  const totalHeight = HOUR_COUNT * HOUR_PX;

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}>
      {/* Header row: empty spacer + 7 day names. role="columnheader"
       *  preserves the screen-reader + test affordance the old <th>
       *  scope="col" provided. */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface" />
      {WEEKDAYS.map((day, i) => (
        <div key={day} role="columnheader" className={i === 0 ? DAY_HEADER_FIRST : DAY_HEADER}>
          {day}
        </div>
      ))}

      {/* Hour-label column (left rail) — one tall column with 12 stacked
       *  labels. role="rowheader" mirrors the old <th> scope="row". */}
      <div className="flex flex-col">
        {HOURS.map((h) => (
          <div key={h} role="rowheader" className={HOUR_ROW_LABEL} style={{ height: HOUR_PX }}>
            <span className="-translate-y-1.5 inline-block">{hourLabel(h)}</span>
          </div>
        ))}
      </div>

      {/* 7 day-column bodies */}
      {dateKeys.map((dKey) => {
        const sessionsForDay = sessions.filter((s) => s.dateKey === dKey);
        return (
          <div
            key={dKey}
            data-day-column={dKey}
            className={DAY_COLUMN_BODY}
            style={{ height: totalHeight, ...HOUR_LINES_BG }}
          >
            {/* Invisible hour-bucket buttons — provide click-to-add +
             *  the `aria-label="{dateKey} {hour AM/PM}"` testing affordance.
             *  Sessions render above (z-10) and stop propagation, so
             *  these buttons only catch clicks on empty space. */}
            {HOURS.map((h, i) => (
              <button
                key={h}
                type="button"
                aria-label={`${dKey} ${hourLabel(h)}`}
                onClick={() => onCellClick?.(dKey, h)}
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
                className={HOUR_BUTTON}
              />
            ))}

            {sessionsForDay.map((s) => {
              const top = minToPx(s.startMin);
              const rawHeight = (s.endMin - s.startMin) * (HOUR_PX / 60);
              const height = clampHeight(top, rawHeight);
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  data-category={s.category}
                  data-testid="session-block"
                  data-done={s.done}
                  data-active={isActive ? 'true' : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionClick?.(s);
                  }}
                  style={{ top, height }}
                  className={`${SESSION_BLOCK_BASE} ${
                    CATEGORY_BG[s.category] ?? 'bg-cat-break-bg'
                  } ${s.done ? 'opacity-55' : ''} ${
                    isActive ? 'ring-1 ring-now shadow-[0_4px_14px_rgba(239,68,68,0.25)]' : ''
                  }`}
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
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
