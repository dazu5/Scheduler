# PRD — Scheduler v0.1

> Refactor of `../weekly_scheduler.html` into a standalone Tauri 2
> desktop app with an always-on-top **pill widget**, **activity
> tracking** (keyboard taps + mouse clicks, counts only), and
> **report export**. Stack and process model are locked in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). Domain vocabulary follows
> [`../CONTEXT.md`](../CONTEXT.md) — use **Session** (never "block"),
> **Category** (never "tag"), **Day** = `YYYY-MM-DD`, **Week** =
> Monday-anchored.

## Problem Statement

The current scheduler lives in `weekly_scheduler.html` — a single-page
browser app I keep open in a tab all day to track deep-work Sessions
across LR Animation, LR Workflow, and Cornerman. Four pain points:

1. **The browser tab is the monitor.** When the tab is hidden behind
   any other window, the Now Panel and tab-title hack are invisible.
   Alt-tabbing breaks flow.
2. **State is fragile.** `localStorage['jmdaz_scheduler_v4']` is one
   cleared-cache away from gone, and the `adjusted` boolean records
   *that* a Session changed but not *what* changed.
3. **It's a webpage, not an app.** Can't pin it to the taskbar
   meaningfully, can't auto-start, can't auto-update.
4. **There's no record of actual time worked.** I tick `done` on a
   Session but the app has no idea whether I spent the planned 3
   hours actually working or spent half of them on Twitter. I can't
   generate a report that shows planned-vs-actual hours, much less
   one I can hand to a client.

## Solution

A standalone Tauri 2 desktop app — `Scheduler/` — that replaces the
HTML predecessor and adds three things on top of feature parity:

1. **Pill widget** — a frameless 220 × 56 always-on-top window
   showing the current Session label, time remaining, progress bar,
   and an activity status dot. Replaces the `document.title` hack.
2. **Activity tracking** — global keyboard + mouse hooks (via
   `rdev`) record **counts only** (never content) into per-minute
   buckets in SQLite. Tracking can be toggled off; tray and pill
   indicators always show whether it's running.
3. **Report export** — a Reports view in the main window with a
   date-range picker produces a self-contained HTML report (inline
   SVG charts, no external CDN, opens offline forever). Optional PDF
   via Tauri's print API.

Storage moves to SQLite with schema migrations and an `adjustments`
audit table; the v4 localStorage data imports on first launch. v0.1
ships as a signed `.msi` installer with Tauri's auto-update wired to
GitHub releases.

## User Stories

1. As a user, I want a desktop app I can launch from the Start menu,
   so that I don't have to keep a browser tab open all day.
2. As a user, I want the app to auto-start when I sign in to Windows,
   so that I never forget to launch it.
3. As a user, I want a small pill widget that floats above every
   other window, so that I can see my current Session without
   alt-tabbing.
4. As a user, I want the pill to show the current Session's label,
   time remaining as `mm:ss`, and a thin progress bar, so that I
   know at a glance whether I'm running short.
5. As a user, I want the pill to update within a second of any
   change in the main window, so that the two windows never disagree.
6. As a user, I want to drag the pill to any position on any
   monitor, so that it sits where it doesn't cover my work.
7. As a user, I want the pill's position remembered per monitor, so
   that plugging/unplugging an external display doesn't lose it.
8. As a user, I want clicking the pill to bring the main scheduler
   window to the front, so that I can open the editor quickly.
9. As a user, I want to right-click the pill for a menu with "pause
   monitor / hide pill / show dashboard / show reports / quit", so
   that I can dismiss it during meetings without quitting the app.
10. As a user, I want hovering the pill (~800 ms) to expand it to
    show the next Session, so that I can preview what's coming.
11. As a user, I want a system tray icon, so that I can re-show the
    pill or main window if I've hidden them.
12. As a user, I want my v4 localStorage data from
    `weekly_scheduler.html` to import on first launch, so that I
    don't lose any historical Sessions.
13. As a user, I want every change to a Session (`category`,
    `label`, `startMin`, `endMin`, `notes`) written to an
    `adjustments` table with a timestamp, so that I have a real
    audit log.
