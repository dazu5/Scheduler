//! Behaviour tests for `undo_stack`. Each test starts from a fresh
//! in-memory SQLite and a fresh `UndoStack`. The wrapped mutators
//! push an inverse-snapshot onto a 50-deep deque; the redo stack
//! clears on any new mutation.

use rusqlite::Connection;
use scheduler::db::apply_migrations;
use scheduler::session_store::{
    add_session, list_sessions, update_session, AuditEntry, OvernightSpill, SessionInput,
    UpdateSessionInput,
};
use scheduler::undo_stack::{
    add_session_with_undo, delete_session_with_undo, redo, toggle_done_with_undo, undo,
    update_session_with_undo, UndoStack,
};

fn mk(date_key: &str, category: &str, label: &str, start_min: i64, end_min: i64) -> SessionInput {
    SessionInput {
        date_key: date_key.to_string(),
        category: category.to_string(),
        label: label.to_string(),
        start_min,
        end_min,
        notes: None,
    }
}

fn fresh_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();
    conn
}

#[test]
fn undo_after_add_removes_the_inserted_row_and_labels_it() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    let id = add_session_with_undo(
        &mut conn,
        &mut stack,
        mk("2026-05-13", "animation", "ephemeral", 540, 600),
    )
    .unwrap();

    assert_eq!(stack.undo_depth(), 1, "the add pushed an inverse onto the undo stack");

    let label = undo(&mut conn, &mut stack).unwrap().expect("undo had work to do");
    assert_eq!(
        label, "add Session",
        "the entry's label is what gets shown in the 'Undid: …' toast"
    );

    let row_count: i64 = conn
        .query_row("SELECT count(*) FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(row_count, 0, "the previously-added session is gone after undo");

    assert_eq!(stack.undo_depth(), 0, "undo consumes from the undo stack");
    assert_eq!(stack.redo_depth(), 1, "and pushes onto the redo stack");
}

#[test]
fn redo_after_undo_of_add_re_inserts_the_session() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    add_session_with_undo(
        &mut conn,
        &mut stack,
        mk("2026-05-13", "animation", "redo-me", 540, 600),
    )
    .unwrap();
    undo(&mut conn, &mut stack).unwrap();
    assert_eq!(list_sessions(&conn, "2026-05-13", "2026-05-13").unwrap().len(), 0);

    let label = redo(&mut conn, &mut stack).unwrap().expect("redo had work to do");
    assert_eq!(label, "add Session");

    let sessions = list_sessions(&conn, "2026-05-13", "2026-05-13").unwrap();
    assert_eq!(sessions.len(), 1, "redo brings the row back");
    assert_eq!(sessions[0].label, "redo-me");
}

