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
  toggleDone,
  updateSession,
} from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { Header } from './Header';
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';

// Root component for the main window. Issue #18 chunk 4 introduces
// weekStart as state (was useMemo'd from new Date()) so the Header's
// prev/next/today navigation can shift it.

interface Editing {
  dateKey: string;
  hour: number;
  session: Session | null;
}

export function App() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));

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
    await addSession(input);
    setEditing(null);
    await refresh();
  };

  const handleUpdate = async (id: string, input: UpdateSessionInput) => {
    await updateSession(id, input);
    setEditing(null);
    await refresh();
  };

  const handleDelete = async (s: Session) => {
    await deleteSession(s.id);
    await refresh();
  };

  const handleToggleDone = async (s: Session) => {
    await toggleDone(s.id);
    await refresh();
  };

  const handleDuplicate = async (s: Session) => {
    await duplicateSession(s);
    await refresh();
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
      />
      <main className="flex-1 px-4 py-4">
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
