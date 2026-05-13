# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2.x** (Rust) | Native always-on-top frameless windows, system tray, ~5 MB installer (vs Electron ~150 MB), faster cold-start, stable on Windows 11. |
| UI framework | **React 19** | Familiar ecosystem; good fit for the modal-heavy editor plus the Reports view. |
| Language | **TypeScript** strict | Type safety across the refactor. |
| Bundler | **Vite** | First-class Tauri support; fast dev loop. |
| Global state | **Zustand** | Minimal boilerplate; cross-window sync via Tauri events. |
| Storage | **SQLite** via `@tauri-apps/plugin-sql` | Real schema migrations; durable activity history; queryable audit log. |
| Styling | **Tailwind v4** | Utility CSS with native `@theme`; easy port of the existing dark theme. |
| Input hooks | **`rdev`** (Rust crate) | Cross-platform global keyboard + mouse hooks. Used for **counts only** — never content. |
| Charts | Hand-rolled **inline SVG** | Self-contained HTML reports need zero external assets — no Chart.js / Recharts. |
| Lint + format | **Biome** | One tool replaces ESLint + Prettier. |
| Unit tests | **Vitest** | Pure-logic functions. |
| E2E tests | **Playwright** | Drives the actual Tauri window. |
| CI | **GitHub Actions** | Typecheck, lint, test, build Windows installer on every PR. |
| Updates | **Tauri updater** + GitHub Releases | Signed `.msi` auto-update. |
| Package manager | **pnpm** | Faster install, strict node_modules. |

## Process model

Tauri spawns two WebView windows backed by a single Rust process:

```
┌──────────────────────────┐    Tauri IPC events    ┌─────────────────────┐
│  main window             │  ←─────────────────→   │  pill window         │
│  (src/main/)             │   session:updated      │  (src/pill/)         │
│  full scheduler UI +     │   day:offmarked        │  frameless,          │
│  Reports view            │   timer:tick           │  always-on-top,      │
│                          │   activity:tick        │  220 × 56 px         │
│                          │   tracking:state       │                      │
└─────────────┬────────────┘                        └──────────┬──────────┘
              │                                                │
              │           Rust commands (invoke)               │
              └────────────────────┬───────────────────────────┘
                                   ▼
              ┌─────────────────────────────────────────┐
              │  Rust backend (src-tauri/)              │
              │  - SQLite (single writer)               │
              │  - System tray                          │
              │  - 1 Hz tick → emit timer:tick          │
              │  - activity_tracker → global rdev hooks │
              │  - 60 s flush → activity_samples table  │
              │  - Retention prune on startup           │
              │  - Pill position persistence            │
              └─────────────────────────────────────────┘
```

### Window responsibilities

- **Main window** (`src/main/`): week grid, editor, dashboard,
  **Reports view**, Settings (incl. tracking toggle + retention),
  CSV/JSON import-export.
- **Pill window** (`src/pill/`): 220 × 56 frameless, transparent,
  always-on-top. Shows current Session label, `mm:ss` countdown,
  thin progress bar, and a **tiny activity-status dot**
  (green = active, yellow = low activity, gray = idle, dim = tracking
  off). Interactions:
  - Click → bring main window to front.
  - Drag → reposition; edges snap; position persisted per monitor.
  - Right-click → menu (pause monitor, hide pill, show dashboard,
    show reports, quit).
  - Hover ≥ 800 ms → expand to show next Session.
- **Rust backend** owns:
  - Single SQLite connection (`Mutex<Connection>` in Tauri state).
  - 1 Hz tick driving the pill countdown (single source of truth).
  - System-tray menu + pill window lifecycle.
  - Global `rdev` hooks (when `tracking.enabled = true`).
  - 60-second activity flush task → one row per minute in
    `activity_samples` with the active `session_id` and computed
    `idle_seconds`.
  - Retention pruning on app start (default 90 days of
    `activity_samples`).

### Data flow — Session mutation

