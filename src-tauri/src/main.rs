// Tauri 2 binary entry. Wires up the SQLite-init side-effect on
// app startup, then hands control to the Tauri builder. Keeping
// the `tauri` dependency out of `lib.rs` means `cargo test --test
// migration` doesn't have to compile the tauri crate tree.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::Connection;
use tauri::Manager;

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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
