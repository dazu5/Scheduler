// Diff engine for Session edits — produces the new Session shape
// AND the audit-log entries that record what changed. Pure JS;
// Rust just persists what's passed in.
//
// The fields tracked are the user-visible mutable attributes of a
// Session (category, label, startMin, endMin, notes). Other fields
// (id, dateKey, done, adjusted, overnightLinkId, timestamps) are
// either set elsewhere or derived.

import type { Session } from './ipc';

const ADJUSTMENT_FIELDS = ['category', 'label', 'startMin', 'endMin', 'notes'] as const;
type AdjField = (typeof ADJUSTMENT_FIELDS)[number];

export type SessionPatch = Partial<Pick<Session, AdjField>>;

export interface AuditEntry {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ApplyResult {
  /** Session with patch fields merged. `adjusted` is set to true
   *  if any audit entries were produced (or if it was already
   *  true). Other invariants (id, dateKey, …) are copied through. */
  next: Session;
  /** One entry per field whose value actually changed. */
  audit: AuditEntry[];
  /** Convenience — same as next.adjusted. */
  adjusted: boolean;
}

function valueToAuditString(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Apply `patch` to `prev`, returning the resulting Session and the
 *  audit entries that record each changed field. An empty patch (or
 *  a patch whose values all match prev) returns zero audit entries
 *  and leaves `adjusted` unchanged. */
export function applySessionEdit(prev: Session, patch: SessionPatch): ApplyResult {
  const audit: AuditEntry[] = [];
  const next: Session = { ...prev };

  for (const field of ADJUSTMENT_FIELDS) {
    if (!(field in patch)) continue;
    const newValue = patch[field] as Session[AdjField];
    const oldValue = prev[field];
    if (newValue === oldValue) continue;

    audit.push({
      field,
      oldValue: valueToAuditString(oldValue),
      newValue: valueToAuditString(newValue),
    });
    // Object.assign preserves `next`'s Session type while accepting a
    // computed-key partial — avoids casting through `any`.
    Object.assign(next, { [field]: newValue });
  }

  next.adjusted = prev.adjusted || audit.length > 0;
  return { next, audit, adjusted: next.adjusted };
}