#[test]
fn undo_after_delete_restores_the_session_and_its_adjustments() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    // Pre-seed a session and an audit row by calling update with
    // audit entries — these MUST come back when we undo the delete.
    let id = add_session(&conn, mk("2026-05-13", "animation", "original", 540, 600)).unwrap();
    update_session(
        &mut conn,
        &id,
        UpdateSessionInput {
            category: "animation".to_string(),
            label: "renamed".to_string(),
            start_min: 540,
            end_min: 600,
            notes: None,
            audit: vec![AuditEntry {
                field: "label".to_string(),
                old_value: Some("original".to_string()),
                new_value: Some("renamed".to_string()),
            }],
            overnight_spill: None,
        },
    )
    .unwrap();

    delete_session_with_undo(&mut conn, &mut stack, &id).unwrap();
    assert_eq!(
        conn.query_row::<i64, _, _>("SELECT count(*) FROM sessions WHERE id = ?", [&id], |r| r.get(0))
            .unwrap(),
        0,
        "session is gone after the delete",
    );

    let label = undo(&mut conn, &mut stack).unwrap().expect("had work");
    assert_eq!(label, "delete Session");

    let restored_label: String = conn
        .query_row("SELECT label FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(restored_label, "renamed");

    let audit_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM adjustments WHERE session_id = ?",
            [&id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(audit_count, 1, "the cascaded audit row was restored");
}

#[test]
fn undo_after_update_restores_prior_session_fields_and_drops_new_audit_rows() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    let id = add_session(&conn, mk("2026-05-13", "animation", "before", 540, 600)).unwrap();

    update_session_with_undo(
        &mut conn,
        &mut stack,
        &id,
        UpdateSessionInput {
            category: "animation".to_string(),
            label: "after".to_string(),
            start_min: 540,
            end_min: 660,
            notes: None,
            audit: vec![
                AuditEntry {
                    field: "label".to_string(),
                    old_value: Some("before".to_string()),
                    new_value: Some("after".to_string()),
                },
                AuditEntry {
                    field: "endMin".to_string(),
                    old_value: Some("600".to_string()),
                    new_value: Some("660".to_string()),
                },
            ],
            overnight_spill: None,
        },
    )
    .unwrap();

    let label = undo(&mut conn, &mut stack).unwrap().expect("had work");
    assert_eq!(label, "edit Session");

    let (label_now, end_now, adjusted_now): (String, i64, i64) = conn
        .query_row(
            "SELECT label, end_min, adjusted FROM sessions WHERE id = ?",
            [&id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(label_now, "before");
    assert_eq!(end_now, 600);
    assert_eq!(adjusted_now, 0, "the adjusted flag is rewound to its pre-edit value");

    let audit_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM adjustments WHERE session_id = ?",
            [&id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(audit_count, 0, "audit rows written by the update are gone");
}

#[test]
fn undo_after_update_with_overnight_spill_drops_the_spill_session() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    let id = add_session(&conn, mk("2026-05-13", "animation", "evening", 1080, 1200)).unwrap();

    update_session_with_undo(
        &mut conn,
        &mut stack,
        &id,
        UpdateSessionInput {
            category: "animation".to_string(),
            label: "evening".to_string(),
            start_min: 1080,
            end_min: 1440,
            notes: None,
            audit: vec![AuditEntry {
                field: "endMin".to_string(),
                old_value: Some("1200".to_string()),
                new_value: Some("1440".to_string()),
            }],
            overnight_spill: Some(OvernightSpill {
                next_date_key: "2026-05-14".to_string(),
                end_min: 60,
            }),
        },
    )
    .unwrap();

    let two_day = list_sessions(&conn, "2026-05-13", "2026-05-14").unwrap();
    assert_eq!(two_day.len(), 2, "edit produced the spill");

    undo(&mut conn, &mut stack).unwrap().expect("had work");

    let after_undo = list_sessions(&conn, "2026-05-13", "2026-05-14").unwrap();
    assert_eq!(after_undo.len(), 1, "the spill session is gone");
    assert_eq!(after_undo[0].id, id);
    assert_eq!(after_undo[0].end_min, 1200, "the original end is restored");
    assert!(
        after_undo[0].overnight_link_id.is_none(),
        "the overnight_link_id on the original is cleared on undo"
    );
}

#[test]
fn undo_after_toggle_done_flips_the_done_flag_back() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();
    let id = add_session(&conn, mk("2026-05-13", "workflow", "task", 540, 600)).unwrap();

    toggle_done_with_undo(&mut conn, &mut stack, &id).unwrap();
    let done_after: i64 = conn
        .query_row("SELECT done FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(done_after, 1, "toggle flipped done -> 1");

    let label = undo(&mut conn, &mut stack).unwrap().expect("had work");
    assert_eq!(label, "toggle Session done");

    let done_undone: i64 = conn
        .query_row("SELECT done FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(done_undone, 0, "undo flipped it back to 0");
}

#[test]
fn after_fifty_mutations_the_deque_caps_and_the_oldest_entry_evicts() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    // 51 adds — the first one (ids[0]) should be evicted from the
    // stack once entry 51 lands.
    let mut ids: Vec<String> = Vec::new();
    for i in 0..51 {
        // pick start_min within [0, 1380] so end_min stays <= 1440
        let start = (i % 23) * 60; // 0, 60, 120, ..., 1320, then wraps
        let id = add_session_with_undo(
            &mut conn,
            &mut stack,
            mk(
                "2026-05-13",
                "animation",
                &format!("task-{}", i),
                start as i64,
                (start + 30) as i64,
            ),
        )
        .unwrap();
        ids.push(id);
    }
    assert_eq!(stack.undo_depth(), 50, "the deque saturates at 50");

    // Drain 50 undos — LIFO pops tasks 50, 49, ..., 1. task-0 was
    // evicted on entry 51's push and therefore stays in the DB.
    for _ in 0..50 {
        undo(&mut conn, &mut stack).unwrap();
    }
    assert_eq!(stack.undo_depth(), 0, "every recorded undo was applied");
    assert_eq!(
        undo(&mut conn, &mut stack).unwrap(),
        None,
        "an extra undo with an empty stack is a no-op",
    );

    let oldest_row: i64 = conn
        .query_row("SELECT count(*) FROM sessions WHERE id = ?", [&ids[0]], |r| r.get(0))
        .unwrap();
    assert_eq!(
        oldest_row, 1,
        "task-0 survives because its undo entry was evicted",
    );
}

#[test]
fn a_new_mutation_after_an_undo_clears_the_redo_stack() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    add_session_with_undo(&mut conn, &mut stack, mk("2026-05-13", "animation", "a", 540, 600))
        .unwrap();
    add_session_with_undo(&mut conn, &mut stack, mk("2026-05-13", "animation", "b", 600, 660))
        .unwrap();
    undo(&mut conn, &mut stack).unwrap(); // pops "b"
    assert_eq!(stack.redo_depth(), 1, "undo pushed onto redo");

    // New mutation MUST clear the redo stack.
    add_session_with_undo(&mut conn, &mut stack, mk("2026-05-13", "animation", "c", 660, 720))
        .unwrap();
    assert_eq!(stack.redo_depth(), 0, "any new mutation clears redo");

    // Redo is now a no-op.
    assert_eq!(redo(&mut conn, &mut stack).unwrap(), None);
}

#[test]
fn every_session_store_mutator_pushes_onto_the_undo_stack() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    // 1. add
    let id = add_session_with_undo(
        &mut conn,
        &mut stack,
        mk("2026-05-13", "animation", "x", 540, 600),
    )
    .unwrap();
    assert_eq!(stack.undo_depth(), 1, "add pushes");

    // 2. update
    update_session_with_undo(
        &mut conn,
        &mut stack,
        &id,
        UpdateSessionInput {
            category: "animation".to_string(),
            label: "x2".to_string(),
            start_min: 540,
            end_min: 600,
            notes: None,
            audit: vec![AuditEntry {
                field: "label".to_string(),
                old_value: Some("x".to_string()),
                new_value: Some("x2".to_string()),
            }],
            overnight_spill: None,
        },
    )
    .unwrap();
    assert_eq!(stack.undo_depth(), 2, "update pushes");

    // 3. toggle_done
    toggle_done_with_undo(&mut conn, &mut stack, &id).unwrap();
    assert_eq!(stack.undo_depth(), 3, "toggle_done pushes");

    // 4. delete
    delete_session_with_undo(&mut conn, &mut stack, &id).unwrap();
    assert_eq!(stack.undo_depth(), 4, "delete pushes");
}

