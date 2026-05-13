//! Behaviour tests for `session_store`. Each test starts from a
//! fresh in-memory SQLite, so there's no cross-test state.

use rusqlite::Connection;
use scheduler::db::apply_migrations;
use scheduler::session_store::{add_session, list_sessions, SessionInput};

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

#[test]
fn add_session_writes_a_row_with_the_supplied_fields_and_returns_its_id() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let id = add_session(
        &conn,
        SessionInput {
            date_key: "2026-05-13".to_string(),
            category: "animation".to_string(),
            label: "LR · AI Animation".to_string(),
            start_min: 480,
            end_min: 660,
            notes: Some("warm-up scene".to_string()),
        },
    )
    .unwrap();

    assert!(!id.is_empty(), "id must be non-empty");

    let (date_key, category, label, start_min, end_min, notes, done, adjusted): (
        String,
        String,
        String,
        i64,
        i64,
        Option<String>,
        i64,
        i64,
    ) = conn
        .query_row(
            "SELECT date_key, category, label, start_min, end_min, notes, done, adjusted \
             FROM sessions WHERE id = ?",
            [&id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                ))
            },
        )
        .unwrap();

    assert_eq!(date_key, "2026-05-13");
    assert_eq!(category, "animation");
    assert_eq!(label, "LR · AI Animation");
    assert_eq!(start_min, 480);
    assert_eq!(end_min, 660);
    assert_eq!(notes, Some("warm-up scene".to_string()));
    assert_eq!(done, 0);
    assert_eq!(adjusted, 0);
}

#[test]
fn add_session_returns_distinct_ids_for_distinct_inserts() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let id1 = add_session(&conn, mk("2026-05-13", "workflow", "x", 540, 600)).unwrap();
    let id2 = add_session(&conn, mk("2026-05-13", "workflow", "y", 600, 660)).unwrap();

    assert_ne!(id1, id2);
}

#[test]
fn list_sessions_returns_only_rows_with_date_key_in_range() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    add_session(&conn, mk("2025-01-12", "animation", "before", 540, 600)).unwrap();
    add_session(&conn, mk("2025-01-13", "animation", "inside-1", 540, 600)).unwrap();
    add_session(&conn, mk("2025-01-15", "workflow", "inside-2", 720, 780)).unwrap();
    add_session(&conn, mk("2025-01-19", "cornerman", "inside-3", 480, 540)).unwrap();
    add_session(&conn, mk("2025-01-20", "cornerman", "after", 480, 540)).unwrap();

    let week = list_sessions(&conn, "2025-01-13", "2025-01-19").unwrap();
    let labels: Vec<&str> = week.iter().map(|s| s.label.as_str()).collect();
    assert_eq!(labels, vec!["inside-1", "inside-2", "inside-3"]);
}

#[test]
fn list_sessions_orders_by_date_then_start_min() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    // Insert deliberately out of order — list should sort them.
    add_session(&conn, mk("2025-01-15", "workflow", "wed-late", 900, 960)).unwrap();
    add_session(&conn, mk("2025-01-13", "animation", "mon-late", 540, 600)).unwrap();
    add_session(&conn, mk("2025-01-13", "animation", "mon-early", 480, 540)).unwrap();
    add_session(&conn, mk("2025-01-15", "workflow", "wed-early", 540, 600)).unwrap();

    let week = list_sessions(&conn, "2025-01-13", "2025-01-19").unwrap();
    let labels: Vec<&str> = week.iter().map(|s| s.label.as_str()).collect();
    assert_eq!(labels, vec!["mon-early", "mon-late", "wed-early", "wed-late"]);
}

#[test]
fn list_sessions_returns_empty_vec_when_no_rows_match() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();
    add_session(&conn, mk("2025-01-13", "animation", "alone", 540, 600)).unwrap();

    let empty = list_sessions(&conn, "2025-02-01", "2025-02-07").unwrap();
    assert_eq!(empty.len(), 0);
}