```
user action in main → invoke('update_session', …)
                   → Rust writes sessions + appends to adjustments
                   → Rust emits 'session:updated' to ALL windows
                   → both windows update their Zustand store
                   → re-render
```

### Data flow — activity tracking

```
rdev hook → in-memory counters (keys, clicks, moves, last_input_ts)
         → every 60 s: flush task writes one row to activity_samples
                       with current session_id + idle_seconds
         → emit 'activity:tick' { counts, idle_seconds, session_id }
         → pill updates its status dot
         → main window's Now Panel can show current bucket's intensity
```

The pill **never writes** — it's a pure read-side. Two-writer races
are eliminated by construction.

## Schema (initial)

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  date_key    TEXT NOT NULL,            -- 'YYYY-MM-DD'
  category    TEXT NOT NULL,            -- 'animation' | 'workflow' | 'cornerman' | 'break'
  label       TEXT NOT NULL,
  start_min   INTEGER NOT NULL,         -- 0..1440
  end_min     INTEGER NOT NULL,         -- 0..1440, exclusive
  notes       TEXT,
  done        INTEGER NOT NULL DEFAULT 0,
  adjusted    INTEGER NOT NULL DEFAULT 0,
  overnight_link_id  TEXT,              -- pairs the two halves of an overnight split
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_date ON sessions(date_key);