#[test]
fn undo_with_empty_stack_is_a_safe_no_op() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();
    let result = undo(&mut conn, &mut stack).unwrap();
    assert_eq!(result, None);
}

#[test]
fn redo_with_empty_stack_is_a_safe_no_op() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();
    let result = redo(&mut conn, &mut stack).unwrap();
    assert_eq!(result, None);
}

#[test]
fn redo_after_undo_of_update_re_applies_the_edit() {
    let mut conn = fresh_db();
    let mut stack = UndoStack::new();

    let id = add_session(&conn, mk("2026-05-13", "animation", "before", 540, 600)).unwrap();

    update_session_with_undo(
        &mut conn,
        &mut stack,
        &id,
        UpdateSessionInput {
            category: "animation".to_string(),
            label: "after".to_string(),
            start_min: 540,
            end_min: 660,
            notes: None,
            audit: vec![AuditEntry {
                field: "label".to_string(),
                old_value: Some("before".to_string()),
                new_value: Some("after".to_string()),
            }],
            overnight_spill: None,
        },
    )
    .unwrap();

    undo(&mut conn, &mut stack).unwrap();
    let post_undo_label: String = conn
        .query_row("SELECT label FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(post_undo_label, "before");

    redo(&mut conn, &mut stack).unwrap();
    let post_redo_label: String = conn
        .query_row("SELECT label FROM sessions WHERE id = ?", [&id], |r| r.get(0))
        .unwrap();
    assert_eq!(post_redo_label, "after");
    let post_redo_audit: i64 = conn
        .query_row(
            "SELECT count(*) FROM adjustments WHERE session_id = ?",
            [&id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(post_redo_audit, 1, "the audit row reappears on redo");
}
