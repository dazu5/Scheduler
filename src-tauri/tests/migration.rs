//! Behaviour test for the initial migration.
//!
//! Asserts the post-condition that downstream code (session_store,
//! adjustments writer, activity flush) will rely on: the `sessions`
//! table exists and contains the 12 documented columns. Deliberately
//! avoids asserting column order, types, defaults, or any internal
//! migration metadata — those are implementation details and would
//! make the test brittle to schema refactors that preserve behaviour.

use rusqlite::Connection;
use scheduler::db::apply_migrations;

fn assert_table_has_columns(conn: &Connection, table: &str, columns: &[&str]) {
    let quoted: Vec<String> = columns.iter().map(|c| format!("'{}'", c)).collect();
    let sql = format!(
        "SELECT count(*) FROM pragma_table_info('{}') WHERE name IN ({})",
        table,
        quoted.join(",")
    );
    let present: i64 = conn
        .query_row(&sql, [], |row| row.get(0))
        .unwrap_or_else(|e| panic!("query {} schema: {}", table, e));
    assert_eq!(
        present,
        columns.len() as i64,
        "{} table must contain all {} documented columns",
        table,
        columns.len()
    );
}

#[test]
fn migrations_create_sessions_table_with_documented_columns() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    apply_migrations(&conn).expect("apply migrations");

    assert_table_has_columns(
        &conn,
        "sessions",
        &[
            "id",
            "date_key",
            "category",
            "label",
            "start_min",
            "end_min",
            "notes",
            "done",
            "adjusted",
            "overnight_link_id",
            "created_at",
            "updated_at",
        ],
    );
}

#[test]
fn migrations_create_adjustments_table_for_audit_log() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    apply_migrations(&conn).expect("apply migrations");

    assert_table_has_columns(
        &conn,
        "adjustments",
        &[
            "id",
            "session_id",
            "field",
            "old_value",
            "new_value",
            "changed_at",
            "reason",
        ],
    );
}

#[test]
fn migrations_are_idempotent_when_applied_twice() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();
    apply_migrations(&conn).expect("second apply should be a no-op");
}
