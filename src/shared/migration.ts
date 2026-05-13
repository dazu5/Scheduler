// Migration — parse the v4 (and legacy v3 / v2) localStorage shape
// emitted by `weekly_scheduler.html` and produce SQLite-shaped rows
// ready for the Rust `import_json` command to persist.
//
// Pure module: no IO, no DOM, no Tauri. Persistence belongs to the
// Rust side; this module's only job is shape-coercion + version
// promotion. The v3→v4 rename of `tag → category` happens here.
//
// Three input shapes are accepted (matching the predecessor's
// load() function in weekly_scheduler.html):
//   - v4: { version: 4, days: { dateKey: Session[] }, offDays: { dateKey: { reason } } }
//   - v3: { version: 3, days: { dateKey: Session[] (with `tag` field) } }
//   - v2: { version: 2, days: ... } — same shape as v3, treated as such.
//
// The Session id from the source is preserved verbatim — re-importing
// the same payload produces the same SessionRow.id values, so the
// Rust importer can dedupe with INSERT OR IGNORE on the primary key.

/** A Session row ready to be persisted into the `sessions` table.
 *  Field names match `src-tauri/src/session_store.rs::Session`'s
 *  camelCase-via-serde wire format. */
export interface SessionRow {
  id: string;
  dateKey: string;
  category: string;
  label: string;
  startMin: number;
  endMin: number;
  notes: string;
  done: boolean;
  adjusted: boolean;
}

/** An off-Day row ready to be persisted into the `off_days` table.
 *  Off-Day storage is gated on issue #7; if it has not landed yet
 *  the Rust importer will stash these rows on a temporary schema
 *  for #7 to drain. */
export interface OffDayRow {
  dateKey: string;
  reason: string;
}

export interface ImportResult {
  sessions: SessionRow[];
  offDays: OffDayRow[];
}

// Raw v2/v3/v4 Session shape from the HTML predecessor. Fields are
// permissive because the JSON-on-the-wire might be missing some keys.
interface RawSession {
  id?: unknown;
  category?: unknown;
  tag?: unknown; // v3 legacy
  label?: unknown;
  startMin?: unknown;
  endMin?: unknown;
  notes?: unknown;
  done?: unknown;
  adjusted?: unknown;
}

interface RawOffDay {
  reason?: unknown;
}

interface RawPayload {
  version?: unknown;
  days?: Record<string, RawSession[]>;
  offDays?: Record<string, RawOffDay>;
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

function normalizeSession(raw: RawSession, dateKey: string, fallbackId: string): SessionRow {
  // v3 → v4 rename: prefer `category`, fall back to `tag`.
  const category = asString(raw.category ?? raw.tag, 'animation');
  return {
    id: asString(raw.id, fallbackId),
    dateKey,
    category,
    label: asString(raw.label, ''),
    startMin: asNumber(raw.startMin, 0),
    endMin: asNumber(raw.endMin, 0),
    notes: asString(raw.notes, ''),
    done: asBool(raw.done),
    adjusted: asBool(raw.adjusted),
  };
}

/**
 * Parse a v2/v3/v4 weekly_scheduler.html localStorage JSON payload
 * into SQLite-shaped rows.
 *
 * Throws `Error('invalid json: ...')` if the JSON does not parse.
 * Returns an empty result for any structurally-empty payload (missing
 * `days`, empty `days`, missing `offDays`). Per-Session validation is
 * lenient — bad fields fall back to defaults rather than failing the
 * whole import, matching the predecessor's "try to load, normalise
 * what we can" approach in `weekly_scheduler.html`.
 */
export function importV4(json: string): ImportResult {
  let parsed: RawPayload;
  try {
    parsed = JSON.parse(json) as RawPayload;
  } catch (e) {
    throw new Error(`invalid json: ${(e as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    return { sessions: [], offDays: [] };
  }

  const sessions: SessionRow[] = [];
  const days = parsed.days ?? {};
  // Stable insertion-order traversal. Object.entries on a plain
  // object preserves insertion order for string keys, so the result
  // matches the source file's day ordering — which keeps tests
  // deterministic across re-imports.
  for (const [dateKey, raw] of Object.entries(days)) {
    if (!Array.isArray(raw)) continue;
    raw.forEach((session, index) => {
      // Synthesise a stable fallback id when the source omitted one
      // (very old v2 seeds occasionally did). The {dateKey}-{index}
      // form keeps it deterministic on re-import.
      const fallback = `${dateKey}-${index}`;
      sessions.push(normalizeSession(session, dateKey, fallback));
    });
  }

  const offDays: OffDayRow[] = [];
  const rawOffDays = parsed.offDays ?? {};
  for (const [dateKey, raw] of Object.entries(rawOffDays)) {
    if (!raw || typeof raw !== 'object') continue;
    const reason = asString(raw.reason, '').trim();
    offDays.push({ dateKey, reason: reason || 'No reason given' });
  }

  return { sessions, offDays };
}
