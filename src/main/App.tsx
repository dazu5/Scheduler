import { save } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState } from 'react';
import { toCsv, toJson } from '../shared/export';
import {
  type OvernightSpill,
  type Session,
  type SessionInput,
  type UpdateSessionInput,
  addSession,
  deleteSession,
  duplicateSession,
  exportToPath,
  hasOnboarded,
  hidePill,
  listOffDays,
  listSessions,
  markDayOff,
  redoCommand,
  setOnboarded,
  showPill,
  toggleDone,
  undoCommand,
  unmarkDayOff,
  updateSession,
} from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { Dashboard } from './Dashboard';
import { DayOffModal } from './DayOffModal';
import { Header } from './Header';
import { NowPanel } from './NowPanel';
import { type OnboardingCompleteResult, OnboardingModal } from './OnboardingModal';
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import { useTick } from './hooks/useTick';
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
  // Map<dateKey, reason> for the visible week. Refreshed alongside
  // sessions whenever weekStart changes or a mutation fires.
  const [offDays, setOffDays] = useState<Map<string, string>>(() => new Map());
  // The dateKey currently being marked/unmarked off via the modal,
  // or null when the modal is closed.
  const [markingDayOff, setMarkingDayOff] = useState<string | null>(null);
  const toast = useToast();
  // Single tick subscription for the app — the live "active" Session
  // id flows down to both <NowPanel /> and <WeekGrid /> so they
  // re-render in the same frame when a Session starts/ends.
  const tick = useTick(sessions);
  const activeSessionId = tick.active?.id ?? null;

  const refresh = useCallback(async () => {
    const range = {
      start: dateKey(weekStart),
      end: dateKey(addDays(weekStart, 6)),
    };
    const [freshSessions, freshOffDays] = await Promise.all([
      listSessions(range),
      listOffDays(range),
    ]);
    setSessions(freshSessions);
    setOffDays(new Map(freshOffDays.map((o) => [o.dateKey, o.reason])));
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

  // -----------------------------------------------------------------
  // Slice 5 — Undo / Redo
  //
  // The Rust undo_stack module pushes one entry per session_store
  // mutation; here we expose Ctrl+Z (undo), Ctrl+Shift+Z (redo), and
  // Ctrl+Y (alternate redo). useKeyboardShortcut already suppresses
  // these while any input/textarea/select is focused or the editor
  // modal is open, so typing 'z' inside the Notes field can't undo
  // your last save.
  // -----------------------------------------------------------------
  const handleUndo = useCallback(async () => {
    try {
      const label = await undoCommand();
      if (label) {
        toast.success(`Undid: ${label}`);
        await refresh();
      }
    } catch (err) {
      toast.error(`Couldn't undo: ${(err as Error).message ?? 'unknown error'}`);
    }
  }, [refresh, toast]);

  const handleRedo = useCallback(async () => {
    try {
      const label = await redoCommand();
      if (label) {
        toast.success(`Redid: ${label}`);
        await refresh();
      }
    } catch (err) {
      toast.error(`Couldn't redo: ${(err as Error).message ?? 'unknown error'}`);
    }
  }, [refresh, toast]);

  useKeyboardShortcut('z', handleUndo, { ctrl: true });
  useKeyboardShortcut('z', handleRedo, { ctrl: true, shift: true });
  useKeyboardShortcut('y', handleRedo, { ctrl: true });

  // -----------------------------------------------------------------
  // Slice 6 — Off-Days
  // -----------------------------------------------------------------
  const handleToggleDayOff = useCallback((dKey: string) => {
    setMarkingDayOff(dKey);
  }, []);

  const handleConfirmDayOff = useCallback(
    async (reason: string) => {
      if (!markingDayOff) return;
      try {
        await markDayOff(markingDayOff, reason);
        toast.success(`Marked ${markingDayOff} off`);
        setMarkingDayOff(null);
        await refresh();
      } catch (err) {
        toast.error(`Couldn't mark day off: ${(err as Error).message ?? 'unknown error'}`);
      }
    },
    [markingDayOff, refresh, toast],
  );

  const handleUnmarkDayOff = useCallback(async () => {
    if (!markingDayOff) return;
    try {
      await unmarkDayOff(markingDayOff);
      toast.success(`Restored ${markingDayOff}`);
      setMarkingDayOff(null);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't unmark day: ${(err as Error).message ?? 'unknown error'}`);
    }
  }, [markingDayOff, refresh, toast]);

  // -----------------------------------------------------------------
  // Slice 12 — CSV / JSON export
  // -----------------------------------------------------------------
  const handleExport = useCallback(
    async (format: 'csv' | 'json') => {
      const weekKey = dateKey(weekStart);
      const defaultName = `scheduler-${weekKey}.${format}`;
      try {
        const path = await save({
          defaultPath: defaultName,
          filters: [
            format === 'csv'
              ? { name: 'CSV', extensions: ['csv'] }
              : { name: 'JSON', extensions: ['json'] },
          ],
        });
        if (!path) return; // user cancelled
        const content = format === 'csv' ? toCsv(sessions) : toJson(sessions);
        await exportToPath(path, content);
        toast.success(`Exported ${sessions.length} Sessions`);
      } catch (err) {
        toast.error(`Export failed: ${(err as Error).message ?? 'unknown error'}`);
      }
    },
    [sessions, toast, weekStart],
  );
  const handleExportCsv = useCallback(() => handleExport('csv'), [handleExport]);
  const handleExportJson = useCallback(() => handleExport('json'), [handleExport]);

  // -----------------------------------------------------------------
  // Slice 8 — Pill window toggle
  // -----------------------------------------------------------------
  const [pillVisible, setPillVisible] = useState(false);
  const handleTogglePill = useCallback(async () => {
    try {
      if (pillVisible) {
        await hidePill();
        setPillVisible(false);
      } else {
        await showPill();
        setPillVisible(true);
      }
    } catch (err) {
      toast.error(`Pill toggle failed: ${(err as Error).message ?? 'unknown error'}`);
    }
  }, [pillVisible, toast]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-bg text-fg">
      <Header
        weekStart={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onOpenSettings={handleOpenSettings}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onTogglePill={handleTogglePill}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <NowPanel sessions={sessions} tick={tick} />
        <Dashboard weekStart={weekStart} sessions={sessions} offDays={offDays} />
        <WeekGrid
          weekStart={weekStart}
          sessions={sessions}
          activeSessionId={activeSessionId}
          offDays={offDays}
          onToggleDayOff={handleToggleDayOff}
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
      {markingDayOff && (
        <DayOffModal
          dateKey={markingDayOff}
          initialReason={offDays.get(markingDayOff) ?? ''}
          alreadyOff={offDays.has(markingDayOff)}
          onConfirm={handleConfirmDayOff}
          onUnmark={handleUnmarkDayOff}
          onCancel={() => setMarkingDayOff(null)}
        />
      )}
    </div>
  );
}
