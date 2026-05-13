//! Scheduler — Rust backend.
//!
//! See `../ARCHITECTURE.md` and `../PRD.md` at the workspace root for
//! the stack rationale and the v0.1 PRD. The Tauri command surface,
//! tray, pill window, tick task, and activity tracker are introduced
//! in later slices; this initial slice (issue #2) lands only the
//! database initialisation module.

pub mod db;
