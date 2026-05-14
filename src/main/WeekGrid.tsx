// The week-grid surface — visual structure ported from
// `weekly_scheduler.html`'s `.week-grid` / `.day-col` / `.session-block`
// CSS so the Tauri app reads the same way as the predecessor.
//
// Layout: a CSS grid of `5rem` (hour rail) + 7 day columns. Each day
// column is `position: relative` with a column header (weekday short,
// date number, day-meta) on top of the body. Sessions are absolutely
// positioned inside the body with `top` + `height` proportional to
// duration. Hour gridlines are painted with a `repeating-linear-gradient`
// so we don't render 12 separate divs per day.
//
// Session block format mirrors the predecessor:
//   sb-time:  "8:00 AM-11:00 AM · ANIM"   (white@55%, 10px tabular-nums)
//   sb-label: "LR · AI Animation"          (white, 11px, weight 600)
// Edge-to-edge inside the column with a small left/right inset, so a
// long Session reads as a tall labelled rectangle rather than a chip.
//
// `data-active="true"` plus `ring-now` highlights the live Session;
// `<NowLine />` paints the predecessor's red horizontal "NOW" marker
// across today's column at the current minute.

import { CATEGORY_INFO } from '../shared/categories';
import type { Session } from '../shared/ipc';
import { dayWorkHours } from '../shared/summarize';
import { addDays, dateKey, formatTime, getMondayOf } from '../shared/time';

const WEEKDAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_COUNT = END_HOUR - START_HOUR;
const HOURS = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
const HOUR_PX = 80; // matches the predecessor's --hour-h: 80px

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

function minToPx(min: number): number {
  return Math.max(0, (min - START_HOUR * 60) * (HOUR_PX / 60));
}

function clampHeight(top: number, raw: number): number {
  const totalPx = HOUR_COUNT * HOUR_PX;
  return Math.min(raw, totalPx - top);
}

function dayMeta(d: Date, hours: number): string {
  return `${MONTHS_SHORT[d.getMonth()]} · ${hours.toFixed(1)}h`;
}

const DAY_HEADER_BASE =
  'relative flex flex-col justify-center border-b border-l border-border bg-surface px-3 py-2';
const DAY_NAME = 'text-[10px] font-bold uppercase tracking-[0.06em] leading-[1.1] text-fg-muted';
const DAY_DATE = 'text-[18px] font-bold leading-[1.1] tabular-nums text-fg';
const DAY_META = 'mt-0.5 text-[10px] tabular-nums text-fg-muted';
const DAY_TODAY_UNDERLINE =
  'after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-accent';

const HOUR_RAIL_LABEL = 'pr-2 text-right text-[10px] font-medium tabular-nums text-fg-muted';
const DAY_COLUMN_BODY = 'relative border-l border-border';
const HOUR_BUTTON =
  'absolute left-0 right-0 cursor-pointer transition-colors ' +
  'hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.06]';

const SESSION_BLOCK_BASE =
  'group/session absolute z-10 flex flex-col overflow-hidden rounded-lg cursor-pointer ' +
  'transition-[filter] hover:brightness-[1.18] hover:z-20';
const INLINE_BTN =
  'rounded bg-black/25 px-1.5 py-0.5 text-[9px] leading-tight text-white hover:bg-black/45 ' +
  'transition-colors';

const HOUR_LINES_BG = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(80px - 1px), var(--color-border) calc(80px - 1px), var(--color-border) 80px)',
  backgroundSize: '100% 80px',
  backgroundRepeat: 'repeat-y',
};