14. As a user, I want undo / redo (`Ctrl+Z` / `Ctrl+Shift+Z`) on
    Session mutations capped at 50 entries, so that my existing
    keyboard muscle memory carries over.
15. As a user, I want the week grid to behave like in the HTML —
    Monday-anchored, click empty cell to add at that hour with a
    template-derived Category default, click a filled cell to open
    the editor, `← / →` change week, `T` jumps to this week.
16. As a user, I want the live overlap warning, ⚠ icon on day cards,
    `Esc` / `Ctrl+Enter` shortcuts, and the `↺` reset-day button to
    all carry over from the HTML.
17. As a user, I want the Now Panel, Dashboard pace badges,
    expected-by-now markers, analytics "Adjustments & Notes" feed,
    and CSV/JSON export to behave the same as in the HTML.
18. As a user, I want overnight Sessions (e.g. 6 PM → 1 AM) to
    behave like they do in the HTML after the 2026-05-13 fix —
    auto-split at midnight into two linked halves — and I want the
    pill to keep tracking across the seam without flicker.
19. As a user, I want the app to auto-update from signed GitHub
    releases, so that I don't have to manually download installers.
20. As a user, I want all data persisted to SQLite under
    `%APPDATA%\Scheduler\`, so that backups and exports are
    straightforward.
21. As a user, I want a one-click "Export to JSON" backup, so that I
    can keep periodic copies and migrate machines.
22. As a user, I want past Days never auto-seeded (matching the
    HTML's `seedMissingDays` rule), so that yesterday doesn't fill
    with template ghosts.
23. As a user, I want pace badges to stay neutral ("Not started
    yet") until I tick my first `done` for the Week (matching
    `weekHasStarted`), so that an untouched Week doesn't nag me.
24. As a user, I want the pill to use the same Category color
    palette as the main window's Sessions, so that the visual
    identity is consistent.
25. As a user, I want cold-start to interactive UI under 2 s on
    Windows 11.
26. As a user, I want the installer under 10 MB, so that auto-updates
    are quick.
27. As a developer, I want pure logic (time, overlap, summarize,
    pace, migration, adjustments, report) testable with vitest
    without spinning up a window.
28. As a developer, I want the Rust `session_store` and `undo_stack`
    tested against in-memory SQLite.
29. As a developer, I want one Playwright happy-path that
    drag-creates a Session, edits it to overnight, and asserts the
    pill updates correctly across midnight.

### Time tracking & activity

30. As a user, I want the app to record how much actual time I spent
    in each Category, so that I can compare planned hours to real
    hours worked.
31. As a user, I want the app to count my keyboard taps and mouse
    clicks during each Session, so that I have an objective signal
    of how engaged I was during that block.
32. As a user, I want a clear visual indicator (tray icon dot + pill
    status dot) that tracking is on, so that I always know when
    activity is being recorded.
33. As a user, I want a Settings toggle to enable / disable activity
    tracking, so that I can pause it during private personal use of
    the machine.
34. As a user, I want activity tracking to record **counts only** —
    no key contents, no app names, no window titles, no clipboard,
    no screenshots — so that I trust the tool with my keyboard.
35. As a user, I want all activity data to live locally in SQLite
    and never leave the machine, so that I'm not exposed to a data
    leak.
36. As a user, I want idle gaps (≥ 60 s without input by default)
    detected within Sessions, so that "actual time worked" excludes
    obvious AFK periods.
37. As a user, I want activity history older than the retention
    setting (default 90 days) pruned automatically on app start, so
    that the database doesn't grow without bound.
38. As a user, I want a "Clear activity history" action in Settings
    that wipes `activity_samples` without touching Sessions, so
    that I can reset the activity dataset independently.
39. As a user, I want the pill's activity-status dot to reflect
    real-time state (green = active, yellow = low, gray = idle,
    dim = tracking off), so that I get an at-a-glance engagement
    signal.

### Reports

40. As a user, I want a Reports view in the main window with a
    date-range picker (preset: This Week, Last Week, This Month,
    custom), so that I can review any time window.
41. As a user, I want each report to show per-Category **planned vs
    actual** hours, so that I can spot the streams where I
    consistently undershoot.
42. As a user, I want each report to show per-Day timeline blocks
    with activity-intensity coloring, so that I can see which days
    were focused vs distracted.
43. As a user, I want each report to include the adjustments feed
    (the audit log) so that I can review what shifted and why.
44. As a user, I want to export the report as a **self-contained
    HTML file** (inline SVG, no external CDN), so that I can email
    it or open it offline forever.
45. As a user, I want optional **PDF export** of the same report, so
    that I can include it in monthly summaries.

## Implementation Decisions

Stack rationale is in `ARCHITECTURE.md`. This section lists the
module-interface decisions and the behaviors each module owns.

### Modules — pure TS (port from `weekly_scheduler.html`)

1. **`time`** — minutes-since-midnight ↔ `HH:MM`, date-key helpers,
   15-min snap, `readEditTimes` overnight detection (added
   2026-05-13). Hides the `<input type="time">` constraints and
   snap rule.
2. **`overlap`** — `findOverlaps(pool, target)`. Sole conflict
   detector. Hides `endMin`-exclusivity and same-id exclusion.
3. **`summarize`** — `summarize`, `summarizeAll`, `summarizeNow`,
   `summarizeLogged`, `dayWorkHours`, `expectedHoursByNow`. Hides
   per-Category rollup math, the "logged = done" rule, the
   in-progress fractional hour, off-Day skipping.
4. **`pace`** — `computePace`, `weekHasStarted`,
   `activeDaysForCategory`. Hides the engagement-gating rule and the
   per-Category active-weekdays derivation from the template.
5. **`migration`** — `importV4(json)` produces SQLite-shaped rows.
   Hides the v2 → v3 → v4 chain (idempotent), the `tag → category`
   rename, and shape coercion.
6. **`adjustments`** — `applySessionEdit(prev, patch)` returns
   `{ next, audit[] }`. Hides the `ADJUSTMENT_FIELDS` set, the
   diff-to-record transform, and the derivation of the `adjusted`
   flag from the audit set.
12. **`report`** — pure aggregator. Inputs: date range, `sessions[]`,
    `activity_samples[]`, `off_days`. Output: `ReportData`
    (per-Category planned vs actual hours, per-Day timeline blocks
    with intensity, per-Session activity summary, idle-gap list,
    adjustments feed). No DOM, no IO.

### Modules — Rust (single SQLite writer)

7. **`session_store`** — owns the connection behind
   `Mutex<Connection>`; commands `add_session`, `update_session`,
   `delete_session`, `toggle_done`, `mark_day_off`,
   `unmark_day_off`, `replace_week`, `import_days`. Each mutation
   writes to `sessions` + appends to `adjustments` + emits
   `session:updated`.
8. **`undo_stack`** — wraps `session_store` mutations. Cap 50; any
   mutation clears the redo stack.
9. **`tick`** — single 1 Hz async task. Reads today's Sessions,
   computes active/next, emits `timer:tick` with
   `{ active, next, nowMin, elapsed, planned }`. Single source of
   truth for both windows.
10. **`pill_window`** — `show()`, `hide()`,
    `set_position(monitor, x, y)`, geometry persistence via
    `settings`. Hides Tauri's frameless+transparent+always-on-top
    flag combo, Windows DPI, and monitor enumeration.
11. **`activity_tracker`** — registers global keyboard + mouse hooks
    via `rdev` when `tracking.enabled = true`. Maintains in-memory
    counters (`keystrokes`, `mouse_clicks`, `mouse_moves`,
    `last_input_ts`). Flushes every 60 s to `activity_samples` with
    the currently-active `session_id` and computed `idle_seconds`.
    Emits `activity:tick`. Public surface: `start()`, `stop()`,
    `is_running()`, `flush_now()`. **Hard privacy boundary**: the
    internal recording API has no parameters carrying key identity,
    content, app context, or coordinates — pinned by a Rust test
    that fails the build if anyone widens it.
13. **`report_export`** — given `ReportData`, renders self-contained
    HTML (inline SVG charts) to a user-chosen path. Optional PDF via
    Tauri webview print API. Hides asset self-containment and the
    print invocation. Public surface: `export_html(report, path)`,
    `export_pdf(report, path)`.

### IPC contract (`src/shared/ipc.ts`)

```ts
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
  show_main:        () => void;
  set_pill_visible: (visible: boolean) => void;

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

