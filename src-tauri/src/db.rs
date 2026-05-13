//! Database initialisation and schema migrations.
//!
//! Owns the canonical schema for `sessions`, `adjustments`, and
//! (later) `off_days`, `activity_samples`, `settings`. The public
//! surface is intentionally narrow — one function — so callers
//! don't depend on which migration files exist, only on the
//! post-condition that the schema is current.
//!
//! Slice #2 shipped the `sessions` table. Slice #4 (this commit)
//! adds the `adjustments` audit table. The schema grows
//! additively per slice; there's no v2 migration because there
//! are no production users yet — the dev DB is wiped between
//! schema changes.

use rusqlite::{Connection, Result};

const SCHEMA_V1: &str = "\
CREATE TABLE IF NOT EXISTS sessions (
    id                 TEXT PRIMARY KEY,
    date_key           TEXT NOT NULL,
    category           TEXT NOT NULL,
    label              TEXT NOT NULL,
    start_min          INTEGER NOT NULL,
    end_min            INTEGER NOT NULL,
    notes              TEXT,
    done               INTEGER NOT NULL DEFAULT 0,
    adjusted           INTEGER NOT NULL DEFAULT 0,
    overnight_link_id  TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    field       TEXT NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_at  INTEGER NOT NULL,
    reason      TEXT
);

CREATE INDEX IF NOT EXISTS idx_adjustments_session
    ON adjustments(session_id);

CREATE TABLE IF NOT EXISTS off_days (
    date_key   TEXT PRIMARY KEY,
    reason     TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

/// Apply every pending migration to `conn`. Idempotent — calling
/// twice against a connection whose schema is already current is
/// a no-op.
pub fn apply_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA_V1)?;
    Ok(())
}
