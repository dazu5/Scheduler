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

#[test]
fn migrations_create_sessions_table_with_documented_columns() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    apply_migrations(&conn).expect("apply migrations");

    let documented = [
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
    ];

    let quoted: Vec<String> = documented.iter().map(|c| format!("'{}'", c)).collect();
    let sql = format!(
        "SELECT count(*) FROM pragma_table_info('sessions') WHERE name IN ({})",
        quoted.join(",")
    );

    let present: i64 = conn
        .query_row(&sql, [], |row| row.get(0))
        .expect("query sessions schema");

    assert_eq!(
        present,
        documented.len() as i64,
        "sessions table must contain all {} documented columns",
        documented.len()
    );
}
