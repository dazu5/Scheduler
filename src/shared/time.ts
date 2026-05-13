// Pure helpers for minutes-since-midnight arithmetic, date-key
// formatting, and the readEditTimes overnight-detection rule.
// Ported function-by-function from weekly_scheduler.html.
//
// Two intentional changes during the port:
//  - formatTime(1440) now renders '12:00 AM' (next-day midnight),
//    fixing an inherited bug where it returned '12:00 PM'. The HTML
//    never reached 1440 because session ends capped at 23:59; the
//    2026-05-13 overnight-split fix made it reachable.
//  - All functions take and return real types; no DOM lookups inside
//    (readEditTimes used to read from document.getElementById in the
//    HTML — here it takes start/end strings as parameters).

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Snap minutes to the nearest 15-minute boundary. */
export function snapMin(m: number): number {
  return Math.round(m / 15) * 15;
}

/** Minutes-since-midnight → 'HH:MM' 24-hour string. */
export function mmToInput(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** 'HH:MM' → minutes-since-midnight, or NaN on empty / nullish. */
export function inputToMm(s: string | null | undefined): number {
  if (!s) return Number.NaN;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Date → 'YYYY-MM-DD' in local time. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → Date at local midnight. */
export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date + N days. Returns a new Date; does not mutate the input. */
export function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

/** Date → Monday of that week (local midnight). Monday-anchored per CONTEXT.md. */
export function getMondayOf(d: Date): Date {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  const day = nd.getDay();
  const offset = day === 0 ? -6 : 1 - day; // Sunday → previous Monday
  nd.setDate(nd.getDate() + offset);
  return nd;
}

/** Time-of-day in minutes for `date` (defaults to now). */
export function nowMinutes(date?: Date): number {
  const n = date ?? new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Minutes → '6:00 AM' format, clamped to [0, 24h]. */
export function formatTime(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const isNextDayMidnight = h === 24;
  const ampm = !isNextDayMidnight && h >= 12 ? 'PM' : 'AM';
  const h12 = isNextDayMidnight ? 12 : ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${ampm}`;
}

/** Minutes → '0 min' / '45 min' / '1h' / '1h 30m'. */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface EditTimes {
  startMin: number;
  endMin: number;
  /** Minutes-into-next-day when the range wraps midnight; null otherwise. */
  overnightEnd: number | null;
  /** True only when start === end and no overnight wrap is implied. */
  zeroLength: boolean;
}

/**
 * Parse editor start/end time strings and detect overnight wraps.
 * Returns null for invalid (empty/NaN) input. Four documented cases
 * (encoded by the 2026-05-13 fix in weekly_scheduler.html):
 *   1. Same-day: end > start → returns the range as-is.
 *   2. Overnight wrap: end < start → endMin clamped to 1440, the
 *      post-midnight portion lives in overnightEnd.
 *   3. Midnight shorthand: end === 0 with start > 0 → endMin=1440,
 *      no spill onto the next day.
 *   4. Zero-length: end === start (after snap, no overnight intent)
 *      → zeroLength=true so callers can refuse to save.
 */
export function readEditTimes(startStr: string, endStr: string): EditTimes | null {
  const startMin = snapMin(inputToMm(startStr));
  let endMin = snapMin(inputToMm(endStr));
  if (Number.isNaN(startMin) || Number.isNaN(endMin)) return null;

  let overnightEnd: number | null = null;
  if (endMin === 0 && startMin > 0) {
    endMin = 24 * 60;
  } else if (endMin < startMin) {
    overnightEnd = endMin;
    endMin = 24 * 60;
  }
  const zeroLength = overnightEnd === null && endMin === startMin;
  return { startMin, endMin, overnightEnd, zeroLength };
}
