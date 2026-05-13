// Typed wrappers around Tauri's `invoke` for every command the
// Rust backend exposes. Single source of truth for the TS ↔ Rust
// command vocabulary — anywhere else in the frontend, callers
// import the typed function from here rather than calling
// `invoke('…')` with stringly-typed names and untyped args.

import { invoke } from '@tauri-apps/api/core';

/** Wire-format inputs for `add_session`. Mirrors the Rust struct
 *  `session_store::SessionInput` (with `#[serde(rename_all =
 *  "camelCase")]`) — keys must match these names exactly. */
export interface SessionInput {
  dateKey: string;
  category: string;
  label: string;
  startMin: number;
  endMin: number;
  notes: string | null;
}

/** A persisted Session row, as returned by `list_sessions`. Matches
 *  the 12 columns in the `sessions` table (ARCHITECTURE.md §Schema). */
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

/** Insert a Session and return its generated id (UUIDv4). */
export function addSession(input: SessionInput): Promise<string> {
  return invoke<string>('add_session', { input });
}

/** Return every Session with dateKey in `[start, end]` inclusive,
 *  sorted by (dateKey, startMin). */
export function listSessions(range: { start: string; end: string }): Promise<Session[]> {
  return invoke<Session[]>('list_sessions', range);
}
