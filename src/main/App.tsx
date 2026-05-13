import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';

// Root component for the main window. Slice #5 wires the
// per-Session quick actions (toggle done, duplicate, delete)
// alongside the existing create / edit flows. Every mutation
// triggers a listSessions refresh so the grid stays in sync.

interface Editing {
  dateKey: string;
  hour: number;
  session: Session | null;
}

export function App() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const weekStart = useMemo(() => getMondayOf(new Date()), []);

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

  return (
    <main>
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
    </main>
  );
}
