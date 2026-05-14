// Issue #9 — Pill window.
//
// A 260×60 frameless always-on-top monitor that mirrors the main
// window's "Active / Next" view in a tiny, glanceable form. Reads
// from Tauri's `timer:tick` event and from `list_sessions` for the
// current day so the pill works whether or not the main window is
// open.
//
// Drag handling: the outer body has `data-tauri-drag-region` so the
// user can drag the pill anywhere on screen by clicking-and-holding
// any non-button area. The "Open" button at the right edge has
// `data-tauri-drag-region="false"` so clicking it focuses the main
// window instead of starting a drag.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import type { Session, TimerTick } from './shared-pill';
import { dateKey, formatTime } from './shared-pill';

function nowMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function summarizeNowLocal(sessions: Session[]): TimerTick {
  const now = new Date();
  const today = dateKey(now);
  const m = nowMinutes(now);
  const todays = sessions.filter((s) => s.dateKey === today);
  return {
    active: todays.find((s) => s.startMin <= m && m < s.endMin) ?? null,
    next: todays.filter((s) => s.startMin > m).sort((a, b) => a.startMin - b.startMin)[0] ?? null,
    nowMin: m,
    elapsed: 0,
    planned: 0,
  };
}

const CATEGORY_ACCENT: Record<string, string> = {
  animation: 'bg-cat-animation',
  workflow: 'bg-cat-workflow',
  cornerman: 'bg-cat-cornerman',
  break: 'bg-cat-break',
};

export function PillWindow() {
  const [tick, setTick] = useState<TimerTick>(() => ({
    active: null,
    next: null,
    nowMin: 0,
    elapsed: 0,
    planned: 0,
  }));

  useEffect(() => {
    const today = dateKey(new Date());
    invoke<Session[]>('list_sessions', { start: today, end: today })
      .then((sessions) => setTick(summarizeNowLocal(sessions)))
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    let cancelled = false;
    listen<TimerTick>('timer:tick', (e) => setTick(e.payload)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const focusMain = () =>
    invoke('focus_main_window').catch(() => {
      /* main may have been closed — silent */
    });

  const { active, next, nowMin } = tick;
  const remaining = active ? active.endMin - nowMin : 0;
  const remainingHrs = Math.floor(remaining / 60);
  const remainingMin = remaining % 60;
  const remainingText =
    remaining > 0
      ? remainingHrs > 0
        ? `${remainingHrs}h ${remainingMin}m`
        : `${remainingMin}m`
      : '';

  return (
    // The whole body is a drag region. The `Open` button below
    // overrides this so it can fire onClick instead of starting a
    // window drag.
    <div
      data-tauri-drag-region
      data-testid="pill"
      className="flex h-full w-full items-center gap-2.5 bg-surface px-3 text-fg"
      style={{ cursor: 'grab' }}
    >
      {active ? (
        <>
          <span
            data-tauri-drag-region
            className={`size-2 shrink-0 animate-pulse-dot rounded-full ${
              CATEGORY_ACCENT[active.category] ?? 'bg-cat-break'
            }`}
            aria-hidden="true"
          />
          <div data-tauri-drag-region className="min-w-0 flex-1">
            <div
              data-tauri-drag-region
              className="truncate text-[12px] font-semibold leading-tight text-fg"
            >
              {active.label}
            </div>
            <div data-tauri-drag-region className="text-[10px] tabular-nums text-fg-muted">
              {formatTime(active.endMin)} · {remainingText} left
            </div>
          </div>
        </>
      ) : next ? (
        <>
          <span
            data-tauri-drag-region
            className="size-2 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />
          <div data-tauri-drag-region className="min-w-0 flex-1">
            <div
              data-tauri-drag-region
              className="text-[10px] uppercase tracking-wider text-fg-muted"
            >
              Next
            </div>
            <div
              data-tauri-drag-region
              className="truncate text-[12px] font-semibold leading-tight text-fg"
            >
              {next.label} · {formatTime(next.startMin)}
            </div>
          </div>
        </>
      ) : (
        <>
          <span
            data-tauri-drag-region
            className="size-2 shrink-0 rounded-full bg-fg-muted-2"
            aria-hidden="true"
          />
          <span data-tauri-drag-region className="text-[12px] italic text-fg-muted">
            Idle
          </span>
        </>
      )}
      <button
        type="button"
        onClick={focusMain}
        // The button is NOT a drag region — clicks here focus the
        // main window instead of starting a window drag.
        data-tauri-drag-region="false"
        className="shrink-0 cursor-pointer rounded bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fg-muted hover:bg-border hover:text-fg"
      >
        Open
      </button>
    </div>
  );
}
