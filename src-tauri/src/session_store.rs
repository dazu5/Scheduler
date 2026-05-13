//! Session storage — owns reads + writes against the `sessions`
//! table, plus appends to the `adjustments` audit log.
//!
//! Slice #2 shipped the schema. Slice #3 added `add_session` +
//! `list_sessions`. Slice #4 (this commit) adds `update_session`
//! with audit-log writes and an optional overnight-spill: a single
//! transaction writes the modified Session, every audit row, and
//! (if present) the next-day spill — all linked by a fresh
//! `overnight_link_id` UUID.

use rusqlite::{params, Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

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

/// One audit-log row produced by `applySessionEdit` on the JS side.
/// Mirrors the `adjustments` table's (field, old_value, new_value);
/// `changed_at` is supplied by Rust at write time.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

/// Spill description for an overnight edit. When present, a new
/// Session is inserted on `next_date_key` running 0..`end_min`,
/// linked to the edited Session by a shared `overnight_link_id`.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OvernightSpill {
    pub next_date_key: String,
    pub end_min: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionInput {
    pub category: String,
    pub label: String,
    pub start_min: i64,
    pub end_min: i64,
    pub notes: Option<String>,
    pub audit: Vec<AuditEntry>,
    pub overnight_spill: Option<OvernightSpill>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis() as i64
}

pub fn add_session(conn: &Connection, input: SessionInput) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    let now = now_ms();

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

/// Update one Session, append its audit-log entries, and optionally
/// insert an overnight-spill Session on the following day — all in
/// a single transaction. The `adjusted` flag is set true whenever
/// any audit entries are written.
pub fn update_session(conn: &mut Connection, id: &str, input: UpdateSessionInput) -> Result<()> {
    let tx = conn.transaction()?;
    let now = now_ms();

    let overnight_link_id: Option<String> =
        input.overnight_spill.as_ref().map(|_| Uuid::new_v4().to_string());

    let any_changes = !input.audit.is_empty();

    tx.execute(
        "UPDATE sessions SET \
             category = ?, label = ?, start_min = ?, end_min = ?, notes = ?, \
             adjusted = CASE WHEN ? = 1 THEN 1 ELSE adjusted END, \
             overnight_link_id = ?, \
             updated_at = ? \
         WHERE id = ?",
        params![
            input.category,
            input.label,
            input.start_min,
            input.end_min,
            input.notes,
            if any_changes { 1i64 } else { 0i64 },
            overnight_link_id,
            now,
            id,
        ],
    )?;

    for entry in &input.audit {
        tx.execute(
            "INSERT INTO adjustments (session_id, field, old_value, new_value, changed_at) \
             VALUES (?, ?, ?, ?, ?)",
            params![id, entry.field, entry.old_value, entry.new_value, now],
        )?;
    }

    if let Some(spill) = &input.overnight_spill {
        let spill_id = Uuid::new_v4().to_string();
        let link = overnight_link_id
            .as_ref()
            .expect("overnight_link_id was generated above when spill is present");
        tx.execute(
            "INSERT INTO sessions \
             (id, date_key, category, label, start_min, end_min, notes, done, adjusted, overnight_link_id, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)",
            params![
                spill_id,
                spill.next_date_key,
                input.category,
                input.label,
                0i64,
                spill.end_min,
                input.notes,
                link,
                now,
                now,
            ],
        )?;
    }

    tx.commit()
}
