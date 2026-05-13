//! Undo / redo wrapper around `session_store` mutators.
//!
//! Each mutation pushes an `UndoEntry` (an inverse snapshot + a
//! human-readable label) onto a `VecDeque` capped at 50. A successful
//! `undo()` consumes the top entry, applies its inverse, and pushes
//! the symmetric forward snapshot onto the redo deque. `redo()` is
//! the mirror. Any new mutation clears the redo deque entirely —
//! standard editor semantics.
//!
//! Snapshots are stored as **full row state** for the affected
//! `sessions.id` set: either `Some(SessionRow)` to mean "this id
//! should look like this," or `None` to mean "this id should not
//! exist." Adjustments rows are captured per-session-id. Restoring
//! a snapshot upserts the present rows, deletes the absent ones,
//! and rewrites the adjustments rows for the affected sessions.

use std::collections::{HashMap, VecDeque};

use rusqlite::{params, Connection, Result};

use crate::session_store::{self, SessionInput, UpdateSessionInput};

const MAX_DEPTH: usize = 50;

/// A row of the `sessions` table, captured for snapshot restoration.
#[derive(Debug, Clone)]
struct SessionRow {
    id: String,
    date_key: String,
    category: String,
    label: String,
    start_min: i64,
    end_min: i64,
    notes: Option<String>,
    done: i64,
    adjusted: i64,
    overnight_link_id: Option<String>,
    created_at: i64,
    updated_at: i64,
}

/// A row of the `adjustments` table, captured for snapshot
/// restoration. We preserve the original `id` so that the audit log
/// round-trips byte-for-byte across an undo/redo pair.
#[derive(Debug, Clone)]
struct AdjustmentRow {
    id: i64,
    session_id: String,
    field: String,
    old_value: Option<String>,
    new_value: Option<String>,
    changed_at: i64,
    reason: Option<String>,
}

/// A snapshot of the state to restore for a set of session ids.
/// `sessions[id] = Some(row)` means "this row should be present";
/// `None` means "this id should not exist in the table."
/// `adjustments` is the full list of adjustment rows for those ids
/// (only meaningful when the corresponding session is present).
#[derive(Debug, Clone, Default)]
struct StateSnapshot {
    sessions: HashMap<String, Option<SessionRow>>,
    adjustments: Vec<AdjustmentRow>,
}

/// One entry on the undo (or redo) deque. `inverse` restores the
/// state to its pre-mutation shape; `forward` restores it to its
/// post-mutation shape. On undo we apply `inverse` and push the
/// entry onto the redo deque so redo can re-apply `forward`.
#[derive(Debug, Clone)]
struct UndoEntry {
    /// Human-readable label for the toast — e.g. "add Session",
    /// "edit Session", "delete Session", "toggle Session done".
    label: String,
    inverse: StateSnapshot,
    forward: StateSnapshot,
}

/// 50-deep undo + redo deques. The struct lives in Tauri-managed
/// state behind a `Mutex` so the IPC commands have somewhere to push.
#[derive(Debug, Default)]
pub struct UndoStack {
    undo: VecDeque<UndoEntry>,
    redo: VecDeque<UndoEntry>,
}

impl UndoStack {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn undo_depth(&self) -> usize {
        self.undo.len()
    }

    pub fn redo_depth(&self) -> usize {
        self.redo.len()
    }

    fn push_undo(&mut self, entry: UndoEntry) {
        if self.undo.len() == MAX_DEPTH {
            self.undo.pop_front();
        }
        self.undo.push_back(entry);
        // Any new mutation clears the redo deque.
        self.redo.clear();
    }
}

// ---------------------------------------------------------------------------
// Snapshot capture + restore
// ---------------------------------------------------------------------------

