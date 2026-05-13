//! Behaviour tests for the Rust side of issue #12 — the
//! `import_json` IPC command (bulk-insert with idempotency) and the
//! `kv` table that backs the first-launch onboarding flag.
//!
//! Pairs with `src/shared/migration.test.ts` which covers the pure
//! parser. The Rust side's job is persistence + idempotency: it parses
//! the v4 JSON (using the same shape decisions as the TS module),
//! writes Sessions with INSERT OR IGNORE on the primary key so
//! re-imports never produce duplicates, and stashes off-Days for
//! issue #7 to drain.

use rusqlite::Connection;
use scheduler::db::apply_migrations;
use scheduler::migration::{has_onboarded, import_json, import_json_from_path, set_onboarded};

const V4_PAYLOAD: &str = r#"{
  "version": 4,
  "days": {
    "2026-05-13": [
      {
        "id": "sess-1",
        "category": "animation",
        "label": "LR · AI Animation",
        "startMin": 480,
        "endMin": 660,
        "notes": "warm-up",
        "done": true,
        "adjusted": false
      },
      {
        "id": "sess-2",
        "category": "workflow",
        "label": "LR · AI Workflow",
        "startMin": 660,
        "endMin": 780,
        "notes": "",
        "done": false,
        "adjusted": false
      }
    ]
  },
  "offDays": {
    "2026-05-14": { "reason": "sick day" }
  }
}"#;

#[test]
fn import_json_writes_sessions_into_the_sessions_table() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let summary = import_json(&mut conn, V4_PAYLOAD).unwrap();
    assert_eq!(summary.sessions, 2);

    let count: i64 = conn
        .query_row("SELECT count(*) FROM sessions", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 2);

    let (label, category, start_min): (String, String, i64) = conn
        .query_row(
            "SELECT label, category, start_min FROM sessions WHERE id = 'sess-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(label, "LR · AI Animation");
    assert_eq!(category, "animation");
    assert_eq!(start_min, 480);
}

#[test]
fn import_json_is_idempotent_on_re_import_by_session_id() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    import_json(&mut conn, V4_PAYLOAD).unwrap();
    let second = import_json(&mut conn, V4_PAYLOAD).unwrap();

    // The second pass writes zero new Sessions — every id collides
    // with an existing row and is ignored.
    assert_eq!(second.sessions, 0);

    let count: i64 = conn
        .query_row("SELECT count(*) FROM sessions", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 2);
}

#[test]
fn import_json_writes_off_days_into_the_off_days_table_when_present() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let summary = import_json(&mut conn, V4_PAYLOAD).unwrap();
    assert_eq!(summary.off_days, 1);

    let (date_key, reason): (String, String) = conn
        .query_row(
            "SELECT date_key, reason FROM off_days WHERE date_key = '2026-05-14'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(date_key, "2026-05-14");
    assert_eq!(reason, "sick day");
}

#[test]
fn import_json_v3_payload_renames_tag_to_category() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let payload = r#"{
      "version": 3,
      "days": {
        "2025-01-13": [
          { "id": "old-1", "tag": "cornerman", "label": "legacy", "startMin": 540, "endMin": 600 }
        ]
      }
    }"#;

    let summary = import_json(&mut conn, payload).unwrap();
    assert_eq!(summary.sessions, 1);

    let category: String = conn
        .query_row(
            "SELECT category FROM sessions WHERE id = 'old-1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(category, "cornerman");
}

#[test]
fn import_json_from_path_reads_and_imports_the_file_contents() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    // Write a temp file and let import_json_from_path pull it in.
    let dir = std::env::temp_dir();
    let path = dir.join(format!("scheduler-import-test-{}.json", std::process::id()));
    std::fs::write(&path, V4_PAYLOAD).unwrap();

    let summary = import_json_from_path(&mut conn, path.to_str().unwrap()).unwrap();
    assert_eq!(summary.sessions, 2);
    assert_eq!(summary.off_days, 1);

    std::fs::remove_file(&path).ok();
}

#[test]
fn import_json_from_path_errors_on_missing_file() {
    let mut conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    let err = import_json_from_path(&mut conn, "/nonexistent/path/to/sched.json").unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("read") || msg.contains("nonexistent") || msg.contains("No such file"),
        "expected a read error mentioning the path, got: {}",
        msg
    );
}

#[test]
fn has_onboarded_returns_false_before_set_onboarded_is_called() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();
    assert!(!has_onboarded(&conn).unwrap());
}

#[test]
fn set_onboarded_persists_to_the_kv_table_and_round_trips() {
    let conn = Connection::open_in_memory().unwrap();
    apply_migrations(&conn).unwrap();

    set_onboarded(&conn, true).unwrap();
    assert!(has_onboarded(&conn).unwrap());

    set_onboarded(&conn, false).unwrap();
    assert!(!has_onboarded(&conn).unwrap());
}
