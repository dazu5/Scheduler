//! Database initialisation and schema migrations.
//!
//! Owns the canonical schema for `sessions`, `off_days`, `adjustments`,
//! `activity_samples`, and `settings` (see ARCHITECTURE.md § Schema).
//! The public surface is intentionally narrow — one function — so that
//! callers don't depend on which migration files exist or how they're
//! ordered, only on the post-condition that the schema is current.
//!
//! Subsequent slices (issues #4 adjustments, #7 off_days, #11 activity)
//! grow the schema as their own tests drive the changes in. v0.1 of
//! this module ships only the `sessions` table — enough to satisfy
//! slice #2's acceptance criteria.

use rusqlite::{Connection, Result};

const SCHEMA_V1_SESSIONS: &str = "\
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
";

/// Apply every pending migration to `conn`. Idempotent — calling twice
/// against a connection whose schema is already current is a no-op.
///
/// Tests use `Connection::open_in_memory()`; production opens by path.
pub fn apply_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA_V1_SESSIONS)?;
    Ok(())
}
