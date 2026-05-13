//! Migration command — persists a parsed v2/v3/v4 `weekly_scheduler.html`
//! JSON payload into the `sessions` and `off_days` tables.
//!
//! The TS module `src/shared/migration.ts` owns the shape-coercion +
//! v3→v4 `tag → category` rename and is exercised by vitest. The
//! Rust side's job is persistence + idempotency: a single transaction
//! inserts every Session row with `INSERT OR IGNORE` on the primary
//! key so re-imports of the same payload never duplicate. Off-Days
//! are also inserted with `INSERT OR REPLACE` keyed on `date_key`.
//!
//! `has_onboarded` / `set_onboarded` back the first-launch detection.
//! A single key `onboarded` lives in the `kv` table.

use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

const ONBOARDED_KEY: &str = "onboarded";

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub sessions: i64,
    pub off_days: i64,
}

#[derive(Debug, Deserialize)]
struct RawSession {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    category: Option<String>,
    /// v3 legacy — renamed to `category` in v4. Either field can
    /// appear; if both are present, `category` wins.
    #[serde(default)]
    tag: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default, rename = "startMin")]
    start_min: Option<i64>,
    #[serde(default, rename = "endMin")]
    end_min: Option<i64>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    done: Option<bool>,
    #[serde(default)]
    adjusted: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RawOffDay {
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawPayload {
    #[serde(default)]
    days: Option<std::collections::HashMap<String, Vec<RawSession>>>,
    #[serde(default, rename = "offDays")]
    off_days: Option<std::collections::HashMap<String, RawOffDay>>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis() as i64
}

/// Parse and persist a v4 (or legacy v3 / v2) localStorage payload
/// from `weekly_scheduler.html`. Returns the count of rows actually
/// inserted (i.e. on re-import with the same payload, both counts
/// will be zero because `INSERT OR IGNORE` skips existing primary
/// keys).
pub fn import_json(conn: &mut Connection, json: &str) -> Result<ImportSummary> {
    let payload: RawPayload = serde_json::from_str(json).map_err(|e| {
        rusqlite::Error::InvalidParameterName(format!("invalid json: {}", e))
    })?;

    let tx = conn.transaction()?;
    let now = now_ms();

    let mut session_count: i64 = 0;
    if let Some(days) = payload.days {
        for (date_key, sessions) in days {
            for (index, raw) in sessions.into_iter().enumerate() {
                let id = raw.id.unwrap_or_else(|| format!("{}-{}", date_key, index));
                // v3 → v4 rename: prefer `category`, fall back to `tag`.
                let category = raw
                    .category
                    .or(raw.tag)
                    .unwrap_or_else(|| "animation".to_string());
                let label = raw.label.unwrap_or_default();
                let start_min = raw.start_min.unwrap_or(0);
                let end_min = raw.end_min.unwrap_or(0);
                let notes = raw.notes.unwrap_or_default();
                let done = raw.done.unwrap_or(false);
                let adjusted = raw.adjusted.unwrap_or(false);

                let inserted = tx.execute(
                    "INSERT OR IGNORE INTO sessions \
                     (id, date_key, category, label, start_min, end_min, notes, done, adjusted, created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        id,
                        date_key,
                        category,
                        label,
                        start_min,
                        end_min,
                        notes,
                        done as i64,
                        adjusted as i64,
                        now,
                        now,
                    ],
                )?;
                session_count += inserted as i64;
            }
        }
    }

    let mut off_day_count: i64 = 0;
    if let Some(off_days) = payload.off_days {
        for (date_key, raw) in off_days {
            let reason = raw
                .reason
                .map(|r| r.trim().to_string())
                .filter(|r| !r.is_empty())
                .unwrap_or_else(|| "No reason given".to_string());

            let inserted = tx.execute(
                "INSERT OR IGNORE INTO off_days (date_key, reason, created_at) VALUES (?, ?, ?)",
                params![date_key, reason, now],
            )?;
            off_day_count += inserted as i64;
        }
    }

    tx.commit()?;

    Ok(ImportSummary {
        sessions: session_count,
        off_days: off_day_count,
    })
}

/// Same as `import_json` but reads the JSON from `path` first. The
/// onboarding modal hands us the user-picked filesystem path so the
/// JS side never has to negotiate the `plugin-fs` allowlist —
/// dialog-only is enough.
pub fn import_json_from_path(conn: &mut Connection, path: &str) -> Result<ImportSummary> {
    let contents = std::fs::read_to_string(path).map_err(|e| {
        rusqlite::Error::InvalidParameterName(format!("read {}: {}", path, e))
    })?;
    import_json(conn, &contents)
}

/// Has the user been shown (and dismissed or completed) the
/// first-launch onboarding prompt? Stored as the string `"true"` in
/// the `kv` table under key `onboarded`. Absence of the row counts
/// as `false`.
pub fn has_onboarded(conn: &Connection) -> Result<bool> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM kv WHERE key = ?",
            [ONBOARDED_KEY],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value.as_deref() == Some("true"))
}

/// Record that onboarding has been completed (or explicitly skipped).
pub fn set_onboarded(conn: &Connection, value: bool) -> Result<()> {
    let v = if value { "true" } else { "false" };
    conn.execute(
        "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
        params![ONBOARDED_KEY, v],
    )?;
    Ok(())
}
