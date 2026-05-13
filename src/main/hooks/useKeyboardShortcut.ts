// Reusable keyboard-shortcut hook used by the Header (week nav)
// and — once slice #6 lands — the Undo/Redo bindings.
//
// Behaviour:
//   - Attaches a window-level keydown listener while `enabled` is true.
//   - Skips when the active element is an <input>, <textarea>, or
//     <select> (so typing in a form field never triggers a shortcut);
//     callers can opt back in with `allowInInputs: true`.
//   - Skips when a modal is open (any element with
//     `role="dialog"` + `aria-modal="true"` in the DOM).
//   - Matches `key` case-insensitively; modifier requirements
//     (`ctrl`, `shift`, `alt`, `meta`) all default to false and must
//     match the event exactly.

import { useEffect } from 'react';

export interface KeyboardShortcutOptions {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  /** Default true — set false to temporarily detach the listener. */
  enabled?: boolean;
  /** Default false — typing in a form field shouldn't trigger nav. */
  allowInInputs?: boolean;
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE.has(target.tagName)) return true;
  return target.isContentEditable;
}

export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
): void {
  const {
    ctrl = false,
    shift = false,
    alt = false,
    meta = false,
    enabled = true,
    allowInInputs = false,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (e.ctrlKey !== ctrl) return;
      if (e.shiftKey !== shift) return;
      if (e.altKey !== alt) return;
      if (e.metaKey !== meta) return;
      if (!allowInInputs && isEditableTarget(e.target)) return;
      if (isModalOpen()) return;
      handler(e);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, handler, ctrl, shift, alt, meta, enabled, allowInInputs]);
}
