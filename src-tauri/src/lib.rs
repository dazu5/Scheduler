//! Scheduler — Rust backend.
//!
//! See `../ARCHITECTURE.md` and `../PRD.md` at the workspace root for
//! the stack rationale and the v0.1 PRD. The Tauri command surface,
//! tray, pill window, tick task, and activity tracker are introduced
//! in later slices.

pub mod activity;
pub mod db;
pub mod migration;
pub mod off_days;
pub mod session_store;
pub mod undo_stack;
