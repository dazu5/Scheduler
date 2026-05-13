// Typed wrappers around Tauri's `invoke` for every command the
// Rust backend exposes. Single source of truth for the TS ↔ Rust
// command vocabulary — anywhere else in the frontend, callers
// import the typed function from here rather than calling
// `invoke('…')` with stringly-typed names and untyped args.

import { invoke } from '@tauri-apps/api/core';
import type { AuditEntry } from './adjustments';

/** Wire-format inputs for `add_session`. */
export interface SessionInput {
  dateKey: string;
  category: string;
  label: string;
  startMin: number;
  endMin: number;
  notes: string | null;
}

/** A persisted Session row, as returned by `list_sessions`. */
export interface Session {
  id: string;
  dateKey: string;
  category: string;
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
  category: string;
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
