// Issue #9 — Pill window.
//
// A 260×60 frameless always-on-top monitor that mirrors the main
// window's "Active / Next" view in a tiny, glanceable form. Reads
// from Tauri's `timer:tick` event and from `list_sessions` for the
// current day so the pill works whether or not the main window is
// open.
//
// No interactivity beyond click-to-focus-main (slice #10 will add the
// right-click tray menu + hover-expand). The whole pill is wrapped in
// a button that calls `focus_main_window` so the user can swap from
// the pill to the full grid without tray hunting.

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

  // On mount, fetch today's sessions once (so the first paint shows
  // accurate state even before Rust emits a tick) and subscribe to
  // future `timer:tick` events.
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
    <button
      type="button"
      onClick={focusMain}
      data-testid="pill"
      className="flex h-full w-full cursor-pointer items-center gap-2.5 border-0 bg-surface px-3 text-left text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ borderRadius: 0 }}
    >
      {active ? (
        <>
          <span
            className={`size-2 shrink-0 animate-pulse-dot rounded-full ${
              CATEGORY_ACCENT[active.category] ?? 'bg-cat-break'
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-tight text-fg">
              {active.label}
            </div>
            <div className="text-[10px] tabular-nums text-fg-muted">
              {formatTime(active.endMin)} · {remainingText} left
            </div>
          </div>
        </>
      ) : next ? (
        <>
          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-fg-muted">Next</div>
            <div className="truncate text-[12px] font-semibold leading-tight text-fg">
              {next.label} · {formatTime(next.startMin)}
            </div>
          </div>
        </>
      ) : (
        <>
          <span className="size-2 shrink-0 rounded-full bg-fg-muted-2" aria-hidden="true" />
          <span className="text-[12px] italic text-fg-muted">Idle</span>
        </>
      )}
    </button>
  );
}