### SQLite schema

Defined in `ARCHITECTURE.md` § Schema. Key decisions:

- `sessions.overnight_link_id` (nullable UUID) pairs the two halves
  of an auto-split overnight Session.
- `adjustments` is append-only; deleting a Session cascades.
- `activity_samples` is one row per minute (~1440/day max); joined
  to `sessions` via `session_id`. Pruned past retention on startup.
- Times stay as `INTEGER` minutes-since-midnight (matching the HTML
  representation) — no `DATETIME` columns. Easier port.

### Window model

Tauri spawns two windows backed by one Rust process. Main =
`index.html` (full UI + Reports view). Pill = `pill.html` (frameless,
transparent, always-on-top, 220 × 56). Both subscribe to events from
the Rust `tick`, `session_store`, and `activity_tracker` modules. The
pill *never writes* — eliminates the two-writer race entirely.

### Migration path

First-launch onboarding asks "Import from `weekly_scheduler.html`?".
User exports JSON from the HTML version (its existing CSV/JSON
export produces the right shape) and drops it on the prompt.
`migration.importV4` writes to SQLite. The HTML predecessor stays in
`../weekly_scheduler.html` as the spec until v0.1 ships.

### Milestones

- **M1 — Pure logic ported + tested.** 6 pure TS modules (`time`,
  `overlap`, `summarize`, `pace`, `migration`, `adjustments`)
  ported, vitest green. No UI yet.