export interface WeekGridProps {
  weekStart?: Date;
  sessions?: Session[];
  /** Id of the Session currently containing "now" — drives the red
   *  ring + glow on that block. */
  activeSessionId?: string | null;
  /** dateKey → reason. Off-Days dim their column, suppress click-to-add,
   *  hide their day-meta total, and surface a DAY OFF card with the
   *  reason on hover. */
  offDays?: ReadonlyMap<string, string>;
  /** Optional override for "now" — when omitted, computed from
   *  `new Date()`. Used by the today-column tint + NOW line + day
   *  meta highlight. */
  now?: Date;
  onCellClick?: (dateKey: string, hour: number) => void;
  onSessionClick?: (session: Session) => void;
  onToggleDone?: (session: Session) => void;
  onDuplicate?: (session: Session) => void;
  onDelete?: (session: Session) => void;
  /** Fired when the user clicks the day-header off-toggle button. */
  onToggleDayOff?: (dateKey: string) => void;
}

export function WeekGrid({
  weekStart = getMondayOf(new Date()),
  sessions = [],
  activeSessionId = null,
  offDays,
  now = new Date(),
  onCellClick,
  onSessionClick,
  onToggleDone,
  onDuplicate,
  onDelete,
  onToggleDayOff,
}: WeekGridProps = {}) {
  const todayKey = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateKeys = WEEKDAYS_SHORT.map((_, i) => dateKey(addDays(weekStart, i)));
  const totalHeight = HOUR_COUNT * HOUR_PX;

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: '5rem repeat(7, minmax(0, 1fr))' }}>
      {/* Header row: empty hour-rail spacer + 7 day-column headers */}
      <div className="border-b border-border bg-surface" />
      {WEEKDAYS_SHORT.map((short, i) => {
        const d = addDays(weekStart, i);
        const dKey = dateKeys[i];
        const isToday = dKey === todayKey;
        const reason = offDays?.get(dKey);
        const isOff = reason !== undefined;
        const dayTotal = isOff ? 0 : dayWorkHours(sessions.filter((s) => s.dateKey === dKey));
        const headerCls = `group/dayheader ${DAY_HEADER_BASE} ${i === 0 ? 'border-l-0' : ''} ${
          isToday ? DAY_TODAY_UNDERLINE : ''
        }`;
        return (
          <div
            key={dKey}
            role="columnheader"
            data-today={isToday ? 'true' : undefined}
            data-off={isOff ? 'true' : undefined}
            className={headerCls}
          >
            <div className={`${DAY_NAME} ${isToday ? 'text-accent' : ''}`}>{short}</div>
            <div className={`${DAY_DATE} ${isToday ? 'text-accent' : ''}`}>{d.getDate()}</div>
            <div className={DAY_META} title={isOff ? reason : undefined}>
              {isOff ? 'Off' : dayMeta(d, dayTotal)}
            </div>
            {onToggleDayOff && (
              <button
                type="button"
                aria-label={isOff ? `Unmark ${dKey} off` : `Mark ${dKey} off`}
                onClick={() => onToggleDayOff(dKey)}
                className="absolute top-1.5 right-1.5 z-[4] rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-fg-muted opacity-0 transition-opacity hover:bg-border hover:text-fg group-hover/dayheader:opacity-100"
              >
                {isOff ? '↺' : '✕'}
              </button>
            )}
          </div>
        );
      })}

      {/* Hour-label rail (left column). Each label is top-aligned with
       *  its hour gridline so the layout reads cleanly with the body. */}
      <div className="flex flex-col">
        {HOURS.map((h) => (
          <div
            key={h}
            role="rowheader"
            className={HOUR_RAIL_LABEL}
            style={{ height: HOUR_PX, paddingTop: 4 }}
          >
            {hourLabel(h)}
          </div>
        ))}
      </div>

      {/* 7 day-column bodies */}
      {dateKeys.map((dKey) => {
        const isToday = dKey === todayKey;
        const reason = offDays?.get(dKey);
        const isOff = reason !== undefined;
        const sessionsForDay = sessions.filter((s) => s.dateKey === dKey);
        return (
          <div
            key={dKey}
            data-day-column={dKey}
            data-off={isOff ? 'true' : undefined}
            className={`${DAY_COLUMN_BODY} ${isToday ? 'bg-accent/[0.035]' : ''} ${
              isOff ? 'opacity-85' : ''
            }`}
            style={{ height: totalHeight, ...(isOff ? {} : HOUR_LINES_BG) }}
          >
            {/* Hour-bucket buttons — disabled on off-Days so the user
             *  can't accidentally schedule a Session on a Day they've
             *  marked off. */}
            {!isOff &&
              HOURS.map((h, i) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`${dKey} ${hourLabel(h)}`}
                  onClick={() => onCellClick?.(dKey, h)}
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                  className={HOUR_BUTTON}
                />
              ))}

            {sessionsForDay.map((s) => (
              <SessionBlock
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSessionClick={onSessionClick}
                onToggleDone={onToggleDone}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}

            {isOff && <DayOffCard reason={reason} />}

            {isToday && nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60 && (
              <NowLine top={minToPx(nowMin)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SessionBlockProps {
  session: Session;
  isActive: boolean;
  onSessionClick?: (session: Session) => void;
  onToggleDone?: (session: Session) => void;
  onDuplicate?: (session: Session) => void;
  onDelete?: (session: Session) => void;
}

function SessionBlock({
  session: s,
  isActive,
  onSessionClick,
  onToggleDone,
  onDuplicate,
  onDelete,
}: SessionBlockProps) {
  const top = minToPx(s.startMin);
  const rawHeight = (s.endMin - s.startMin) * (HOUR_PX / 60);
  const height = clampHeight(top, rawHeight);
  // Compact / medium / full padding scales with available height —
  // matches the predecessor's session-block.medium / .compact tiers.
  const compact = height < 36;
  const medium = !compact && height < 64;
  const padding = compact ? 'px-2.5 py-0.5' : medium ? 'px-2.5 py-1' : 'px-3 py-2';
  const pill = CATEGORY_INFO[s.category]?.pill ?? s.category.toUpperCase();
  return (
    <div
      data-category={s.category}
      data-testid="session-block"
      data-done={s.done}
      data-active={isActive ? 'true' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSessionClick?.(s);
      }}
      style={{
        top,
        height,
        // Edge-to-edge inside the column with the predecessor's 8px inset.
        left: 8,
        right: 8,
      }}
      className={`${SESSION_BLOCK_BASE} ${padding} ${
        CATEGORY_BG[s.category] ?? 'bg-cat-break-bg'
      } ${s.done ? 'opacity-55' : ''} ${
        isActive ? 'ring-1 ring-now shadow-[0_4px_14px_rgba(239,68,68,0.25)]' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {!compact && (
            <div className="text-[10px] leading-[1.2] tabular-nums text-white/55">
              {formatTime(s.startMin)}-{formatTime(s.endMin)} · {pill}
            </div>
          )}
          <div
            className={`truncate text-[11px] font-semibold leading-[1.25] text-white ${
              s.done ? 'line-through' : ''
            } ${compact ? '' : 'mt-0.5'}`}
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
}

function DayOffCard({ reason }: { reason: string }) {
  return (
    <div
      data-testid="day-off-card"
      title={reason}
      className="-translate-y-1/2 absolute top-1/2 right-3 left-3 rounded-[10px] border border-border-strong border-dashed bg-surface-2 px-4 py-4 text-center"
    >
      <div className="mb-1.5 text-[24px] leading-none">🌙</div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.07em] text-fg-muted">
        Day Off
      </div>
      <div className="truncate text-[11px] text-fg">{reason}</div>
    </div>
  );
}

function NowLine({ top }: { top: number }) {
  return (
    <div
      data-testid="now-line"
      aria-hidden="true"
      className="pointer-events-none absolute right-0 left-0 z-[6] h-0.5 bg-now"
      style={{ top }}
    >
      <span className="-left-[5px] -top-1 absolute size-2.5 animate-pulse-dot rounded-full bg-now" />
      <span className="-top-[9px] absolute left-2.5 rounded bg-now px-1.5 py-px text-[9px] font-bold tracking-[0.06em] text-white">
        NOW
      </span>
    </div>
  );
}
