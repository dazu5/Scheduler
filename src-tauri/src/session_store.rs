//! Session storage — owns reads + writes against the `sessions`
//! table.
//!
//! Slice #3 (issue #3) ships `add_session` + `list_sessions`.
//! Subsequent slices add `update_session` + adjustments-log
//! integration (#4), `delete_session` / `toggle_done` (#5), and
//! `replace_week` / `import_days` (#11). Each mutator will also
//! emit a Tauri event so the main + pill windows stay in sync —
//! that wiring lives in `main.rs`, not in this module.

use rusqlite::{params, Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Inputs accepted by `add_session`. Mirrors the SessionInput shape
/// the frontend builds in the New Session modal.
///
/// `rename_all = "camelCase"` bridges Rust idiomatic snake_case to
/// TypeScript idiomatic camelCase — frontend sends `{ dateKey, … }`,
/// serde decodes into `date_key`, etc.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInput {
    pub date_key: String,
    pub category: String,
    pub label: String,
    pub start_min: i64,
    pub end_min: i64,
    pub notes: Option<String>,
}

/// A persisted Session row, as returned by `list_sessions`. Mirrors
/// the 12 columns in the `sessions` table (per ARCHITECTURE.md).
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub date_key: String,
    pub category: String,
    pub label: String,
    pub start_min: i64,
    pub end_min: i64,
    pub notes: Option<String>,
    pub done: bool,
    pub adjusted: bool,
    pub overnight_link_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Insert one Session row into `sessions` and return its generated id.
///
/// The id is a UUIDv4 — opaque to callers; tests pin "non-empty +
/// distinct across inserts" rather than the format, so we're free to
/// swap the scheme without breaking anything.
pub fn add_session(conn: &Connection, input: SessionInput) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO sessions \
         (id, date_key, category, label, start_min, end_min, notes, done, adjusted, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
        params![
            id,
            input.date_key,
            input.category,
            input.label,
            input.start_min,
            input.end_min,
            input.notes,
            now,
            now,
        ],
    )?;

    Ok(id)
}

/// Return every Session with `date_key` in `[start_key, end_key]`
/// (inclusive on both ends), sorted by `(date_key, start_min)` so
/// the frontend can render them in display order without re-sorting.
pub fn list_sessions(conn: &Connection, start_key: &str, end_key: &str) -> Result<Vec<Session>> {
    let mut stmt = conn.prepare(
        "SELECT id, date_key, category, label, start_min, end_min, notes, \
                done, adjusted, overnight_link_id, created_at, updated_at \
         FROM sessions \
         WHERE date_key >= ? AND date_key <= ? \
         ORDER BY date_key, start_min",
    )?;

    let rows = stmt.query_map(params![start_key, end_key], |row| {
        Ok(Session {
            id: row.get(0)?,
            date_key: row.get(1)?,
            category: row.get(2)?,
            label: row.get(3)?,
            start_min: row.get(4)?,
            end_min: row.get(5)?,
            notes: row.get(6)?,
            done: row.get::<_, i64>(7)? != 0,
            adjusted: row.get::<_, i64>(8)? != 0,
            overnight_link_id: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    rows.collect()
}
