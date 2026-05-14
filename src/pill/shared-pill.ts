// Subset of `src/shared/*` that the pill window needs. Re-exported
// here so the pill bundle doesn't pull in the full main-window
// shared surface (and its transitive React testing-library / UI
// primitive imports). Keeps the pill dist chunk small.

export type {
  Category,
  Session,
  SessionInput,
  TimerTick,
  OffDay,
} from '../shared/ipc';

export { dateKey, formatTime, addDays, getMondayOf, nowMinutes } from '../shared/time';
