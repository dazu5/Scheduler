import { useCallback, useEffect, useState } from 'react';
import {
  type OvernightSpill,
  type Session,
  type SessionInput,
  type UpdateSessionInput,
  addSession,
  deleteSession,
  duplicateSession,
  listSessions,
  redoCommand,
  toggleDone,
  undoCommand,
  updateSession,
} from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { Header } from './Header';
import { NowPanel } from './NowPanel';
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
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

function AppInner() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
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

  return (
    <div className="flex h-full min-h-screen flex-col bg-bg text-fg">
      <Header
        weekStart={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
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
    </div>
  );
}
