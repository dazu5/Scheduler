// Issue #11 — frontend hook into the Rust activity tracker.
//
// Privacy contract (matches the pinning test in
// `src-tauri/src/activity.rs`):
//   - We never read the pressed key — `tickKeystroke` carries no
//     `event.key`, no `event.code`, no modifier state. Just "one
//     keystroke happened on dateKey X".
//   - We never read the click target — `tickClick` carries no
//     coordinates, no element selector, no button index.
//   - We never inspect document content, clipboard, or any other
//     page state.
//
// The Rust-side OS hook (rdev) is a follow-up; this slice ships the
// API surface + the document-level fallback so a user typing in the
// scheduler itself still gets counted while the app is focused.

import { useCallback, useEffect, useState } from 'react';
import { type ActivityCounts, getActivityCounts, tickClick, tickKeystroke } from '../../shared/ipc';
import { dateKey } from '../../shared/time';

/** Refresh the displayed counter every 2 s while mounted; bump
 *  immediately on a manual `bump()` call (fired right after a tick
 *  so the UI stays responsive without waiting for the next poll). */
export function useActivityTracker(): {
  counts: ActivityCounts;
  reload: () => Promise<void>;
} {
  const [counts, setCounts] = useState<ActivityCounts>({
    dateKey: dateKey(new Date()),
    keystrokes: 0,
    clicks: 0,
  });

  const reload = useCallback(async () => {
    try {
      const today = dateKey(new Date());
      const c = await getActivityCounts(today);
      setCounts(c);
    } catch {
      // Silent — Tauri may not be wired in dev/browser.
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 2000);

    function onKey() {
      void tickKeystroke(dateKey(new Date())).catch(() => {});
    }
    function onClick() {
      void tickClick(dateKey(new Date())).catch(() => {});
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);

    return () => {
      clearInterval(id);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [reload]);

  return { counts, reload };
}
