// Conflict detection between Sessions on the same day. The single
// function the editor's live warning, the day-card ⚠ icon, and the
// save-time check all share. Pure — no DOM, no IO, no time.
//
// Exclusive-end semantics: a Session's `endMin` is the moment it
// stops occupying the timeline. Two Sessions whose endMin and the
// next startMin are equal are adjacent, not overlapping.

import type { Session } from './ipc';

export interface OverlapTarget {
  id: string;
  startMin: number;
  endMin: number;
}

/** Return Sessions in `pool` whose time range overlaps `target`'s,
 *  excluding the target itself by id. Callers filter `pool` to the
 *  relevant day first; this function compares only on the time
 *  axis. */
export function findOverlaps(pool: Session[], target: OverlapTarget): Session[] {
  return pool.filter(
    (s) => s.id !== target.id && !(s.endMin <= target.startMin || s.startMin >= target.endMin),
  );
}
