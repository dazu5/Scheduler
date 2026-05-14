# Visual Parity — Scheduler vs `weekly_scheduler.html`

> Snapshot updated after slices #7 + #8 + #9 + #11 + #13 closed (commits
> `2374e68` → `83612e7`). Previous snapshot was at #18 chunk 7; every
> divergence listed there has since closed.

The Tauri app's design system is **HTML-faithful by token**: the
`@theme` block in `src/styles.css` carries the same color palette,
surface tiers, radius scale, font family + stylistic alternates, and
category palette as the predecessor's `:root` block. Layout structure
matches the predecessor's two-row top bar + 4-card stats bar + Now
strip + 7-column day grid surfaces.

## Tokens that match exactly

| Token | Value |
| --- | --- |
| `--color-bg` | `#0a0e13` |
| `--color-surface` | `#121821` |
| `--color-surface-2` | `#1a2230` |
| `--color-surface-3` | `#232c3d` |
| `--color-border` | `#1f2733` |
| `--color-border-strong` | `#2d3848` |
| `--color-fg` | `#e8ecf1` |
| `--color-fg-muted` | `#6b7686` |
| `--color-accent` | `#4ea1ff` |
| `--color-warn` | `#f59e0b` |
| `--color-danger` | `#ef4444` |
| `--color-ok` | `#22c55e` |
| `--color-now` | `#ef4444` |
| `--color-cat-animation` | `#f59e0b` (orange) |
| `--color-cat-animation-bg` | `#6b3f0e` (dark burnt) |
| `--color-cat-workflow` | `#a855f7` (violet) |
| `--color-cat-workflow-bg` | `#3d1f73` (dark) |
| `--color-cat-cornerman` | `#10b981` (emerald) |
| `--color-cat-cornerman-bg` | `#0f4e36` (dark forest) |
| `--color-cat-break` | `#64748b` (slate) |
| `--color-cat-break-bg` | `#2a3344` (dark charcoal) |
| body font-family | Inter + system fallback |
| body font-size | 13px |
| body font-feature-settings | `cv02 cv03 cv04 cv11` |
| `--hour-h` (HOUR_PX) | 80px |

## Surfaces that now match

- **Header** — two-row layout: topbar (`Weekly Work Scheduler` title + accent + subtitle on left, segmented `Week / Analytics` + `CSV / JSON / Import / 🔔 / ⊙` on right) + actionbar (week nav + undo/redo) wrapped in a surface card.
- **Now Panel** — one rounded bar split into three slots by 1px gaps (Active : Next : Today = 1.4 : 1 : 1), each with a colored status dot (red pulsing for Active, blue for Next, green for Today).
- **Dashboard** — 4-card stats bar (Animation / Workflow / Cornerman / Weekly Total) with Category dot + name + actual `/ target` + pace badge + thin progress bar. `gap-3` between cards.
- **WeekGrid** — absolute-positioned day columns (CSS grid, not `<table>`). Day headers stack `MON / 11 / May · 11.0h` (or `Off`); today's column gets blue title + 2px accent underline + 3.5% accent tint background.
- **Session blocks** — dark Category-tinted fill (`--cat-X-bg`), white label + white@55% time-range header `8:00 AM-11:00 AM · ANIM`, 8px left/right inset, 3px `SESSION_GAP` shaved off height so back-to-back blocks have visible separation. Action buttons (done / duplicate / delete) fade-in only on group-hover. Active Session: red `ring-1 ring-now` + 14px glow shadow.
- **NOW line** — 2px red horizontal line absolutely positioned in today's column at the current minute, with a pulsing red dot at left and a "NOW" badge — replicates the predecessor's `.now-line` exactly.
- **Off-Days** — hover-revealed `✕` / `↺` toggle in the day header; off columns get opacity-85 + suppressed hour gridlines + a `<DayOffCard />` with the moon icon and the user's reason.
- **Pill window** — frameless 260×60 always-on-top second window (`pill.html` + `src/pill/PillWindow.tsx`); reads from `timer:tick` + `list_sessions`; click `Open` to focus main; mousedown anywhere else drags the window via `getCurrentWindow().startDragging()`.
- **CategoryBadge** — pill style: dark Category bg + bright Category text, uppercase, letter-spaced.
- **Buttons** — primary uses `--color-accent`, hover scales brightness with `--color-accent-hover`; ghost is transparent-with-hover-bg.
- **Modal** — fade-in keyframe (`120ms ease-out`), 60% black backdrop, focus trap (Tab loops within the dialog, Escape closes, focus restored on close).

## Remaining divergences (deliberate)

1. **`Analytics` tab is disabled** — owned by slice **#14 (Reports view)**. The Week tab + the Dashboard cover what the predecessor shows by default; the Analytics tab is the predecessor's deeper week-over-week / per-Day breakdown that needs the in-app Reports surface.
2. **No `Apply Template` / `Clear Week` buttons** — the canonical weekly `TEMPLATES` already exist in `src/shared/categories.ts` (ported with #8); the buttons + the seed-into-empty-future-Days logic land alongside #7's "past Days never auto-seeded" rule, in a follow-up.
3. **🔔 alarm icon is a placeholder** — the predecessor's bell is an end-of-session sound alarm. Sound + scheduling not wired yet; icon is `cursor-not-allowed` with a tooltip. Not on a numbered slice yet.
4. **No tray / hover-expand / persisted pill position** — owned by **#10 (pill polish)**. The pill drags but its position resets on each launch.
5. **No undo/redo button greying** — the buttons always render; they just no-op when the stack is empty (Rust-side returns `Ok(None)` and the toast is silent). Predecessor greys them out with `disabled` styling. Tiny follow-up.
6. **Activity-tracker bell removed from the Header** — the chip was incrementing on every in-app click (including the pill toggle), which felt buggy. Counts still flow into Rust via the document-level hook; surfacing them lands when the Rust-side OS rdev hook makes the count meaningful (follow-up to #11).

## How to re-verify

```powershell
cd C:\Users\Neruuu\Desktop\Project_VA\Learning Roots\Scheduler
npm run tauri dev
```

Open `..\weekly_scheduler.html` in a browser at the same window size and screenshot both. The user has been doing this every time — see the [pixel-parity feedback memory](../../../../.claude/projects/C--Users-Neruuu-Desktop-Project-VA-Learning-Roots/memory/feedback-pixel-parity-with-html-predecessor.md) for the bar.