- **M2 — Rust backend.** SQLite schema + migrations, `session_store`,
  `undo_stack`, `tick`, `pill_window`, **`activity_tracker`** with
  privacy-pinning test, Rust unit tests against in-memory SQLite.
- **M3 — Main window.** React UI behavior-equivalent to
  `weekly_scheduler.html` (week grid, editor, Now Panel, dashboard,
  analytics, CSV/JSON export, keyboard shortcuts).
- **M4 — Pill window.** Frameless always-on-top,
  click-to-focus-main, drag-to-reposition, right-click menu,
  hover-to-expand, system tray icon, activity status dot.
- **M5 — Reports + tracking UI.** `report` pure module; Reports view
  with date-range picker; per-Category planned-vs-actual; per-Day
  timeline with intensity coloring; adjustments feed; HTML export;
  PDF export; Settings panel for tracking toggle, idle threshold,
  retention, and "Clear activity history."
- **M6 — Packaging.** Tauri build → signed `.msi`, GitHub Actions
  release workflow, Tauri updater wired to GH releases, Windows
  sign-in auto-start.

### Acceptance criteria for v0.1

- All HTML behaviors from `CONTEXT.md` § UX surfaces work in the
  main window.
- Pill stays above all other apps including full-screen apps (or
  the exception is documented).
- Pill label/countdown updates within 1 second of any state change.
- Closing the main window keeps the pill and tray icon alive.
- Existing `jmdaz_scheduler_v4` localStorage data imports without
  loss.
- Overnight Sessions auto-split at midnight (matching the
  2026-05-13 HTML fix) and the pill tracks across the seam without
  flicker.
- Activity tracking captures **counts only** — a Rust test pins
  that the `activity_tracker` recording API has no parameters
  carrying key identity, content, app names, or coordinates.
- Tracking can be disabled from Settings; toggling unregisters the
  hooks (verified by absence of writes to `activity_samples` while
  off).
- Idle detection: after `tracking.idle_threshold_sec` of no input
  events, `idle_seconds` accumulates in the current bucket.
- Activity history older than retention is pruned on app start.
- Pill widget shows the activity dot reflecting active / low / idle
  / off state.
- Report generation for a 7-Day window completes in under 2 s on
  Win11.
- Exported HTML report is **self-contained**: renders offline with
  no network requests (verified in test by disabling network and
  opening the file).
- Cold-start to interactive UI under 2 s on Windows 11.
- Installer under 10 MB.
- All vitest + Rust + Playwright tests green in CI.

## Testing Decisions

