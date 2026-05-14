//! Off-Days store — slice #7.
//!
//! Mark-day-off / unmark-day-off / list-off-days against the
//! `off_days` table that landed with #12's schema work. Off-Days
//! contribute zero hours to pace expected and zero to per-Category
//! totals (the JS `summarize.summarizeLogged` + `pace.computePace`
//! already accept an `OffDayContext` that the frontend will populate
//! from `list_off_days`).
//!
//! `mark_day_off` is implemented as `INSERT OR REPLACE` so re-marking
//! an already-off Day with a new reason updates it rather than failing.

use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OffDay {
    pub date_key: String,
    pub reason: String,
    pub created_at: i64,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Mark `date_key` as an off-Day with the given reason. Re-marking an
/// already-off Day updates the reason.
pub fn mark_day_off(conn: &Connection, date_key: &str, reason: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO off_days (date_key, reason, created_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(date_key) DO UPDATE SET reason = excluded.reason",
        params![date_key, reason, now_secs()],
    )?;
    Ok(())
}

/// Unmark `date_key`. Idempotent — unmarking a Day that wasn't off is
/// a no-op (returns Ok with rows-affected = 0).
pub fn unmark_day_off(conn: &Connection, date_key: &str) -> Result<()> {
    conn.execute("DELETE FROM off_days WHERE date_key = ?1", params![date_key])?;
    Ok(())
}

/// Return every off-Day with `date_key` in `[start, end]` inclusive,
/// sorted by `date_key`.
pub fn list_off_days(conn: &Connection, start: &str, end: &str) -> Result<Vec<OffDay>> {
    let mut stmt = conn.prepare(
        "SELECT date_key, reason, created_at FROM off_days
         WHERE date_key BETWEEN ?1 AND ?2
         ORDER BY date_key",
    )?;
    let rows = stmt.query_map(params![start, end], |row| {
        Ok(OffDay {
            date_key: row.get(0)?,
            reason: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::apply_migrations;

    fn fresh() -> Connection {
        let conn = Connection::open_in_memory().expect("open db");
        apply_migrations(&conn).expect("apply migrations");
        conn
    }

    #[test]
    fn mark_then_list_returns_the_off_day() {
        let conn = fresh();
        mark_day_off(&conn, "2026-05-14", "sick").unwrap();
        let days = list_off_days(&conn, "2026-05-11", "2026-05-17").unwrap();
        assert_eq!(days.len(), 1);
        assert_eq!(days[0].date_key, "2026-05-14");
        assert_eq!(days[0].reason, "sick");
    }

    #[test]
    fn re_marking_updates_the_reason_in_place() {
        let conn = fresh();
        mark_day_off(&conn, "2026-05-14", "sick").unwrap();
        mark_day_off(&conn, "2026-05-14", "personal").unwrap();
        let days = list_off_days(&conn, "2026-05-14", "2026-05-14").unwrap();
        assert_eq!(days.len(), 1, "no duplicate row created");
        assert_eq!(days[0].reason, "personal");
    }

    #[test]
    fn unmark_removes_the_row() {
        let conn = fresh();
        mark_day_off(&conn, "2026-05-14", "sick").unwrap();
        unmark_day_off(&conn, "2026-05-14").unwrap();
        assert!(list_off_days(&conn, "2026-05-14", "2026-05-14").unwrap().is_empty());
    }

    #[test]
    fn unmark_is_idempotent_when_day_was_not_off() {
        let conn = fresh();
        unmark_day_off(&conn, "2026-05-14").unwrap();
        // No panic — that's the whole assertion.
    }

    #[test]
    fn list_filters_by_inclusive_range_and_sorts_by_date_key() {
        let conn = fresh();
        mark_day_off(&conn, "2026-05-13", "a").unwrap();
        mark_day_off(&conn, "2026-05-15", "b").unwrap();
        mark_day_off(&conn, "2026-05-20", "c").unwrap(); // out of range
        let days = list_off_days(&conn, "2026-05-13", "2026-05-15").unwrap();
        assert_eq!(days.iter().map(|d| d.date_key.as_str()).collect::<Vec<_>>(),
                   vec!["2026-05-13", "2026-05-15"]);
    }
}
