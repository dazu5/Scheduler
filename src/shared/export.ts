// Issue #13 — pure CSV / JSON exporters.
//
// `toCsv(sessions)` and `toJson(sessions)` produce text payloads
// suitable for writing to disk via the `export_to_path` Tauri command.
// Pure: no DOM, no IO, no Tauri imports. Caller is responsible for
// the file picker + the actual write.

import type { Session } from './ipc';

const CSV_COLUMNS = [
  'id',
  'dateKey',
  'category',
  'label',
  'startMin',
  'endMin',
  'notes',
  'done',
  'adjusted',
  'overnightLinkId',
  'createdAt',
  'updatedAt',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote any field that contains comma / quote / newline; double-up
  // embedded quotes per RFC 4180.
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** RFC 4180 CSV with a header row. Sessions in input order. */
export function toCsv(sessions: readonly Session[]): string {
  const lines: string[] = [];
  lines.push(CSV_COLUMNS.join(','));
  for (const s of sessions) {
    lines.push(CSV_COLUMNS.map((col) => csvEscape(s[col as keyof Session])).join(','));
  }
  // Trailing newline per RFC 4180; readers tolerate it either way but
  // most editors render a trailing blank line either way.
  return `${lines.join('\n')}\n`;
}

/** Pretty-printed JSON, two-space indent, single trailing newline. */
export function toJson(sessions: readonly Session[]): string {
  return `${JSON.stringify(sessions, null, 2)}\n`;
}
