import { useCallback, useEffect, useState } from 'react';
import {
  type OvernightSpill,
  type Session,
  type SessionInput,
  type UpdateSessionInput,
  addSession,
  deleteSession,
  duplicateSession,
  hasOnboarded,
  listSessions,
  setOnboarded,
  toggleDone,
  updateSession,
} from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { Header } from './Header';
import { NowPanel } from './NowPanel';
import { type OnboardingCompleteResult, OnboardingModal } from './OnboardingModal';
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';
import { ToastProvider, useToast } from './ui';

// Root component for the main window. Composes the major surfaces
// (Header, NowPanel, WeekGrid, SessionEditor) on top of a
// ToastProvider so every mutation reaches the notification stack.
//
// App itself just owns the provider; the actual wiring lives in
// <AppInner /> so useToast() resolves to the same provider instance.

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

interface Editing {
  dateKey: string;
  hour: number;
  session: Session | null;
}

// One of two reasons the OnboardingModal is open:
//   - 'first-launch': hasOnboarded() returned false; closing this
//     modal writes setOnboarded(true).
//   - 'settings':     the user pressed the Settings button after
//     already onboarding; closing does NOT touch the flag.
type OnboardingReason = 'first-launch' | 'settings';

function AppInner() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [onboarding, setOnboarding] = useState<OnboardingReason | null>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const fresh = await listSessions({
      start: dateKey(weekStart),
      end: dateKey(addDays(weekStart, 6)),
    });
    setSessions(fresh);
  }, [weekStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Check the kv flag once on mount. If the user has never seen the
  // import prompt, raise it now. Idempotent on remount because the
  // close handler writes the flag.
  useEffect(() => {
    let cancelled = false;
    hasOnboarded().then((done) => {
      if (cancelled) return;
      if (!done) setOnboarding('first-launch');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnboardingComplete = useCallback(
    async (result: OnboardingCompleteResult) => {
      const wasFirstLaunch = onboarding === 'first-launch';
      setOnboarding(null);
      if (wasFirstLaunch) {
        try {
          await setOnboarded(true);
        } catch (err) {
          toast.error(`Couldn't save onboarding flag: ${(err as Error).message ?? 'unknown'}`);
        }
      }
      // After a successful import, surface the freshly imported rows
      // in the week grid.
      if (!result.skipped) {
        await refresh();
      }
    },
    [onboarding, refresh, toast],
  );

  const handleOpenSettings = useCallback(() => {
    setOnboarding('settings');
  }, []);

  const daySessions = editing ? sessions.filter((s) => s.dateKey === editing.dateKey) : [];

  const handleCreate = async (input: SessionInput, _spill: OvernightSpill | null) => {
    try {
      await addSession(input);
      toast.success(`Saved: ${input.label}`);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't save: ${(err as Error).message ?? 'unknown error'}`);
    }
  };

  const handleUpdate = async (id: string, input: UpdateSessionInput) => {
    try {
      await updateSession(id, input);
      toast.success(`Saved: ${input.label}`);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't save: ${(err as Error).message ?? 'unknown error'}`);
    }
  };

  const handleDelete = async (s: Session) => {
    try {
      await deleteSession(s.id);
      toast.success(`Deleted: ${s.label}`);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't delete: ${(err as Error).message ?? 'unknown error'}`);
    }
  };

  const handleToggleDone = async (s: Session) => {
    // No toast — this fires often enough that a notification stack
    // would feel like noise. The visible strike-through is feedback
    // enough.
    try {
      await toggleDone(s.id);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't toggle done: ${(err as Error).message ?? 'unknown error'}`);
    }
  };

  const handleDuplicate = async (s: Session) => {
    try {
      await duplicateSession(s);
      toast.success(`Duplicated: ${s.label}`);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't duplicate: ${(err as Error).message ?? 'unknown error'}`);
    }
  };

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, -7));
  }, []);
  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);
  const handleToday = useCallback(() => {
    setWeekStart(getMondayOf(new Date()));
  }, []);

  return (
    <div className="flex h-full min-h-screen flex-col bg-bg text-fg">
      <Header
        weekStart={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onOpenSettings={handleOpenSettings}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <NowPanel sessions={sessions} />
        <WeekGrid
          weekStart={weekStart}
          sessions={sessions}
          onCellClick={(dKey, hour) => {
            setEditing({ dateKey: dKey, hour, session: null });
          }}
          onSessionClick={(s) => {
            setEditing({
              dateKey: s.dateKey,
              hour: Math.floor(s.startMin / 60),
              session: s,
            });
          }}
          onToggleDone={handleToggleDone}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      </main>
      {editing && (
        <SessionEditor
          editing={editing.session}
          defaultDateKey={editing.dateKey}
          defaultHour={editing.hour}
          daySessions={daySessions}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      )}
      {onboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </div>
  );
}
