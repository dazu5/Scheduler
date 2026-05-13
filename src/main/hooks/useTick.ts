// React hook bridging Rust's 1 Hz `timer:tick` event and the
// frontend. Returns the latest tick payload —
// `{ active, next, nowMin, elapsed, planned }` — matching what the
// summarize.summarizeNow function would produce locally.
//
// Behaviour:
//   - On mount, computes the payload synchronously from `sessions`
//     so the first paint is correct without waiting for Rust.
//   - Subscribes to the Tauri `timer:tick` event; once Rust emits,
//     each tick replaces the local payload.
//   - Recomputes whenever the caller's `sessions` change so the
//     panel reflects new state without waiting for the next tick.
//
// There is intentionally NO JS-side setInterval. An interval timer
// outlives the React tree in vitest (cleanup races with worker
// shutdown), so the test runner hangs after every render that
// mounts useTick. Production updates come from Rust's authoritative
// 1 Hz emitter; pure-browser dev (`npm run dev`) won't tick, but
// that mode is for ad-hoc UI work — full live behaviour only matters
// under `npm run tauri dev`.

import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import type { Session, TimerTick } from '../../shared/ipc';
import { summarizeNow } from '../../shared/summarize';
import { dateKey } from '../../shared/time';

function computeFromSessions(sessions: Session[]): TimerTick {
  const now = new Date();
  const today = dateKey(now);
  const todaysSessions = sessions.filter((s) => s.dateKey === today);
  const ns = summarizeNow(todaysSessions, now);
  return {
    active: ns.active,
    next: ns.next,
    nowMin: ns.nowMin,
    elapsed: ns.elapsed,
    planned: ns.planned,
  };
}

export function useTick(sessions: Session[]): TimerTick {
  const [tick, setTick] = useState<TimerTick>(() => computeFromSessions(sessions));

  useEffect(() => {
    setTick(computeFromSessions(sessions));
  }, [sessions]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    listen<TimerTick>('timer:tick', (event) => {
      setTick(event.payload);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return tick;
}
