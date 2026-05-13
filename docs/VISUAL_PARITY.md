# Visual Parity — Scheduler vs `weekly_scheduler.html`

> Snapshot taken at issue #18 chunk 7. Update when subsequent slices
> (#7 Off-Days, #8 Now Panel tick, #11 Dashboard, …) land further
> visual surfaces.

The Tauri app's design system is **HTML-faithful by token** (Direction
A): the `@theme` block in `src/styles.css` carries the same color
palette, surface tiers, radius scale, font family + stylistic
alternates, and category palette as the predecessor's `:root` block.

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

## Surfaces that match in visual treatment

- **Session blocks** — dark Category-tinted fill (`--cat-X-bg`), white
  label + white@55% time row, `border-radius: 0.5rem` (matches
  predecessor's 8px), `filter: brightness(1.18)` on hover, line-through
  + opacity-55 when `done`. Action buttons (done / duplicate / delete)
  fade in only on hover via `group-hover/session:opacity-100`.
- **CategoryBadge** — pill style: dark Category bg + bright Category
  text, uppercase, letter-spaced.
- **Now Panel** — one rounded bar split into three slots by 1px gaps
  (Active : Next : Today = 1.4 : 1 : 1), each with a colored status
  dot (red pulsing for Active, blue for Next, green for Today).
- **Buttons** — primary uses `--color-accent`, hover scales brightness
  with `--color-accent-hover`; ghost is transparent-with-hover-bg.
- **Modal** — fade-in keyframe (`120ms ease-out`), 60% black backdrop,
  focus trap (Tab loops within the dialog, Escape closes, focus
  restored on close).

## Known divergences (deliberate)

1. **Grid layout — table-row vs absolute-positioned columns.** The
   predecessor positions Session blocks absolutely within day columns,
   with `top` + `height` computed from `startMin` + duration; a 90-
   minute Session is visibly taller than a 60-minute one. The Tauri
   app uses a `<table>` with hourly rows: each Session shows up in the
   row matching its start hour. This means **block heights don't scale
   with duration** in the current build. Tracked for a follow-up slice
   — most likely paired with slice #8 (Now Panel + 1 Hz tick) so the
   layout refactor and the tick-driven UI land together.
2. **No "active" pulse on the live Session block.** The predecessor
   draws a red ring + glow around the Session whose `[startMin, endMin)`
   contains "now". The Tauri app surfaces the active Session in the
   NowPanel only. Will land with the slice #8 tick.
3. **No Dashboard / stats bar.** The predecessor has a pace-tracking
   bar above the grid (animation/workflow/cornerman/total with
   pace badges). Out of scope for #18 — owned by slice #11.
4. **No Day cards / off-days.** The predecessor shows a per-day card
   header with reset / off-day toggles. Owned by slice #7.
5. **No Pill widget yet.** Always-on-top floating monitor pill is a
   separate Tauri window — owned by slice #10.

## How to re-verify

```powershell
cd C:\Users\Neruuu\Desktop\Project_VA\Learning Roots\Scheduler
npm run tauri dev
```

Then open `..\weekly_scheduler.html` in a browser at the same window
size and visually diff the two. Screenshot both and update this file
when divergence #1 closes.