CREATE TABLE off_days (
  date_key   TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE adjustments (          -- audit log (HTML version mutated in place)
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_at  INTEGER NOT NULL,
  reason      TEXT
);
CREATE INDEX idx_adjustments_session ON adjustments(session_id);

CREATE TABLE activity_samples (     -- new in v0.1: input-count history
  bucket_start  INTEGER PRIMARY KEY,    -- unix epoch ms, 60-sec-aligned
  session_id    TEXT,                   -- Session active at flush; null if none
  keystrokes    INTEGER NOT NULL,
  mouse_clicks  INTEGER NOT NULL,
  mouse_moves   INTEGER NOT NULL,       -- coarse event count, NOT pixel distance
  idle_seconds  INTEGER NOT NULL        -- seconds within bucket with no input
);
CREATE INDEX idx_activity_session ON activity_samples(session_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Initial settings keys:
--   'tracking.enabled'           : 'true' | 'false'   (default 'true')
--   'tracking.idle_threshold_sec': '60'
--   'tracking.retention_days'    : '90'
--   'pill.position.<monitor_id>' : JSON {x, y}
```

`overnight_link_id` evolves the 2026-05-13 HTML fix — the two halves
of an auto-split overnight Session share a UUID, so the editor can
offer "edit both halves" and reports can avoid double-counting.

## Privacy & input tracking

`activity_tracker` records **counts only**. This is a hard
architectural boundary, not a feature flag.

**What it captures**:
- Keyboard event counts (event-kind = key-press; no key identity).
- Mouse click event counts.
- Mouse movement event counts (event count, not pixel distance).
- Idle gaps — seconds within the current 60-second bucket with no
  input.

**What it must never capture**:
- The actual keys pressed. No keystroke contents.
- Clipboard data.
- Window titles, application names, URLs.
- Screenshots, screen contents, accessibility tree.
- Any data tied to a network destination — everything is local to
  SQLite and never leaves the machine.

**How the boundary is enforced**:
- The internal recording API on `activity_tracker` is intentionally
  narrow — `record_keystroke(timestamp_ms)`,
  `record_click(timestamp_ms)`, `record_move(timestamp_ms)`. No
  String parameters, no coordinate parameters, no app-context
  parameters.
- A pinning test (Rust) inspects those function signatures and
  fails the build if anyone widens them.
- `rdev`'s callback receives full event detail; the tracker
  immediately discards everything except `kind` and the current
  timestamp.

**User controls**:
- Settings → "Activity tracking" toggle. When off, the `rdev` hooks
  are unregistered and no rows are written.
- Tray icon + pill status dot are persistent indicators of whether
  tracking is on.
- "Clear activity history" wipes `activity_samples` without
  touching Sessions.
- Retention defaults to 90 days; older buckets are pruned on app
  start.

## Modules

### Pure TS — port from `weekly_scheduler.html`

| # | Module | Owns |
|---|---|---|
| 1 | `time` | minutes/HH:MM, date-keys, snap-to-15, `readEditTimes` (overnight detection added 2026-05-13). |
| 2 | `overlap` | `findOverlaps`. Sole conflict detector. |
| 3 | `summarize` | `summarize`, `summarizeAll`, `summarizeNow`, `summarizeLogged`, `dayWorkHours`, `expectedHoursByNow`. |
| 4 | `pace` | `computePace`, `weekHasStarted`, `activeDaysForCategory`. |
| 5 | `migration` | v2 → v3 → v4 JSON normalisation, `tag → category` rename, idempotent. |
| 6 | `adjustments` | `applySessionEdit(prev, patch) → { next, audit[] }`. |
| 12 | `report` | Pure aggregator. Inputs: date range, `sessions[]`, `activity_samples[]`, `off_days`. Output: `ReportData` (per-Category planned vs actual hours, per-Day timeline blocks with intensity, per-Session activity summary, idle-gap list, adjustments feed). |

### Rust — single SQLite writer

| # | Module | Owns |
|---|---|---|
| 7 | `session_store` | SQLite connection; `add/update/delete/toggle_done/mark_off/import` commands; writes to `sessions` + appends to `adjustments`; emits `session:updated`. |
| 8 | `undo_stack` | Wraps `session_store` mutations; 50-deep inverse-snapshot stack; redo clears on mutate. |
| 9 | `tick` | 1 Hz async task; reads today's Sessions; computes active/next; emits `timer:tick`. Single source of truth for both windows. |
| 10 | `pill_window` | Frameless always-on-top window lifecycle; geometry persistence per monitor; tray-icon menu wiring. |
| 11 | `activity_tracker` | Registers global `rdev` hooks when `tracking.enabled = true`. Counters → 60-second buckets → `activity_samples`. Emits `activity:tick`. Privacy-boundary enforced by narrow recording API + pinning test. |
| 13 | `report_export` | Renders `ReportData` → self-contained HTML (inline SVG); optional PDF via Tauri webview print API. |

### Thin UI shells

- `src/main/` — week grid, editor, dashboard, **Reports view**,
  settings, analytics. No business logic.
- `src/pill/` — label + countdown + thin progress bar + activity
  status dot. Subscribes to `timer:tick` and `activity:tick`.

### IPC contract (`src/shared/ipc.ts`)

Typed wrappers around `invoke` / `listen` — single source of truth
for the TS ↔ Rust vocabulary.

```ts
// Commands (TS → Rust)
type Commands = {
  // Sessions
  list_sessions: (range: { start: string; end: string }) => Session[];
  add_session:   (input: SessionInput) => string;
  update_session:(id: string, patch: SessionPatch) => void;
  delete_session:(id: string) => void;
  toggle_done:   (id: string) => void;
  mark_day_off:  (dateKey: string, reason: string) => void;
  unmark_day_off:(dateKey: string) => void;
  undo:          () => void;
  redo:          () => void;
  import_json:   (json: string) => { sessions: number; offDays: number };
  export_json:   () => string;

  // Windows
  show_main:         () => void;
  set_pill_visible:  (visible: boolean) => void;

  // Activity tracking
  set_tracking_enabled:   (enabled: boolean) => void;
  is_tracking_enabled:    () => boolean;
  list_activity:          (range: { startMs: number; endMs: number }) => ActivitySample[];
  clear_activity_history: () => { deleted: number };

  // Reports
  export_report: (params: ReportParams,
                  format: 'html' | 'pdf',
                  path: string) => void;
};

// Events (Rust → TS — both windows can listen)
type Events = {
  'session:updated': { dateKey: string };
  'day:offmarked':   { dateKey: string; reason: string | null };
  'timer:tick':      { active: Session | null; next: Session | null;
                       nowMin: number; elapsed: number; planned: number };
  'activity:tick':   { keystrokes: number; mouse_clicks: number;
                       mouse_moves: number; idle_seconds: number;
                       session_id: string | null };
  'tracking:state':  { enabled: boolean };
  'pill:position':   { x: number; y: number; monitor: number };
};
```

## Folder layout

```
Scheduler/
├── README.md
├── ARCHITECTURE.md          ← this file
├── PRD.md
├── PROGRESS.md
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── biome.json
├── vite.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── index.html               ← main window entry
├── pill.html                ← pill window entry
├── src/
│   ├── main/
│   │   ├── App.tsx
│   │   ├── WeekGrid.tsx
│   │   ├── Editor.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Reports.tsx      ← new in v0.1
│   │   └── Settings.tsx     ← gains tracking toggle + retention
│   ├── pill/
│   │   ├── App.tsx
│   │   ├── Pill.tsx
│   │   ├── ActivityDot.tsx  ← new in v0.1
│   │   └── ExpandedPill.tsx
│   └── shared/
│       ├── store.ts         ← Zustand
│       ├── ipc.ts           ← typed Tauri invoke + listen wrappers
│       ├── time.ts          ← pure
│       ├── overlap.ts       ← pure
│       ├── summarize.ts     ← pure
│       ├── pace.ts          ← pure
│       ├── migration.ts     ← pure
│       ├── adjustments.ts   ← pure
│       ├── report.ts        ← pure — new in v0.1
│       └── types.ts
├── src-tauri/
│   ├── Cargo.toml
│   ├── Cargo.lock           ← committed (binary app)
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs            ← SQLite connection + migrations
│   │   ├── commands.rs      ← #[tauri::command] handlers
│   │   ├── tick.rs          ← 1 Hz timer task
│   │   ├── tray.rs
│   │   ├── pill_window.rs
│   │   ├── activity.rs      ← new in v0.1: rdev hooks + flush
│   │   └── report.rs        ← new in v0.1: HTML/PDF export
│   └── migrations/
│       └── 0001_init.sql    ← incl. activity_samples
├── tests/
│   ├── unit/                ← vitest
│   └── e2e/                 ← playwright
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
```

## Alternatives considered

- **Electron** — faster to port but bundle/memory cost is wrong for
  an always-running app.
- **PWA + Web standards** — cannot do always-on-top over other apps.
  Hard-requirement killer.
- **Vanilla TS + Vite (no React)** — closer to the imperative HTML
  style; rejected because the refactor is the chance to introduce
  component boundaries.
- **Svelte 5** — smaller bundle, nice runes API; rejected because
  React's ecosystem wins for a solo maintainer.
- **Wails (Go backend)** — viable; rejected because Rust's
  `rusqlite` + `rdev` + Tauri plugin ecosystem is more mature in
  2026.
- **`device_query` instead of `rdev`** — poll-based, lighter, but
  loses fast keystrokes between polls. Rejected.
- **App / window / URL tracking** (à la RescueTime, ActivityWatch) —
  would meaningfully improve report insight but widens the privacy
  surface beyond what this tool needs. Counts + idle gaps
  distinguish "actually working" from "stepped away" — sufficient.
  Rejected.
- **Chart.js / Recharts** — adds 100–300 KB and external
  font/asset dependencies. Rejected in favor of hand-rolled inline
  SVG so the exported HTML report is fully self-contained.

## Out of scope for v0.1

- Cross-device sync / cloud backup (incl. activity data).
- macOS / Linux builds.
- Mobile companion.
- Calendar integrations (Google Calendar, Outlook, ICS).
- Multi-user / accounts.
- Theming beyond dark mode.
- App / window / URL tracking — by design.
- Keystroke content, clipboard, screenshots — never, not just out
  of scope.
