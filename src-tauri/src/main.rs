// Tauri 2 binary entry. Wires up the SQLite-init side-effect on app
// startup, stashes the Connection as Tauri-managed state, and
// registers the slice #3/#4 commands. Keeping `tauri` out of
// `lib.rs` means `cargo test --tests` doesn't have to compile the
// tauri crate tree.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use rusqlite::Connection;
use scheduler::migration::{self, ImportSummary};
use scheduler::off_days::{self, OffDay};
use scheduler::session_store::{self, Session, SessionInput, UpdateSessionInput};
use scheduler::undo_stack::{self, UndoStack};
use tauri::{Manager, State};

struct DbState(Mutex<Connection>);
struct UndoState(Mutex<UndoStack>);

#[tauri::command]
fn add_session(
    db: State<DbState>,
    undo_state: State<UndoState>,
    input: SessionInput,
) -> Result<String, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::add_session_with_undo(&mut conn, &mut stack, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sessions(
    db: State<DbState>,
    start: String,
    end: String,
) -> Result<Vec<Session>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    session_store::list_sessions(&conn, &start, &end).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_session(
    db: State<DbState>,
    undo_state: State<UndoState>,
    id: String,
    input: UpdateSessionInput,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::update_session_with_undo(&mut conn, &mut stack, &id, input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_session(
    db: State<DbState>,
    undo_state: State<UndoState>,
    id: String,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::delete_session_with_undo(&mut conn, &mut stack, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_done(
    db: State<DbState>,
    undo_state: State<UndoState>,
    id: String,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::toggle_done_with_undo(&mut conn, &mut stack, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn undo(db: State<DbState>, undo_state: State<UndoState>) -> Result<Option<String>, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::undo(&mut conn, &mut stack).map_err(|e| e.to_string())
}

#[tauri::command]
fn redo(db: State<DbState>, undo_state: State<UndoState>) -> Result<Option<String>, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stack = undo_state.0.lock().map_err(|e| e.to_string())?;
    undo_stack::redo(&mut conn, &mut stack).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_json(state: State<DbState>, json: String) -> Result<ImportSummary, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    migration::import_json(&mut conn, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_json_from_path(state: State<DbState>, path: String) -> Result<ImportSummary, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    migration::import_json_from_path(&mut conn, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_onboarded(state: State<DbState>) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    migration::has_onboarded(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_onboarded(state: State<DbState>, value: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    migration::set_onboarded(&conn, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn mark_day_off(state: State<DbState>, date_key: String, reason: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    off_days::mark_day_off(&conn, &date_key, &reason).map_err(|e| e.to_string())
}

#[tauri::command]
fn unmark_day_off(state: State<DbState>, date_key: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    off_days::unmark_day_off(&conn, &date_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_off_days(state: State<DbState>, start: String, end: String) -> Result<Vec<OffDay>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    off_days::list_off_days(&conn, &start, &end).map_err(|e| e.to_string())
}

/// Write `content` to `path` UTF-8. Used by the CSV / JSON export
/// buttons; the frontend opens a save dialog via plugin-dialog and
/// hands the chosen path here. Kept dumb on purpose — no validation
/// beyond "the OS can open it for write" so the user can target any
/// location they like.
#[tauri::command]
fn export_to_path(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// Show the always-on-top pill window — issue #9. The window is
/// pre-created (and hidden) by tauri.conf.json, so we just have to
/// flip its visibility.
#[tauri::command]
fn show_pill(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("pill") {
        w.show().map_err(|e| e.to_string())?;
        w.set_always_on_top(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the pill window. Idempotent — calling on an already-hidden
/// window is a no-op.
#[tauri::command]
fn hide_pill(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("pill") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Bring the main window to the foreground from the pill click.
#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve %APPDATA%/Scheduler");
            std::fs::create_dir_all(&data_dir).ok();

            let db_path = data_dir.join("scheduler.db");
            let conn = Connection::open(&db_path).expect("open SQLite database");
            scheduler::db::apply_migrations(&conn).expect("apply migrations");

            app.manage(DbState(Mutex::new(conn)));
            app.manage(UndoState(Mutex::new(UndoStack::new())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_session,
            list_sessions,
            update_session,
            delete_session,
            toggle_done,
            undo,
            redo,
            import_json,
            import_json_from_path,
            has_onboarded,
            set_onboarded,
            mark_day_off,
            unmark_day_off,
            list_off_days,
            export_to_path,
            show_pill,
            hide_pill,
            focus_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
