//! Activity tracker — slice #11.
//!
//! In-memory per-day **counts only** of keystrokes and mouse clicks.
//! Privacy is the entire point of this module:
//!
//!   - We never store which keys were pressed (no key identity).
//!   - We never read the clipboard.
//!   - We never read the foreground app, window title, or URL.
//!   - We never take screenshots.
//!   - We never persist to disk in this slice (counters reset on
//!     app restart). Persistence comes with the activity-samples
//!     table in a later slice.
//!
//! The struct surface below is the contract. The privacy pinning
//! test at the bottom of this module asserts that `ActivityCounts`
//! contains exactly two numeric fields + a date key — no string
//! field, no list, no map, no nothing. If a future commit tries to
//! add `last_key: Option<char>` or similar, the pinning test will
//! fail at compile or assertion time and force a code-review of
//! the privacy boundary.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;

/// Per-Day counts. The only fields are numeric counters + the date key.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityCounts {
    pub date_key: String,
    pub keystrokes: u64,
    pub clicks: u64,
}

/// Tauri-managed state. `HashMap<dateKey, ActivityCounts>`.
#[derive(Default)]
pub struct ActivityState(pub Mutex<HashMap<String, ActivityCounts>>);

fn entry<'a>(
    map: &'a mut HashMap<String, ActivityCounts>,
    date_key: &str,
) -> &'a mut ActivityCounts {
    map.entry(date_key.to_string())
        .or_insert_with(|| ActivityCounts {
            date_key: date_key.to_string(),
            keystrokes: 0,
            clicks: 0,
        })
}

pub fn tick_keystroke(state: &ActivityState, date_key: &str) {
    let mut map = state.0.lock().expect("activity lock poisoned");
    entry(&mut map, date_key).keystrokes += 1;
}

pub fn tick_click(state: &ActivityState, date_key: &str) {
    let mut map = state.0.lock().expect("activity lock poisoned");
    entry(&mut map, date_key).clicks += 1;
}

pub fn get_counts(state: &ActivityState, date_key: &str) -> ActivityCounts {
    let map = state.0.lock().expect("activity lock poisoned");
    map.get(date_key).cloned().unwrap_or(ActivityCounts {
        date_key: date_key.to_string(),
        keystrokes: 0,
        clicks: 0,
    })
}

pub fn reset_counts(state: &ActivityState, date_key: &str) {
    let mut map = state.0.lock().expect("activity lock poisoned");
    map.remove(date_key);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh() -> ActivityState {
        ActivityState::default()
    }

    #[test]
    fn keystroke_increments_keystrokes_only() {
        let s = fresh();
        tick_keystroke(&s, "2026-05-14");
        tick_keystroke(&s, "2026-05-14");
        let c = get_counts(&s, "2026-05-14");
        assert_eq!(c.keystrokes, 2);
        assert_eq!(c.clicks, 0);
    }

    #[test]
    fn click_increments_clicks_only() {
        let s = fresh();
        tick_click(&s, "2026-05-14");
        let c = get_counts(&s, "2026-05-14");
        assert_eq!(c.keystrokes, 0);
        assert_eq!(c.clicks, 1);
    }

    #[test]
    fn counts_segregate_by_date_key() {
        let s = fresh();
        tick_keystroke(&s, "2026-05-14");
        tick_keystroke(&s, "2026-05-15");
        tick_keystroke(&s, "2026-05-15");
        assert_eq!(get_counts(&s, "2026-05-14").keystrokes, 1);
        assert_eq!(get_counts(&s, "2026-05-15").keystrokes, 2);
    }

    #[test]
    fn get_on_an_unseen_day_returns_a_zero_record() {
        let s = fresh();
        let c = get_counts(&s, "2099-01-01");
        assert_eq!(c.keystrokes, 0);
        assert_eq!(c.clicks, 0);
        assert_eq!(c.date_key, "2099-01-01");
    }

    #[test]
    fn reset_zeros_a_specific_day() {
        let s = fresh();
        tick_click(&s, "2026-05-14");
        reset_counts(&s, "2026-05-14");
        assert_eq!(get_counts(&s, "2026-05-14").clicks, 0);
    }

    /// Privacy pinning test — the entire point of slice #11. If any
    /// future commit adds a field that captures *content* (key
    /// identity, clipboard contents, app names, URLs, screenshot
    /// bytes), the JSON shape changes and this assertion fails.
    /// Reviewers must then explicitly justify the new field.
    #[test]
    fn serialized_shape_carries_only_counts_and_date_key() {
        let c = ActivityCounts {
            date_key: "2026-05-14".to_string(),
            keystrokes: 42,
            clicks: 7,
        };
        let json = serde_json::to_value(&c).expect("serialise");
        let obj = json.as_object().expect("object");
        let mut keys: Vec<&str> = obj.keys().map(|s| s.as_str()).collect();
        keys.sort();
        assert_eq!(
            keys,
            vec!["clicks", "dateKey", "keystrokes"],
            "ActivityCounts must serialise to exactly {{ dateKey, keystrokes, clicks }} — \
             any new field is a privacy boundary change and needs explicit review."
        );
    }
}