fn capture(conn: &Connection, ids: &[&str]) -> Result<StateSnapshot> {
    let mut sessions: HashMap<String, Option<SessionRow>> = HashMap::new();
    let mut adjustments: Vec<AdjustmentRow> = Vec::new();

    for id in ids {
        // sessions row (may be absent)
        let row = conn
            .query_row(
                "SELECT id, date_key, category, label, start_min, end_min, notes, \
                        done, adjusted, overnight_link_id, created_at, updated_at \
                 FROM sessions WHERE id = ?",
                [id],
                |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        date_key: row.get(1)?,
                        category: row.get(2)?,
                        label: row.get(3)?,
                        start_min: row.get(4)?,
                        end_min: row.get(5)?,
                        notes: row.get(6)?,
                        done: row.get(7)?,
                        adjusted: row.get(8)?,
                        overnight_link_id: row.get(9)?,
                        created_at: row.get(10)?,
                        updated_at: row.get(11)?,
                    })
                },
            )
            .ok();

        sessions.insert((*id).to_string(), row);

        // adjustments rows for this session id (may be empty)
        let mut stmt = conn.prepare(
            "SELECT id, session_id, field, old_value, new_value, changed_at, reason \
             FROM adjustments WHERE session_id = ? ORDER BY id",
        )?;
        let rows = stmt.query_map([id], |row| {
            Ok(AdjustmentRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                field: row.get(2)?,
                old_value: row.get(3)?,
                new_value: row.get(4)?,
                changed_at: row.get(5)?,
                reason: row.get(6)?,
            })
        })?;
        for r in rows {
            adjustments.push(r?);
        }
    }

    Ok(StateSnapshot { sessions, adjustments })
}

fn restore(conn: &mut Connection, snap: &StateSnapshot) -> Result<()> {
    let tx = conn.transaction()?;

    for id in snap.sessions.keys() {
        // Delete current row (cascades adjustments). We rewrite both
        // tables from the snapshot, so a clean slate per id is safe.
        tx.execute("DELETE FROM sessions WHERE id = ?", [id])?;
    }

    for maybe_row in snap.sessions.values() {
        if let Some(row) = maybe_row {
            tx.execute(
                "INSERT INTO sessions \
                 (id, date_key, category, label, start_min, end_min, notes, done, adjusted, overnight_link_id, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    row.id,
                    row.date_key,
                    row.category,
                    row.label,
                    row.start_min,
                    row.end_min,
                    row.notes,
                    row.done,
                    row.adjusted,
                    row.overnight_link_id,
                    row.created_at,
                    row.updated_at,
                ],
            )?;
        }
    }

    for adj in &snap.adjustments {
        tx.execute(
            "INSERT INTO adjustments (id, session_id, field, old_value, new_value, changed_at, reason) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                adj.id,
                adj.session_id,
                adj.field,
                adj.old_value,
                adj.new_value,
                adj.changed_at,
                adj.reason,
            ],
        )?;
    }

    tx.commit()
}

// ---------------------------------------------------------------------------
// Wrapped mutators
// ---------------------------------------------------------------------------

/// Wrap `session_store::add_session`: insert the row, then push an
/// undo entry whose `inverse` removes it.
pub fn add_session_with_undo(
    conn: &mut Connection,
    stack: &mut UndoStack,
    input: SessionInput,
) -> Result<String> {
    // The add_session signature takes &Connection (not &mut), but we
    // need &mut to push the undo entry — that's fine, we drop the
    // borrow before pushing.
    let id = session_store::add_session(conn, input)?;

    let inverse = StateSnapshot {
        sessions: {
            let mut m = HashMap::new();
            m.insert(id.clone(), None);
            m
        },
        adjustments: Vec::new(),
    };
    let forward = capture(conn, &[id.as_str()])?;

    stack.push_undo(UndoEntry {
        label: "add Session".to_string(),
        inverse,
        forward,
    });

    Ok(id)
}

