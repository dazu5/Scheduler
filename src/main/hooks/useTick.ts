// React hook bridging Rust's 1 Hz `timer:tick` event and the
// frontend. Always returns the latest tick payload —
// `{ active, next, nowMin, elapsed, planned }` — matching what the
// summarize.summarizeNow function would produce locally.
//
// Behaviour:
//   - On mount, computes the payload synchronously from `sessions`
//     so the first paint is correct without waiting for Rust.
//   - Subscribes to the Tauri `timer:tick` event so updates pushed
//     from the backend take precedence over the JS fallback.
//   - Re-derives the payload every second from the latest
//     `sessions` prop, covering the window before Tauri emits and
//     the browser-only dev environment where listen() resolves to
//     a noop.
//
// The hook intentionally does NOT filter `sessions` to today —
// callers may pass a multi-day list and the JS fallback uses
// `summarizeNow` which already does the right thing (it filters
// internally via nowMinutes + start/end comparison).

import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';
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
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    // Update immediately whenever the caller's sessions change so
    // the panel reflects new state without waiting for the next
    // 1 Hz tick.
    setTick(computeFromSessions(sessions));
  }, [sessions]);

  useEffect(() => {
    // JS fallback: re-derive every second from the latest sessions.
    const id = setInterval(() => {
      setTick(computeFromSessions(sessionsRef.current));
    }, 1000);

    // Tauri authoritative source — overrides the fallback when
    // events arrive. `listen` returns a Promise<UnlistenFn>; we
    // capture the resolved unlistener for cleanup.
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
      clearInterval(id);
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return tick;
}