A good test asserts an externally-observable behavior, not how the
function is implemented — it survives a refactor that preserves the
user-visible contract. Concretely:

- **Vitest** for all 7 pure TS modules. One test file per module.
  - `time` — input-time parse, snap-to-15 boundaries, the four
    cases of `readEditTimes` (same-day, overnight wrap, midnight
    shorthand `00:00`, zero-length error).
  - `overlap` — empty pool, single overlap, multi-overlap,
    exclusive-end boundary, same-id exclusion.
  - `summarize` — per-Category totals, off-Day skipping, the
    in-progress fractional hour, empty-Day shape.
  - `pace` — `weekHasStarted` gating, on/ahead/behind thresholds,
    off-Day exclusion.
  - `migration` — v2 / v3 / v4 inputs coerce correctly,
    `tag → category` rename, idempotency on re-import.
  - `adjustments` — diff-to-record correctness, notes-only edits
    flip `adjusted`, unchanged patches produce zero records.
  - `report` — empty range, range with only planned Sessions (no
    activity), range with activity but no Sessions, mixed range,
    off-Days excluded from expected, overnight Sessions counted on
    the correct Day (no double-count when the two halves share an
    `overnight_link_id`).
- **Rust unit tests** for `session_store`, `undo_stack`, and
  `activity_tracker` against in-memory SQLite. Cover:
  - cascade-on-stretch (extending `endMin` pushes later same-Day
    Sessions by the delta, clamped at 1440),
  - 50-deep undo cap (entry 51 evicts entry 1),
  - redo-clears-on-mutate,
  - every Session mutation appends to `adjustments` exactly once,
  - `activity_tracker` bucket alignment to 60 s, idle-threshold
    accumulation, `session_id` resolution at flush, flush atomicity
    (one transaction per bucket), retention prune drops exactly the
    rows older than threshold,
  - **privacy-pinning test**: a structural check on the
    `activity_tracker` recording API asserts there is no `String`,
    `Vec<u8>`, coordinate-pair, or app-handle parameter. Failing
    this breaks the build.
- **One Playwright e2e flow**: drag-create a Session in the main
  window, edit it to `18:00 → 01:00`, assert the pill window's text
  changes within 1 s, fast-forward the simulated clock past midnight,
  assert the pill is now showing the post-midnight half of the
  auto-split pair.

**Prior art**: there is no existing test suite in
`weekly_scheduler.html`. All tests are net-new; the pure modules are
genuinely pure, so vitest examples from any TS project transfer.

## Out of Scope

- macOS / Linux builds.
- Cross-device sync, cloud backup (incl. activity data — by design).
- Mobile companion.
- Calendar integrations (Google Calendar, Outlook, ICS).
- Multi-user / accounts.
- Theming beyond dark mode.
- **App / window / URL tracking** — by design; widens the privacy
  surface beyond the user's need.
- **Keystroke content, clipboard, screenshots** — by design; this
  is a hard privacy boundary, not a v0.1 cut.
- Real-time productivity score / gamification. The report shows
  counts and idle gaps; the user interprets.
- Touch / pen input.
- Anything in the sibling `Ai Animation/` and
  `Ai Workflow Development/` folders.

## Further Notes

- The predecessor `../weekly_scheduler.html` stays in place until
  v0.1 ships. It is the spec for feature parity and the source of
  the migration JSON.
- The 2026-05-13 overnight-split fix in `weekly_scheduler.html` is
  the behavioral baseline for v0.1's overnight handling. The new
  app preserves the auto-split contract and upgrades the unlinked
  halves to an `overnight_link_id`-paired pair.
- The word "block" must not appear in code, UI, or docs — use
  **Session**. The word "tag" must not appear — use **Category**.
- The privacy boundary on `activity_tracker` is **non-negotiable
  for v0.1**. It is what makes this tool safe to leave running. Any
  future feature that requires app / window / URL context is a
  separate proposal with its own privacy review — not a v0.x
  enhancement of `activity_tracker`.
- `gh` CLI is authenticated as `dazu5`; the repo `dazu5/Scheduler`
  exists and is empty. First follow-up issue after triage: scaffold
  the Tauri project and push the initial commit.
