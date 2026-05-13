# Scheduler

Standalone desktop scheduler for tracking deep-work blocks across the
Learning Roots and Cornerman streams. A refactor of the original
`../weekly_scheduler.html` single-page app into a Tauri 2 desktop
application with an always-on-top **pill widget** for at-a-glance
session monitoring (replacing the current `document.title` trick).

## Status

🚧 **Pre-MVP** — scaffolding in progress. See:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — stack, rationale, alternatives considered.
- The pinned PRD issue at <https://github.com/dazu5/Scheduler> — scope and milestones.
- `../weekly_scheduler.html` — the single-file predecessor. Stays in place
  until v0.1 ships; serves as the spec for feature parity and as the
  source for the JSON-export → SQLite-import migration path.

## What's different from the HTML version

| | `weekly_scheduler.html` | `Scheduler/` (this app) |
|---|---|---|
| Runtime | Browser tab | Native Win11 app (Tauri 2) |
| "What's active now" | Browser tab title | Frameless always-on-top pill widget |
| Storage | `localStorage` | SQLite with migrations |
| Adjustment log | Inline on each session | Dedicated audit table |
| Crosses midnight | Auto-split into two blocks (added 2026-05-13) | Same, plus pill keeps tracking across the seam |
| Updates | Manual reload | Signed auto-update via GH Releases |

## Quick start (once scaffolded)

```bash
pnpm install
pnpm tauri dev      # main + pill windows, hot-reload
pnpm test           # vitest
pnpm tauri build    # signed .msi in src-tauri/target/release/bundle/
```

## Repository

`git@github.com:dazu5/Scheduler.git` — single-branch trunk, PRD and
milestones tracked as GitHub issues.
