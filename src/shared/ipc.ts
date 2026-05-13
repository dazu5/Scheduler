// Typed wrappers around Tauri's `invoke` for every command the
// Rust backend exposes. Single source of truth for the TS ↔ Rust
// command vocabulary — anywhere else in the frontend, callers
// import the typed function from here rather than calling
// `invoke('…')` with stringly-typed names and untyped args.

import { invoke } from '@tauri-apps/api/core';
import type { AuditEntry } from './adjustments';

/** Fixed Category palette for v0.1. Kept as a string union (not an
 *  enum) so wire-format JSON round-trips without translation, and so
 *  the Rust side stays free to accept the same values. */
export type Category = 'animation' | 'workflow' | 'cornerman' | 'break';

/** Wire-format inputs for `add_session`. */
export interface SessionInput {
  dateKey: string;
  category: Category;
  label: string;
  startMin: number;
  endMin: number;
  notes: string | null;
}

/** A persisted Session row, as returned by `list_sessions`. */
export interface Session {
  id: string;
  dateKey: string;
  category: Category;
  label: string;
  startMin: number;
  endMin: number;
  notes: string | null;
  done: boolean;
  adjusted: boolean;
  overnightLinkId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Description of the post-midnight portion of an overnight edit.
 *  When present, the backend inserts a new Session on
 *  `nextDateKey` running 0..`endMin`, linked to the edited Session
 *  by a shared overnight_link_id. */
export interface OvernightSpill {
  nextDateKey: string;
  endMin: number;
}

/** Inputs for `update_session`. The `audit` array comes from
 *  applySessionEdit on the JS side; Rust just appends each as a row
 *  to the `adjustments` table within the same transaction as the
 *  Session UPDATE. */
export interface UpdateSessionInput {
  category: Category;
  label: string;
  startMin: number;
  endMin: number;
  notes: string | null;
  audit: AuditEntry[];
  overnightSpill: OvernightSpill | null;
}

/** Insert a Session and return its generated id (UUIDv4). */
export function addSession(input: SessionInput): Promise<string> {
  return invoke<string>('add_session', { input });
}

/** Return every Session with dateKey in `[start, end]` inclusive,
 *  sorted by (dateKey, startMin). */
export function listSessions(range: { start: string; end: string }): Promise<Session[]> {
  return invoke<Session[]>('list_sessions', range);
}

/** Update one Session, write its audit log, and optionally insert
 *  an overnight-spill Session — all in one transaction. */
export function updateSession(id: string, input: UpdateSessionInput): Promise<void> {
  return invoke<void>('update_session', { id, input });
}

/** Delete one Session. Cascades to its `adjustments` rows via
 *  ON DELETE CASCADE on `adjustments.session_id`. */
export function deleteSession(id: string): Promise<void> {
  return invoke<void>('delete_session', { id });
}

/** Flip `done` on the given Session. */
export function toggleDone(id: string): Promise<void> {
  return invoke<void>('toggle_done', { id });
}

/** Summary returned by `import_json` — number of rows written. */
export interface ImportSummary {
  sessions: number;
  offDays: number;
}

/** Import a v2/v3/v4 `weekly_scheduler.html` JSON payload. Rust runs
 *  the pure `importV4` parser on its side and writes both Sessions
 *  and (when off-Day storage lands in #7) off-Days in one
 *  transaction; INSERT OR IGNORE on `sessions.id` makes re-imports
 *  of the same payload idempotent. */
export function importJson(json: string): Promise<ImportSummary> {
  return invoke<ImportSummary>('import_json', { json });
}

/** Same as `importJson` but Rust reads the file from disk first.
 *  Lets the UI hand the picked filesystem path straight through
 *  without needing the `plugin-fs` allowlist on the JS side. */
export function importJsonFromPath(path: string): Promise<ImportSummary> {
  return invoke<ImportSummary>('import_json_from_path', { path });
}

/** Has the user been offered the v4 import prompt? Used to make the
 *  onboarding modal first-launch-only. Persisted in the `kv` table. */
export function hasOnboarded(): Promise<boolean> {
  return invoke<boolean>('has_onboarded');
}

/** Mark the user as having completed (or skipped) onboarding. */
export function setOnboarded(value: boolean): Promise<void> {
  return invoke<void>('set_onboarded', { value });
}

/** Create a duplicate Session 15 minutes after the source's end —
 *  same dateKey, category, label, notes, and duration. Returns the
 *  new Session's id. Implemented in JS over addSession; no
 *  dedicated Rust command needed because the math is trivial. */
export function duplicateSession(source: Session): Promise<string> {
  const duration = source.endMin - source.startMin;
  const newStart = source.endMin + 15;
  return addSession({
    dateKey: source.dateKey,
    category: source.category,
    label: source.label,
    startMin: newStart,
    endMin: newStart + duration,
    notes: source.notes,
  });
}
