// Issue #18 chunk 2 — Toast system.
//
// Three exports: <ToastProvider /> wraps the app and renders a
// portal-style stack in a fixed region; useToast() returns
// imperative helpers (show / success / error); the internal <Toast />
// is the visual atom.
//
// Each toast auto-dismisses after `duration` ms (default 3000) and
// is also dismissible by click. The stack is announced via a
// `role="status"` live region per toast — screen readers receive a
// polite update when each fires.

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ToastVariant = 'default' | 'success' | 'error';

interface ToastRecord {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider />');
  }
  return ctx;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `toast-${idCounter}-${Date.now()}`;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Auto-dismiss duration in milliseconds. Default 3000. */
  duration?: number;
}

export function ToastProvider({ children, duration = 3000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [dismiss, duration],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m: string) => show(m, 'success'),
      error: (m: string) => show(m, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: 'border-l-border',
  success: 'border-l-ok',
  error: 'border-l-danger',
};

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div aria-label="Notifications" className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          data-variant={t.variant}
          onClick={() => onDismiss(t.id)}
          className={`min-w-[240px] max-w-sm cursor-pointer rounded-md border border-border border-l-4 bg-surface px-4 py-3 text-sm text-fg shadow-lg animate-[toast-in_180ms_cubic-bezier(0.16,1,0.3,1)] ${VARIANT_CLASS[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