/// Wrap `session_store::update_session`. The inverse must restore
/// **both** the edited row (incl. `adjusted` flag, `overnight_link_id`)
/// AND the adjustments table — undoing also drops the new audit
/// rows. If the update produced an overnight spill, the inverse
/// snapshot also deletes the spill row by virtue of its absence in
/// `inverse.sessions`.
pub fn update_session_with_undo(
    conn: &mut Connection,
    stack: &mut UndoStack,
    id: &str,
    input: UpdateSessionInput,
) -> Result<()> {
    // We need to know which session ids may be touched. The edited
    // session is `id`. A spill creates a brand-new session whose id
    // is generated inside session_store; we discover it by diffing
    // the sessions table for the spill's `next_date_key` before and
    // after — or, more simply, by looking up the row by its
    // `overnight_link_id` post-update. Easier still: list session
    // ids touching the relevant date_keys before and after.
    let target_dates: Vec<String> = {
        let mut dates: Vec<String> = Vec::new();
        // The session-being-edited's existing date_key.
        let existing_date: Option<String> = conn
            .query_row(
                "SELECT date_key FROM sessions WHERE id = ?",
                [id],
                |r| r.get(0),
            )
            .ok();
        if let Some(d) = existing_date {
            dates.push(d);
        }
        if let Some(spill) = input.overnight_spill.as_ref() {
            dates.push(spill.next_date_key.clone());
        }
        dates
    };

    // Gather pre-update ids touching the target dates.
    let pre_ids = ids_for_dates(conn, &target_dates)?;
    let inverse = capture(conn, &pre_ids.iter().map(String::as_str).collect::<Vec<_>>())?;

    session_store::update_session(conn, id, input)?;

    let post_ids = ids_for_dates(conn, &target_dates)?;
    // Union of ids before + after — captures the spill's new id.
    let mut all_ids: std::collections::HashSet<String> = pre_ids.into_iter().collect();
    all_ids.extend(post_ids);
    let all_ids_vec: Vec<&str> = all_ids.iter().map(String::as_str).collect();
    // Re-capture the inverse to include the new (spill) id as
    // None — i.e. "should not exist before."
    let inverse_complete = {
        let mut s = inverse.clone();
        for ido in &all_ids_vec {
            s.sessions.entry((*ido).to_string()).or_insert(None);
        }
        s
    };
    let forward = capture(conn, &all_ids_vec)?;

    stack.push_undo(UndoEntry {
        label: "edit Session".to_string(),
        inverse: inverse_complete,
        forward,
    });

    Ok(())
}

fn ids_for_dates(conn: &Connection, dates: &[String]) -> Result<Vec<String>> {
    if dates.is_empty() {
        return Ok(Vec::new());
    }
    // Build "?,?,..." for the IN clause.
    let placeholders = vec!["?"; dates.len()].join(",");
    let sql = format!(
        "SELECT id FROM sessions WHERE date_key IN ({})",
        placeholders
    );
    let mut stmt = conn.prepare(&sql)?;
    let params: Vec<&dyn rusqlite::ToSql> =
        dates.iter().map(|d| d as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(params), |row| row.get::<_, String>(0))?;
    let mut ids = Vec::new();
    for r in rows {
        ids.push(r?);
    }
    Ok(ids)
}

/// Wrap `session_store::toggle_done`. Capture the row's done flag
/// + updated_at into a snapshot, flip it, capture the post-state,
/// push.
pub fn toggle_done_with_undo(
    conn: &mut Connection,
    stack: &mut UndoStack,
    id: &str,
) -> Result<()> {
    let inverse = capture(conn, &[id])?;
    session_store::toggle_done(conn, id)?;
    let forward = capture(conn, &[id])?;

    stack.push_undo(UndoEntry {
        label: "toggle Session done".to_string(),
        inverse,
        forward,
    });

    Ok(())
}

/// Wrap `session_store::delete_session`: capture the row + its
/// adjustments first, then delete. Undo re-inserts both tables.
pub fn delete_session_with_undo(
    conn: &mut Connection,
    stack: &mut UndoStack,
    id: &str,
) -> Result<()> {
    let inverse = capture(conn, &[id])?;
    session_store::delete_session(conn, id)?;
    let forward = capture(conn, &[id])?;

    stack.push_undo(UndoEntry {
        label: "delete Session".to_string(),
        inverse,
        forward,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

/// Undo the most recent mutation. Returns `Ok(Some(label))` with the
/// entry's label so the UI can show a "Undid: <label>" toast, or
/// `Ok(None)` if there was nothing to undo.
pub fn undo(conn: &mut Connection, stack: &mut UndoStack) -> Result<Option<String>> {
    let entry = match stack.undo.pop_back() {
        Some(e) => e,
        None => return Ok(None),
    };

    restore(conn, &entry.inverse)?;

    let label = entry.label.clone();
    if stack.redo.len() == MAX_DEPTH {
        stack.redo.pop_front();
    }
    stack.redo.push_back(entry);
    Ok(Some(label))
}

/// Redo the most recently undone mutation. Returns `Ok(Some(label))`
/// or `Ok(None)` if there was nothing to redo.
pub fn redo(conn: &mut Connection, stack: &mut UndoStack) -> Result<Option<String>> {
    let entry = match stack.redo.pop_back() {
        Some(e) => e,
        None => return Ok(None),
    };

    restore(conn, &entry.forward)?;

    let label = entry.label.clone();
    if stack.undo.len() == MAX_DEPTH {
        stack.undo.pop_front();
    }
    stack.undo.push_back(entry);
    Ok(Some(label))
}
