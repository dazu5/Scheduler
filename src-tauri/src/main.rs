// Tauri 2 binary entry. Wires up the SQLite-init side-effect on app
// startup, stashes the Connection as Tauri-managed state, and
// registers the slice #3/#4 commands. Keeping `tauri` out of
// `lib.rs` means `cargo test --tests` doesn't have to compile the
// tauri crate tree.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use rusqlite::Connection;
use scheduler::session_store::{self, Session, SessionInput, UpdateSessionInput};
use tauri::{Manager, State};

struct DbState(Mutex<Connection>);

#[tauri::command]
fn add_session(state: State<DbState>, input: SessionInput) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    session_store::add_session(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_sessions(
    state: State<DbState>,
    start: String,
    end: String,
) -> Result<Vec<Session>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    session_store::list_sessions(&conn, &start, &end).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_session(
    state: State<DbState>,
    id: String,
    input: UpdateSessionInput,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    session_store::update_session(&mut conn, &id, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_session(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    session_store::delete_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_done(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    session_store::toggle_done(&conn, &id).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_session,
            list_sessions,
            update_session,
            delete_session,
            toggle_done,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
