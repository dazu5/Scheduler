// Issue #18 chunk 2 — Modal primitive.
//
// A11y surface: `role="dialog"` + `aria-modal="true"` + an
// `aria-label` from the `title` prop. Focus is moved to the first
// focusable child on mount and restored to the previously-focused
// element on unmount. Pressing Escape calls `onClose`; clicking the
// backdrop calls `onClose` unless `dismissOnBackdrop` is false.
//
// Tab/Shift+Tab wraps at the first/last focusable child so keyboard
// users can't navigate behind the modal. This is the minimum focus
// trap that doesn't require a third-party library.

import { type ReactNode, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  /** Accessible name for the dialog (announced by screen readers). */
  title: string;
  /** Called when the user requests close — Escape, backdrop click, or
   *  any explicit Cancel button inside `children`. */
  onClose: () => void;
  /** Defaults to true. Set false for destructive-confirm modals
   *  where an accidental click outside shouldn't dismiss. */
  dismissOnBackdrop?: boolean;
  children?: ReactNode;
}

export function Modal({ title, onClose, dismissOnBackdrop = true, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Escape to close + Tab/Shift+Tab focus loop.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Focus restoration: remember whatever was focused at mount, push
  // focus into the dialog, and return it on unmount.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.focus();
    return () => {
      previous?.focus?.();
    };
  }, []);

  return (
    <div data-testid="modal-root">
      <div
        data-testid="modal-backdrop"
        className="fixed inset-0 z-40 bg-black/60 animate-[fade-in_120ms_ease-out]"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ' +
          'min-w-[380px] max-w-[480px] rounded-lg border border-border bg-surface ' +
          'p-6 shadow-2xl animate-[fade-in_120ms_ease-out]'
        }
      >
        {children}
      </div>
    </div>
  );
}
